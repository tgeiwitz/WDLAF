/**
 * WDLAF Workflow 8: Task Status Change
 *
 * Pipedream workflow that changes the status of a WooDelivery task.
 *
 * Setup:
 *   1. Create a new Pipedream workflow
 *   2. Add trigger: "HTTP / Webhook" → Return a custom response
 *   3. Add a Node.js code step and paste this entire file
 *   4. Set environment variables in Pipedream:
 *      - WOODELIVERY_API_KEY  (API key from WooDelivery Settings → Integrations)
 *   5. Deploy and copy the webhook trigger URL to your .env as PIPEDREAM_TASK_STATUS_URL
 *
 * API reference (WooDelivery / Wodely):
 *   Base URL: https://api.woodelivery.com
 *   Auth: Authorization: Basic {api_key}
 *   Swagger: https://api.woodelivery.com/swagger/index.html
 *   Change status: PUT /v2/task/status  body: { guid, statusId }
 *
 * Incoming POST body:
 *   { "taskGuid": "existing-task-guid", "statusId": "3" }
 *
 * Status IDs (verify against your WooDelivery account):
 *   0 = Unassigned
 *   1 = Assigned
 *   2 = In Progress / Started
 *   3 = Completed / Successful
 *   4 = Cancelled
 *   5 = Failed
 *
 * Returns:
 *   { "success": true, "task_id": "guid", "new_status": "3" }
 */

import { axios } from "@pipedream/platform";

export default defineComponent({
  async run({ steps, $ }) {
    const WOODELIVERY_API_KEY = process.env.WOODELIVERY_API_KEY;
    const BASE_URL = "https://api.woodelivery.com";

    const { taskGuid, statusId } = steps.trigger.event.body;

    if (!taskGuid || statusId === undefined || statusId === null) {
      await $.respond({
        status: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          success: false,
          error: "Missing required fields: 'taskGuid' and 'statusId'",
        }),
      });
      return;
    }

    try {
      await axios($, {
        method: "PUT",
        url: `${BASE_URL}/v2/task/status`,
        headers: {
          Authorization: `Basic ${WOODELIVERY_API_KEY}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        data: {
          guid: taskGuid,
          statusId: parseInt(statusId, 10),
        },
      });

      await $.respond({
        status: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          success: true,
          task_id: taskGuid,
          new_status: String(statusId),
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
          error: `Failed to change task status: ${errMsg}`,
        }),
      });
    }
  },
});
