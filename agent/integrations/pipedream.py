"""
Pipedream webhook integration layer.

All external service calls (Salesmsg, WooDelivery) are routed through
Pipedream workflows via HTTP webhook triggers. This keeps API keys and
complex logic in Pipedream and gives us a clean, uniform interface.
"""

import json
import time
import urllib.error
import urllib.request

from agent.config import PIPEDREAM_WEBHOOKS


class PipedreamError(Exception):
    """Error calling a Pipedream webhook."""
    pass


def call_webhook(action: str, payload: dict, retries: int = 2) -> dict:
    """
    Call a Pipedream webhook endpoint.

    Args:
        action: Key from PIPEDREAM_WEBHOOKS (e.g. "sms_send", "task_lookup")
        payload: JSON body to send
        retries: Number of retry attempts on transient failures

    Returns:
        Parsed JSON response from Pipedream

    Raises:
        PipedreamError: If the webhook URL is missing or the call fails
    """
    url = PIPEDREAM_WEBHOOKS.get(action)
    if not url:
        raise PipedreamError(
            f"No Pipedream webhook URL configured for action '{action}'. "
            f"Set the corresponding environment variable."
        )

    data = json.dumps(payload).encode("utf-8")
    headers = {"Content-Type": "application/json"}
    req = urllib.request.Request(url, data=data, headers=headers, method="POST")

    last_error = None
    for attempt in range(1 + retries):
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                body = resp.read().decode("utf-8")
                return json.loads(body) if body else {"success": True}
        except urllib.error.HTTPError as e:
            last_error = e
            # Don't retry client errors (4xx)
            if 400 <= e.code < 500:
                error_body = e.read().decode("utf-8", errors="replace")
                raise PipedreamError(
                    f"Pipedream returned {e.code} for '{action}': {error_body}"
                )
        except (urllib.error.URLError, TimeoutError) as e:
            last_error = e

        if attempt < retries:
            backoff = 2 ** (attempt + 1)
            time.sleep(backoff)

    raise PipedreamError(
        f"Pipedream webhook '{action}' failed after {1 + retries} attempts: {last_error}"
    )
