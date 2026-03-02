/**
 * WDLAF Workflow 4: SMS Create/Update Contact
 *
 * Pipedream workflow that creates or updates a contact in Salesmsg.
 *
 * Setup:
 *   1. Create a new Pipedream workflow
 *   2. Add trigger: "HTTP / Webhook" → Return a custom response
 *   3. Add a Node.js code step and paste this entire file
 *   4. Set environment variables in Pipedream:
 *      - SALESMSG_API_TOKEN  (Personal Access Token)
 *   5. Deploy and copy the webhook trigger URL to your .env as PIPEDREAM_SMS_CREATE_CONTACT_URL
 *
 * API reference (Salesmsg):
 *   Create contact: POST /contacts?number={phone}&first_name=...&last_name=...&email=...
 *   Note: Salesmsg create contact takes params as query parameters, not JSON body
 *   Fields: number (required), first_name, last_name, email, color_index, phone_type
 *   Response: { id, first_name, last_name, email, number, tags[], custom_fields[] }
 *   Postman collection: https://documenter.getpostman.com/view/13798866/2s935uHgXp
 *
 * Incoming POST body:
 *   {
 *     "number": "+15551234567",        (required)
 *     "first_name": "Jane",            (optional)
 *     "last_name": "Doe",              (optional)
 *     "email": "jane@example.com",     (optional)
 *     "tags": ["customer"],            (optional)
 *   }
 *
 * Returns:
 *   { "success": true, "contact_id": "123", "phone": "+15551234567" }
 */

import { axios } from "@pipedream/platform";

export default defineComponent({
  async run({ steps, $ }) {
    const SALESMSG_API_TOKEN = process.env.SALESMSG_API_TOKEN;
    const BASE_URL = "https://api.salesmessage.com/pub/v2.1";

    const body = steps.trigger.event.body;
    const phone = body.number;

    if (!phone) {
      await $.respond({
        status: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          success: false,
          error: "Missing required field: 'number' (phone number)",
        }),
      });
      return;
    }

    try {
      // Build contact params — Salesmsg create contact uses query parameters
      const contactParams = { number: phone };

      if (body.first_name) contactParams.first_name = body.first_name;
      if (body.last_name) contactParams.last_name = body.last_name;
      if (body.email) contactParams.email = body.email;

      const resp = await axios($, {
        method: "POST",
        url: `${BASE_URL}/contacts`,
        headers: {
          Authorization: `Bearer ${SALESMSG_API_TOKEN}`,
          Accept: "application/json",
        },
        params: contactParams,
      });

      const contact = resp?.data || resp || {};
      const contactId = String(contact.id || "");

      // Apply tags if provided
      const tags = body.tags || [];
      for (const tag of tags) {
        try {
          await axios($, {
            method: "POST",
            url: `${BASE_URL}/contacts/${contactId}/tags`,
            headers: {
              Authorization: `Bearer ${SALESMSG_API_TOKEN}`,
              "Content-Type": "application/json",
              Accept: "application/json",
            },
            data: { tag },
          });
        } catch (tagErr) {
          // Log but don't fail the whole operation for tag errors
          console.warn(`Failed to apply tag '${tag}': ${tagErr.message}`);
        }
      }

      await $.respond({
        status: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          success: true,
          contact_id: contactId,
          phone: phone,
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
          error: `Failed to create contact: ${errMsg}`,
        }),
      });
    }
  },
});
