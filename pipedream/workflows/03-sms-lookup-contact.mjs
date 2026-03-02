/**
 * WDLAF Workflow 3: SMS Lookup Contact
 *
 * Pipedream workflow that searches for a contact in Salesmsg.
 *
 * Setup:
 *   1. Create a new Pipedream workflow
 *   2. Add trigger: "HTTP / Webhook" → Return a custom response
 *   3. Add a Node.js code step and paste this entire file
 *   4. Set environment variables in Pipedream:
 *      - SALESMSG_API_TOKEN  (Personal Access Token)
 *   5. Deploy and copy the webhook trigger URL to your .env as PIPEDREAM_SMS_LOOKUP_CONTACT_URL
 *
 * API reference (Salesmsg):
 *   List contacts: GET /contacts?page=1  (page-based pagination)
 *   Search: GET /conversations/search?term={query}&type=contacts
 *   Contact fields: id, first_name, last_name, full_name, email, number,
 *                   tags[{id, name, label}], custom_fields[{field_key, text, value}]
 *   Postman collection: https://documenter.getpostman.com/view/13798866/2s935uHgXp
 *
 * Incoming POST body:
 *   { "query": "+15551234567" }       (phone number)
 *   { "query": "Jane Doe" }           (name)
 *   { "query": "jane@example.com" }   (email)
 *
 * Returns:
 *   { "success": true, "contacts": [{ id, first_name, last_name, phone, email, tags }] }
 */

import { axios } from "@pipedream/platform";

export default defineComponent({
  async run({ steps, $ }) {
    const SALESMSG_API_TOKEN = process.env.SALESMSG_API_TOKEN;
    const BASE_URL = "https://api.salesmessage.com/pub/v2.1";

    const { query } = steps.trigger.event.body;

    if (!query) {
      await $.respond({
        status: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          success: false,
          contacts: [],
          error: "Missing required field: 'query'",
        }),
      });
      return;
    }

    try {
      // Search via conversations/search endpoint (searches name, email, number, tag)
      const resp = await axios($, {
        method: "GET",
        url: `${BASE_URL}/conversations/search`,
        headers: {
          Authorization: `Bearer ${SALESMSG_API_TOKEN}`,
          Accept: "application/json",
        },
        params: {
          term: query,
          type: "contacts",
          page: 1,
        },
      });

      const rawResults = resp?.data || resp || [];
      // conversations/search returns conversation objects with nested contact data
      // Extract unique contacts from the results
      const seen = new Set();
      const contacts = (Array.isArray(rawResults) ? rawResults : [])
        .map((item) => {
          // Result may be a conversation with contact, or a contact directly
          const c = item.contact || item;
          if (!c.id || seen.has(c.id)) return null;
          seen.add(c.id);
          return {
            id: String(c.id),
            first_name: c.first_name || "",
            last_name: c.last_name || "",
            phone: c.number || "",
            email: c.email || "",
            tags: (c.tags || []).map((t) => (typeof t === "string" ? t : t.name || t.label)),
            custom_fields: c.custom_fields || {},
          };
        })
        .filter(Boolean);

      await $.respond({
        status: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ success: true, contacts }),
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
          contacts: [],
          error: `Failed to lookup contact: ${errMsg}`,
        }),
      });
    }
  },
});
