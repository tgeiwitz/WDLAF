"""
Dispatch agent configuration.

All settings are loaded from environment variables with sensible defaults.
Pipedream webhook URLs are the bridge between this agent and external services.
"""

import os


# --- Pipedream Webhook Endpoints ---
# Each action maps to a Pipedream workflow triggered via HTTP
PIPEDREAM_WEBHOOKS = {
    # Salesmsg actions
    "sms_send": os.environ.get("PIPEDREAM_SMS_SEND_URL", ""),
    "sms_receive": os.environ.get("PIPEDREAM_SMS_RECEIVE_URL", ""),
    "sms_lookup_contact": os.environ.get("PIPEDREAM_SMS_LOOKUP_CONTACT_URL", ""),
    "sms_create_contact": os.environ.get("PIPEDREAM_SMS_CREATE_CONTACT_URL", ""),

    # WooDelivery actions
    "task_create": os.environ.get("PIPEDREAM_TASK_CREATE_URL", ""),
    "task_update": os.environ.get("PIPEDREAM_TASK_UPDATE_URL", ""),
    "task_lookup": os.environ.get("PIPEDREAM_TASK_LOOKUP_URL", ""),
    "task_status_change": os.environ.get("PIPEDREAM_TASK_STATUS_URL", ""),
}

# --- Human Approval ---
TODD_PHONE_NUMBER = os.environ.get("TODD_PHONE_NUMBER", "")
APPROVAL_TIMEOUT_SECONDS = int(os.environ.get("APPROVAL_TIMEOUT_SECONDS", "300"))

# --- Agent Rules & Guardrails ---
RULES = {
    "require_human_approval": True,  # All actions require Todd's SMS approval initially
    "max_retries_per_action": 2,
    "log_all_interactions": True,
    "allowed_actions": [
        "sms_send",
        "sms_receive",
        "sms_lookup_contact",
        "sms_create_contact",
        "task_create",
        "task_update",
        "task_lookup",
        "task_status_change",
    ],
    "auto_approved_actions": [],  # Starts empty; grows as Todd approves patterns
}

# --- Logging ---
LOG_DIR = os.environ.get("WDLAF_LOG_DIR", "logs")
KNOWLEDGE_BASE_DIR = os.environ.get("WDLAF_KB_DIR", "knowledge_base")
