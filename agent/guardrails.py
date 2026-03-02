"""
Guardrails and safety rules for the dispatch agent.

These are the boundaries the agent operates within. They can be updated
over time as the knowledge base grows and Todd grants broader autonomy.
"""

from agent.config import RULES


class GuardrailViolation(Exception):
    """Raised when an action violates the agent's guardrails."""
    pass


def check_action_allowed(action: str) -> None:
    """Verify an action is in the allowed list."""
    if action not in RULES["allowed_actions"]:
        raise GuardrailViolation(
            f"Action '{action}' is not in the allowed actions list. "
            f"Allowed: {RULES['allowed_actions']}"
        )


def check_message_content(message: str) -> None:
    """
    Basic content guardrails for outgoing messages.

    Prevents sending messages that could be harmful or inappropriate.
    """
    if not message.strip():
        raise GuardrailViolation("Cannot send an empty message")

    if len(message) > 1600:
        raise GuardrailViolation(
            f"Message too long ({len(message)} chars). SMS limit is ~1600 chars."
        )


def check_phone_number(phone: str) -> None:
    """Basic phone number validation."""
    cleaned = phone.replace("+", "").replace("-", "").replace(" ", "").replace("(", "").replace(")", "")
    if not cleaned.isdigit():
        raise GuardrailViolation(f"Invalid phone number: {phone}")
    if len(cleaned) < 10:
        raise GuardrailViolation(f"Phone number too short: {phone}")


def validate_action(action: str, params: dict) -> None:
    """
    Run all applicable guardrails for an action.

    Raises GuardrailViolation if any check fails.
    """
    check_action_allowed(action)

    if action == "sms_send":
        if "message" in params:
            check_message_content(params["message"])
        if "to" in params:
            check_phone_number(params["to"])

    if action in ("task_create", "task_update") and not params.get("recipientName") and not params.get("TaskGuid"):
        raise GuardrailViolation(
            "Task create/update requires at least a recipient name or task ID"
        )
