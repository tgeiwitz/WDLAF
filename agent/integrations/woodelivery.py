"""
WooDelivery integration via Pipedream.

Handles creating, updating, looking up, and changing status of delivery tasks.
All actions go through the approval workflow before execution.
"""

from agent.approval import needs_approval, request_approval
from agent.integrations.pipedream import call_webhook
from agent.logger import (
    log_action_request,
    log_action_result,
    save_to_knowledge_base,
)


def lookup_task(task_id: str = "", reference: str = "", source: str = "agent") -> dict:
    """
    Look up a delivery task by ID or reference number.

    Args:
        task_id: WooDelivery task GUID
        reference: External reference / order number
        source: Who/what triggered this action
    """
    action = "task_lookup"
    params = {"task_id": task_id, "reference": reference}

    log_action_request(action, params, source)

    if needs_approval(action):
        request_approval(action, params)

    result = call_webhook(action, params)
    log_action_result(action, True, result)
    save_to_knowledge_base(action, params, result, approved=True)

    return result


def create_task(
    recipient_name: str,
    recipient_phone: str,
    destination_address: str,
    dispatch_address: str = "",
    delivery_notes: str = "",
    reference: str = "",
    merchant_id: str = "",
    before_datetime: str = "",
    after_datetime: str = "",
    source: str = "agent",
) -> dict:
    """Create a new delivery or pickup task."""
    action = "task_create"
    params = {
        "recipientName": recipient_name,
        "recipientPhone": recipient_phone,
        "destinationAddress": destination_address,
        "dispatchAddress": dispatch_address,
        "destinationNotes": delivery_notes,
        "externalKey": reference,
        "merchantId": merchant_id,
        "beforeDateTime": before_datetime,
        "afterDateTime": after_datetime,
    }
    # Strip empty values
    params = {k: v for k, v in params.items() if v}

    log_action_request(action, params, source)

    if needs_approval(action):
        request_approval(action, params)

    result = call_webhook(action, params)
    success = result.get("success", False)

    log_action_result(action, success, result)
    save_to_knowledge_base(action, params, result, approved=True)

    return result


def update_task(
    task_id: str,
    updates: dict,
    source: str = "agent",
) -> dict:
    """
    Update an existing delivery task.

    Args:
        task_id: WooDelivery task GUID
        updates: Dict of fields to update (e.g. destinationAddress, recipientPhone)
        source: Who/what triggered this action
    """
    action = "task_update"
    params = {"TaskGuid": task_id, **updates}

    log_action_request(action, params, source)

    if needs_approval(action):
        request_approval(action, params)

    result = call_webhook(action, params)
    success = result.get("success", False)

    log_action_result(action, success, result)
    save_to_knowledge_base(action, params, result, approved=True)

    return result


def change_task_status(
    task_id: str,
    status_id: str,
    source: str = "agent",
) -> dict:
    """Change the status of a delivery task."""
    action = "task_status_change"
    params = {"taskGuid": task_id, "statusId": status_id}

    log_action_request(action, params, source)

    if needs_approval(action):
        request_approval(action, params)

    result = call_webhook(action, params)
    success = result.get("success", False)

    log_action_result(action, success, result)
    save_to_knowledge_base(action, params, result, approved=True)

    return result
