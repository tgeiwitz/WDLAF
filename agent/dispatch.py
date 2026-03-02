"""
Dispatch Assistant — main agent logic.

This is the central coordinator that:
  1. Receives requests (from SMS, Slack, or direct calls)
  2. Validates against guardrails
  3. Routes to the appropriate integration
  4. Manages the human approval loop
  5. Logs everything for the knowledge base
"""

from agent.approval import ApprovalDenied, ApprovalTimeout
from agent.guardrails import GuardrailViolation, validate_action
from agent.integrations import salesmsg, woodelivery
from agent.integrations.pipedream import PipedreamError
from agent.logger import log_error, log_interaction


class DispatchAgent:
    """
    The dispatch assistant agent.

    All external actions require human approval initially.
    As patterns get approved, the knowledge base grows and can
    inform future auto-approval decisions.
    """

    def execute(self, action: str, params: dict, source: str = "agent") -> dict:
        """
        Execute a dispatch action with full guardrails and logging.

        Args:
            action: Action identifier (e.g. "sms_send", "task_lookup")
            params: Action-specific parameters
            source: Origin of the request (for audit trail)

        Returns:
            dict with "success" (bool), "result" or "error" (str)
        """
        try:
            validate_action(action, params)
        except GuardrailViolation as e:
            log_error(action, str(e))
            return {"success": False, "error": f"Guardrail violation: {e}"}

        try:
            result = self._route_action(action, params, source)
            return {"success": True, "result": result}

        except ApprovalDenied as e:
            log_interaction({
                "event": "action_denied",
                "action": action,
                "reason": str(e),
                "source": source,
            })
            return {"success": False, "error": f"Denied: {e}"}

        except ApprovalTimeout as e:
            return {"success": False, "error": f"Approval timeout: {e}"}

        except PipedreamError as e:
            log_error(action, str(e))
            return {"success": False, "error": f"Integration error: {e}"}

        except Exception as e:
            log_error(action, str(e))
            return {"success": False, "error": f"Unexpected error: {e}"}

    def _route_action(self, action: str, params: dict, source: str) -> dict:
        """Route an action to the correct integration module."""
        routers = {
            "sms_send": self._handle_sms_send,
            "sms_lookup_contact": self._handle_sms_lookup,
            "sms_create_contact": self._handle_sms_create_contact,
            "task_create": self._handle_task_create,
            "task_update": self._handle_task_update,
            "task_lookup": self._handle_task_lookup,
            "task_status_change": self._handle_task_status,
        }

        handler = routers.get(action)
        if not handler:
            raise ValueError(f"No handler for action: {action}")

        return handler(params, source)

    # --- SMS Handlers ---

    def _handle_sms_send(self, params: dict, source: str) -> dict:
        return salesmsg.send_sms(
            to=params["to"],
            message=params["message"],
            source=source,
        )

    def _handle_sms_lookup(self, params: dict, source: str) -> dict:
        return salesmsg.lookup_contact(
            query=params.get("query", ""),
            source=source,
        )

    def _handle_sms_create_contact(self, params: dict, source: str) -> dict:
        return salesmsg.create_contact(
            phone=params.get("number", ""),
            first_name=params.get("first_name", ""),
            last_name=params.get("last_name", ""),
            email=params.get("email", ""),
            tags=params.get("tags"),
            custom_fields=params.get("custom_fields"),
            source=source,
        )

    # --- Task Handlers ---

    def _handle_task_create(self, params: dict, source: str) -> dict:
        return woodelivery.create_task(
            recipient_name=params.get("recipientName", ""),
            recipient_phone=params.get("recipientPhone", ""),
            destination_address=params.get("destinationAddress", ""),
            dispatch_address=params.get("dispatchAddress", ""),
            delivery_notes=params.get("destinationNotes", ""),
            reference=params.get("externalKey", ""),
            merchant_id=params.get("merchantId", ""),
            before_datetime=params.get("beforeDateTime", ""),
            after_datetime=params.get("afterDateTime", ""),
            source=source,
        )

    def _handle_task_update(self, params: dict, source: str) -> dict:
        task_id = params.pop("TaskGuid", "")
        return woodelivery.update_task(
            task_id=task_id,
            updates=params,
            source=source,
        )

    def _handle_task_lookup(self, params: dict, source: str) -> dict:
        return woodelivery.lookup_task(
            task_id=params.get("task_id", ""),
            reference=params.get("reference", ""),
            source=source,
        )

    def _handle_task_status(self, params: dict, source: str) -> dict:
        return woodelivery.change_task_status(
            task_id=params.get("taskGuid", ""),
            status_id=params.get("statusId", ""),
            source=source,
        )
