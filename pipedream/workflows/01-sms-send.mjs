/**
 * WDLAF Workflow 1: SMS Send
 *
 * Pipedream workflow that sends an SMS via Salesmsg.
 *
 * Setup:
 *   1. Create a new Pipedream workflow
 *   2. Add trigger: "HTTP / Webhook" → Return a custom response
 *   3. Add a Node.js code step and paste this entire file
 *   4. Set environment variables in Pipedream:
 *      - SALESMSG_API_TOKEN  (Personal Access Token from Salesmsg Settings → Personal Access Token)
 *      - SALESMSG_INBOX_ID   (Your Salesmsg inbox/number ID — find in Settings → Inboxes)
 *   5. Deploy and copy the webhook trigger URL to your .env as PIPEDREAM_SMS_SEND_URL
 *
 * API reference (Salesmsg):
 *   Base URL: https://api.salesmessage.com/pub/v2.1
 *   Auth: Authorization: Bearer {PAT}
 *   Search conversations: GET /conversations/search?term={phone}&type=contacts
 *   Send to conversation: POST /pub/v2.2/messages/{conversation_id}  body: { "message": "..." }
 *   Create conversation + send: POST /conversations  body: { inbox_id, number, message }
 *   Postman collection: https://documenter.getpostman.com/view/13798866/2s935uHgXp
 *   Rate limit: 60 requests/min
 *
 * Incoming POST body:
 *   { "to": "+15551234567", "message": "Hello from WDLAF" }
 *
 * Returns:
 *   { "success": true, "conversation_id": "...", "message_id": "..." }
 */

import { axios } from "@pipedream/platform";

export default defineComponent({
  async run({ steps, $ }) {
    const TOKEN = process.env.SALESMSG_API_TOKEN;
    const INBOX_ID = process.env.SALESMSG_INBOX_ID;
    const BASE = "https://api.salesmessage.com/pub/v2.1";
    const HEADERS = {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    };

    const { to, message } = steps.trigger.event.body;

    if (!to || !message) {
      await $.respond({
        status: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          success: false,
          error: "Missing required fields: 'to' and 'message'",
        }),
      });
      return;
    }

    try {
      // Step 1: Search for an existing conversation with this phone number
      let conversationId = null;

      try {
        const searchResp = await axios($, {
          method: "GET",
          url: `${BASE}/conversations/search`,
          headers: HEADERS,
          params: { term: to, type: "contacts" },
        });

        const results = searchResp?.data || searchResp || [];
        if (Array.isArray(results) && results.length > 0) {
          conversationId = results[0].id;
        }
      } catch (searchErr) {
        // Search failed — fall through to create new conversation
        console.log(`Conversation search failed, will create new: ${searchErr.message}`);
      }

      // Step 2: Send the message
      let sendResp;

      if (conversationId) {
        // Send to existing conversation via v2.2 messages endpoint
        sendResp = await axios($, {
          method: "POST",
          url: `https://api.salesmessage.com/pub/v2.2/messages/${conversationId}`,
          headers: HEADERS,
          data: { message },
        });
      } else {
        // No existing conversation — create one and send the first message
        sendResp = await axios($, {
          method: "POST",
          url: `${BASE}/conversations`,
          headers: HEADERS,
          data: {
            inbox_id: parseInt(INBOX_ID),
            number: to,
            message,
          },
        });
      }

      const data = sendResp?.data || sendResp || {};
      const resultConvId = conversationId || data.conversation_id || data.id || null;
      const messageId = data.message_id || data.id || null;

      await $.respond({
        status: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          success: true,
          conversation_id: String(resultConvId),
          message_id: String(messageId),
        }),
      });
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
          error: `Failed to send SMS: ${errMsg}`,
        }),
      });
    }
  },
});
