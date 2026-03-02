"""
Interaction logger.

Every agent action, approval request, and response is logged as structured JSON.
Logs serve dual purpose: audit trail and training data for the knowledge base.
"""

import json
import os
import time
from datetime import datetime, timezone

from agent.config import LOG_DIR, KNOWLEDGE_BASE_DIR


def _ensure_dir(path: str) -> None:
    os.makedirs(path, exist_ok=True)


def log_interaction(entry: dict) -> str:
    """Append a structured log entry. Returns the log file path."""
    _ensure_dir(LOG_DIR)
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    path = os.path.join(LOG_DIR, f"{today}.jsonl")

    record = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "epoch": time.time(),
        **entry,
    }

    with open(path, "a") as f:
        f.write(json.dumps(record) + "\n")

    return path


def log_action_request(action: str, params: dict, source: str) -> str:
    """Log an incoming action request before approval."""
    return log_interaction({
        "event": "action_request",
        "action": action,
        "params": params,
        "source": source,
    })


def log_approval(action: str, approved: bool, reviewer: str, notes: str = "") -> str:
    """Log an approval decision."""
    return log_interaction({
        "event": "approval_decision",
        "action": action,
        "approved": approved,
        "reviewer": reviewer,
        "notes": notes,
    })


def log_action_result(action: str, success: bool, result: dict) -> str:
    """Log the outcome of an executed action."""
    return log_interaction({
        "event": "action_result",
        "action": action,
        "success": success,
        "result": result,
    })


def log_error(action: str, error: str) -> str:
    """Log an error."""
    return log_interaction({
        "event": "error",
        "action": action,
        "error": error,
    })


def save_to_knowledge_base(action: str, params: dict, result: dict, approved: bool) -> str:
    """
    Save a completed interaction to the knowledge base.

    Approved interactions become patterns the agent can learn from.
    Rejected interactions become anti-patterns to avoid.
    """
    _ensure_dir(KNOWLEDGE_BASE_DIR)
    category = "approved" if approved else "rejected"
    path = os.path.join(KNOWLEDGE_BASE_DIR, f"{category}.jsonl")

    record = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "action": action,
        "params": params,
        "result": result,
        "category": category,
    }

    with open(path, "a") as f:
        f.write(json.dumps(record) + "\n")

    return path


def get_knowledge_base_patterns(action: str) -> list[dict]:
    """Retrieve approved patterns for a given action type."""
    path = os.path.join(KNOWLEDGE_BASE_DIR, "approved.jsonl")
    if not os.path.exists(path):
        return []

    patterns = []
    with open(path) as f:
        for line in f:
            record = json.loads(line.strip())
            if record.get("action") == action:
                patterns.append(record)
    return patterns
