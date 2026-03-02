/**
 * WDLAF Workflow 5: Task Create
 *
 * Pipedream workflow that creates a new delivery task in WooDelivery (Wodely).
 *
 * Setup:
 *   1. Create a new Pipedream workflow
 *   2. Add trigger: "HTTP / Webhook" → Return a custom response
 *   3. Add a Node.js code step and paste this entire file
 *   4. Set environment variables in Pipedream:
 *      - WOODELIVERY_API_KEY  (API key from WooDelivery Settings → Integrations)
 *   5. Deploy and copy the webhook trigger URL to your .env as PIPEDREAM_TASK_CREATE_URL
 *
 * API reference (WooDelivery / Wodely):
 *   Base URL: https://api.woodelivery.com
 *   Auth: Authorization: Basic {api_key}
 *   Swagger: https://api.woodelivery.com/swagger/index.html
 *   Create task: POST /v2/task  (JSON body)
 *   Rate limit: 10,000 requests/hour — use batch endpoint for bulk creates
 *
 * Incoming POST body:
 *   {
 *     "recipientName": "Jane Doe",                  (required)
 *     "recipientPhone": "+15551234567",              (required)
 *     "destinationAddress": "456 Oak Ave, Austin",   (required)
 *     "dispatchAddress": "123 Warehouse Blvd",       (optional)
 *     "destinationNotes": "Leave at front door",     (optional)
 *     "externalKey": "ORD-789",                      (optional)
 *     "merchantId": "merchant-abc",                  (optional)
 *     "beforeDateTime": "2026-03-02T17:00:00",       (optional)
 *     "afterDateTime": "2026-03-02T09:00:00"         (optional)
 *   }
 *
 * Returns:
 *   { "success": true, "task_id": "guid", "reference": "ORD-789", "tracking_link": "..." }
 */

import { axios } from "@pipedream/platform";

export default defineComponent({
  async run({ steps, $ }) {
    const WOODELIVERY_API_KEY = process.env.WOODELIVERY_API_KEY;
    const BASE_URL = "https://api.woodelivery.com";

    const body = steps.trigger.event.body;

    if (!body.recipientName || !body.recipientPhone || !body.destinationAddress) {
      await $.respond({
        status: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          success: false,
          error:
            "Missing required fields: 'recipientName', 'recipientPhone', 'destinationAddress'",
        }),
      });
      return;
    }

    try {
      // Build task payload — only include fields with values
      const taskData = {
        recipientName: body.recipientName,
        recipientPhone: body.recipientPhone,
        destinationAddress: body.destinationAddress,
      };

      if (body.dispatchAddress) taskData.dispatchAddress = body.dispatchAddress;
      if (body.destinationNotes) taskData.destinationNotes = body.destinationNotes;
      if (body.externalKey) taskData.externalKey = body.externalKey;
      if (body.merchantId) taskData.merchantId = body.merchantId;
      if (body.beforeDateTime) taskData.beforeDateTime = body.beforeDateTime;
      if (body.afterDateTime) taskData.afterDateTime = body.afterDateTime;

      const resp = await axios($, {
        method: "POST",
        url: `${BASE_URL}/v2/task`,
        headers: {
          Authorization: `Basic ${WOODELIVERY_API_KEY}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        data: taskData,
      });

      const result = resp?.data || resp || {};
      const task = result.data || result;

      await $.respond({
        status: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          success: true,
          task_id: task.guid || task.taskGuid || task.id || "",
          reference: body.externalKey || "",
          tracking_link: task.trackingLink || task.tracking_link || "",
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
          error: `Failed to create task: ${errMsg}`,
        }),
      });
    }
  },
});
