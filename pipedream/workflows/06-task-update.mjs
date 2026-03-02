/**
 * WDLAF Workflow 6: Task Update
 *
 * Pipedream workflow that updates an existing delivery task in WooDelivery.
 *
 * Setup:
 *   1. Create a new Pipedream workflow
 *   2. Add trigger: "HTTP / Webhook" → Return a custom response
 *   3. Add a Node.js code step and paste this entire file
 *   4. Set environment variables in Pipedream:
 *      - WOODELIVERY_API_KEY  (API key from WooDelivery Settings → Integrations)
 *   5. Deploy and copy the webhook trigger URL to your .env as PIPEDREAM_TASK_UPDATE_URL
 *
 * API reference (WooDelivery / Wodely):
 *   Base URL: https://api.woodelivery.com
 *   Auth: Authorization: Basic {api_key}
 *   Swagger: https://api.woodelivery.com/swagger/index.html
 *   Update task: PUT /v2/task  (JSON body with guid + updated fields)
 *
 * Incoming POST body:
 *   {
 *     "TaskGuid": "existing-task-guid",               (required)
 *     "destinationAddress": "789 New Address",         (optional — any updatable field)
 *     "recipientPhone": "+15559999999",                (optional)
 *     "destinationNotes": "Updated: use side entrance" (optional)
 *   }
 *
 * Returns:
 *   { "success": true, "task_id": "existing-task-guid" }
 */

import { axios } from "@pipedream/platform";

export default defineComponent({
  async run({ steps, $ }) {
    const WOODELIVERY_API_KEY = process.env.WOODELIVERY_API_KEY;
    const BASE_URL = "https://api.woodelivery.com";

    const body = steps.trigger.event.body;
    const taskGuid = body.TaskGuid;

    if (!taskGuid) {
      await $.respond({
        status: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          success: false,
          error: "Missing required field: 'TaskGuid'",
        }),
      });
      return;
    }

    try {
      // Build update payload — include TaskGuid + all update fields
      const updateData = { ...body };
      // Ensure the guid field name matches what WooDelivery expects
      updateData.guid = taskGuid;

      const resp = await axios($, {
        method: "PUT",
        url: `${BASE_URL}/v2/task`,
        headers: {
          Authorization: `Basic ${WOODELIVERY_API_KEY}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        data: updateData,
      });

      await $.respond({
        status: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          success: true,
          task_id: taskGuid,
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
          error: `Failed to update task: ${errMsg}`,
        }),
      });
    }
  },
});
