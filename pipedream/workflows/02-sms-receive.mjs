/**
 * WDLAF Workflow 2: SMS Receive (Poll for Reply)
 *
 * Pipedream workflow that checks for new inbound SMS replies on a conversation.
 * Used by the agent to poll for Todd's approval response.
 *
 * Setup:
 *   1. Create a new Pipedream workflow
 *   2. Add trigger: "HTTP / Webhook" → Return a custom response
 *   3. Add a Node.js code step and paste this entire file
 *   4. Set environment variables in Pipedream:
 *      - SALESMSG_API_TOKEN  (Personal Access Token)
 *   5. Deploy and copy the webhook trigger URL to your .env as PIPEDREAM_SMS_RECEIVE_URL
 *
 * API reference (Salesmsg):
 *   Get messages: GET /messages/contacts?contacts[]={contact_id}&limit=10
 *   Message fields: id, conversation_id, body, body_raw, type, source,
 *                   received_at, sent_at, created_at, contact { id, number }
 *   The agent polls this every ~10s; expects { reply: "YES/NO ..." } or { reply: null }
 *
 * Incoming POST body:
 *   { "conversation_id": "abc123", "since": 1709300000.0 }
 *
 * Returns:
 *   { "reply": "YES looks good", "from": "+15559876543", "timestamp": "..." }
 *   or { "reply": null } if no new inbound messages
 */

import { axios } from "@pipedream/platform";

export default defineComponent({
  async run({ steps, $ }) {
    const TOKEN = process.env.SALESMSG_API_TOKEN;
    const BASE = "https://api.salesmessage.com/pub/v2.1";
    const HEADERS = {
      Authorization: `Bearer ${TOKEN}`,
      Accept: "application/json",
    };

    const { conversation_id, since } = steps.trigger.event.body;

    if (!conversation_id) {
      await $.respond({
        status: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          success: false,
          error: "Missing required field: 'conversation_id'",
        }),
      });
      return;
    }

    try {
      // Fetch recent messages in the conversation
      // Try conversation-specific endpoint first, fall back to messages/contacts
      let messages = [];

      try {
        const resp = await axios($, {
          method: "GET",
          url: `${BASE}/conversations/${conversation_id}/messages`,
          headers: HEADERS,
          params: { limit: 10 },
        });
        messages = resp?.data || resp || [];
      } catch (convErr) {
        // Fallback: use the messages/contacts endpoint if conversation endpoint is unavailable
        console.log(`Conversation messages endpoint failed, trying messages/contacts: ${convErr.message}`);
        const resp = await axios($, {
          method: "GET",
          url: `${BASE}/messages/contacts`,
          headers: HEADERS,
          params: { limit: 10 },
        });
        messages = resp?.data || resp || [];
        // Filter to only this conversation
        messages = (Array.isArray(messages) ? messages : []).filter(
          (m) => String(m.conversation_id) === String(conversation_id)
        );
      }

      const sinceEpoch = since || 0;

      // Filter to inbound messages received after the 'since' timestamp.
      // Salesmsg message fields (from Pipedream component test events):
      //   body / body_raw = message text
      //   received_at = when received (inbound)
      //   sent_at = when sent (outbound)
      //   created_at = creation timestamp
      //   contact.number = sender phone
      //   source = message source
      //   type = message type
      // Inbound detection: received_at is set, or source indicates incoming
      const inbound = (Array.isArray(messages) ? messages : [])
        .filter((m) => {
          // Inbound messages have received_at set and no sent_at,
          // or the user_id is null/absent (system/contact messages)
          const isInbound = m.received_at || !m.user_id;
          const msgTime = new Date(m.created_at || m.received_at).getTime() / 1000;
          return isInbound && msgTime > sinceEpoch;
        })
        .sort(
          (a, b) =>
            new Date(b.created_at) - new Date(a.created_at)
        );

      if (inbound.length > 0) {
        const latest = inbound[0];
        await $.respond({
          status: 200,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            reply: latest.body || latest.body_raw,
            from: latest.contact?.number || latest.contact?.formatted_number || null,
            timestamp: latest.created_at || latest.received_at,
          }),
        });
      } else {
        await $.respond({
          status: 200,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reply: null }),
        });
      }
    } catch (err) {
      const errMsg =
        err.response?.data?.message ||
        err.response?.data?.error ||
        err.message ||
        "Unknown error";

      await $.respond({
        status: 500,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          success: false,
          error: `Failed to poll messages: ${errMsg}`,
        }),
      });
    }
  },
});
