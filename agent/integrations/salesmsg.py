"""
Salesmsg integration via Pipedream.

Handles sending/receiving SMS messages and managing contacts.
All actions go through the approval workflow before execution.
"""

from agent.approval import needs_approval, request_approval
from agent.integrations.pipedream import call_webhook
from agent.logger import (
    log_action_request,
    log_action_result,
    save_to_knowledge_base,
)


def send_sms(to: str, message: str, source: str = "agent") -> dict:
    """
    Send an SMS message via Salesmsg.

    Args:
        to: Recipient phone number
        message: Message text
        source: Who/what triggered this action

    Returns:
        Pipedream response dict
    """
    action = "sms_send"
    params = {"to": to, "message": message}

    log_action_request(action, params, source)

    if needs_approval(action):
        request_approval(action, params)

    result = call_webhook(action, params)
    success = result.get("success", False)

    log_action_result(action, success, result)
    save_to_knowledge_base(action, params, result, approved=True)

    return result


def lookup_contact(query: str, source: str = "agent") -> dict:
    """Look up a contact by name, phone, or email."""
    action = "sms_lookup_contact"
    params = {"query": query}

    log_action_request(action, params, source)

    if needs_approval(action):
        request_approval(action, params)

    result = call_webhook(action, params)
    log_action_result(action, True, result)
    save_to_knowledge_base(action, params, result, approved=True)

    return result


def create_contact(
    phone: str,
    first_name: str = "",
    last_name: str = "",
    email: str = "",
    tags: list[str] | None = None,
    custom_fields: dict | None = None,
    source: str = "agent",
) -> dict:
    """Create or update a contact in Salesmsg."""
    action = "sms_create_contact"
    params = {
        "number": phone,
        "first_name": first_name,
        "last_name": last_name,
        "email": email,
        "tags": tags or [],
        **(custom_fields or {}),
    }

    log_action_request(action, params, source)

    if needs_approval(action):
        request_approval(action, params)

    result = call_webhook(action, params)
    success = result.get("success", False)

    log_action_result(action, success, result)
    save_to_knowledge_base(action, params, result, approved=True)

    return result
