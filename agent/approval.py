"""
Human-in-the-loop approval system.

All agent actions require Todd's approval via SMS before execution.
Approval flow:
  1. Agent wants to perform an action
  2. System sends SMS to Todd describing the proposed action
  3. Todd replies YES/NO (+ optional notes)
  4. Agent proceeds or aborts based on response
  5. Interaction is logged and fed into the knowledge base
"""

import json
import time

from agent.config import (
    APPROVAL_TIMEOUT_SECONDS,
    PIPEDREAM_WEBHOOKS,
    RULES,
    TODD_PHONE_NUMBER,
)
from agent.logger import log_approval, log_error
from agent.integrations.pipedream import call_webhook


class ApprovalRequired(Exception):
    """Raised when an action needs human approval."""
    pass


class ApprovalDenied(Exception):
    """Raised when Todd denies an action."""
    pass


class ApprovalTimeout(Exception):
    """Raised when approval times out."""
    pass


def needs_approval(action: str) -> bool:
    """Check whether an action requires human approval."""
    if not RULES["require_human_approval"]:
        return False
    return action not in RULES["auto_approved_actions"]


def request_approval(action: str, params: dict) -> dict:
    """
    Send an approval request to Todd via SMS and wait for response.

    Returns:
        dict with keys: approved (bool), reviewer (str), notes (str)
    """
    if not TODD_PHONE_NUMBER:
        raise ApprovalRequired(
            f"Action '{action}' requires approval but TODD_PHONE_NUMBER is not set"
        )

    # Format the approval message
    summary = _format_action_summary(action, params)
    message = (
        f"[WDLAF Dispatch Agent]\n"
        f"Approval needed:\n\n"
        f"{summary}\n\n"
        f"Reply YES to approve, NO to deny.\n"
        f"Add notes after YES/NO if needed."
    )

    # Send SMS to Todd via Pipedream
    send_result = call_webhook("sms_send", {
        "to": TODD_PHONE_NUMBER,
        "message": message,
    })

    if not send_result.get("success"):
        log_error(action, f"Failed to send approval SMS: {send_result}")
        raise ApprovalRequired(f"Could not send approval request: {send_result}")

    # Poll for Todd's response via Pipedream webhook
    approval = _wait_for_response(action, send_result.get("conversation_id"))

    log_approval(
        action=action,
        approved=approval["approved"],
        reviewer=approval["reviewer"],
        notes=approval.get("notes", ""),
    )

    if not approval["approved"]:
        raise ApprovalDenied(
            f"Action '{action}' denied by {approval['reviewer']}: "
            f"{approval.get('notes', 'no reason given')}"
        )

    return approval


def _format_action_summary(action: str, params: dict) -> str:
    """Create a human-readable summary of the proposed action."""
    descriptions = {
        "sms_send": "Send SMS",
        "sms_lookup_contact": "Look up contact",
        "sms_create_contact": "Create contact",
        "task_create": "Create delivery task",
        "task_update": "Update delivery task",
        "task_lookup": "Look up delivery task",
        "task_status_change": "Change task status",
    }

    label = descriptions.get(action, action)
    detail_lines = []
    for key, value in params.items():
        if value and key not in ("instructions", "output_hint"):
            detail_lines.append(f"  {key}: {value}")

    details = "\n".join(detail_lines) if detail_lines else "  (no parameters)"
    return f"Action: {label}\n{details}"


def _wait_for_response(action: str, conversation_id: str | None) -> dict:
    """
    Poll Pipedream for Todd's SMS reply.

    In production this would use a webhook callback. For now we poll.
    """
    deadline = time.time() + APPROVAL_TIMEOUT_SECONDS
    poll_interval = 10  # seconds

    while time.time() < deadline:
        response = call_webhook("sms_receive", {
            "conversation_id": conversation_id,
            "since": time.time() - poll_interval - 2,
        })

        if response.get("reply"):
            return _parse_reply(response["reply"])

        time.sleep(poll_interval)

    log_error(action, "Approval timed out waiting for Todd's response")
    raise ApprovalTimeout(f"No response from Todd within {APPROVAL_TIMEOUT_SECONDS}s")


def _parse_reply(reply_text: str) -> dict:
    """Parse Todd's SMS reply into an approval decision."""
    text = reply_text.strip().upper()

    if text.startswith("YES"):
        notes = reply_text.strip()[3:].strip()
        return {"approved": True, "reviewer": "Todd", "notes": notes}
    elif text.startswith("NO"):
        notes = reply_text.strip()[2:].strip()
        return {"approved": False, "reviewer": "Todd", "notes": notes}
    else:
        # Ambiguous response - treat as denial for safety
        return {
            "approved": False,
            "reviewer": "Todd",
            "notes": f"Unclear response (treated as NO): {reply_text}",
        }
