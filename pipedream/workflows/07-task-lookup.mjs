/**
 * WDLAF Workflow 7: Task Lookup
 *
 * Pipedream workflow that looks up a delivery task in WooDelivery by ID or reference.
 *
 * Setup:
 *   1. Create a new Pipedream workflow
 *   2. Add trigger: "HTTP / Webhook" → Return a custom response
 *   3. Add a Node.js code step and paste this entire file
 *   4. Set environment variables in Pipedream:
 *      - WOODELIVERY_API_KEY  (API key from WooDelivery Settings → Integrations)
 *   5. Deploy and copy the webhook trigger URL to your .env as PIPEDREAM_TASK_LOOKUP_URL
 *
 * API reference (WooDelivery / Wodely):
 *   Base URL: https://api.woodelivery.com
 *   Auth: Authorization: Basic {api_key}
 *   Swagger: https://api.woodelivery.com/swagger/index.html
 *   Get task by ID: GET /v2/task/{guid}
 *   Search tasks: GET /v2/task?externalKey={reference}
 *
 * Incoming POST body:
 *   { "task_id": "some-task-guid" }         (lookup by GUID)
 *   { "reference": "ORD-789" }              (lookup by external key)
 *   { "task_id": "guid", "reference": "X" } (task_id takes priority)
 *
 * Returns:
 *   {
 *     "success": true,
 *     "task": {
 *       "id": "guid", "reference": "ORD-789", "status": "Assigned",
 *       "recipient_name": "Jane", "recipient_phone": "+155...",
 *       "destination_address": "...", "dispatch_address": "...",
 *       "delivery_notes": "...", "assigned_driver": "Mike",
 *       "before_datetime": "...", "after_datetime": "...",
 *       "tracking_link": "..."
 *     }
 *   }
 */

import { axios } from "@pipedream/platform";

export default defineComponent({
  async run({ steps, $ }) {
    const WOODELIVERY_API_KEY = process.env.WOODELIVERY_API_KEY;
    const BASE_URL = "https://api.woodelivery.com";

    const { task_id, reference } = steps.trigger.event.body;

    if (!task_id && !reference) {
      await $.respond({
        status: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          success: false,
          error: "Provide at least one of: 'task_id' or 'reference'",
        }),
      });
      return;
    }

    try {
      let task = null;

      if (task_id) {
        // Direct lookup by task GUID
        const resp = await axios($, {
          method: "GET",
          url: `${BASE_URL}/v2/task/${task_id}`,
          headers: {
            Authorization: `Basic ${WOODELIVERY_API_KEY}`,
            Accept: "application/json",
          },
        });
        task = resp?.data?.data || resp?.data || resp;
      }

      if (!task && reference) {
        // Search by external key / reference number
        const resp = await axios($, {
          method: "GET",
          url: `${BASE_URL}/v2/task`,
          headers: {
            Authorization: `Basic ${WOODELIVERY_API_KEY}`,
            Accept: "application/json",
          },
          params: {
            externalKey: reference,
          },
        });
        const results = resp?.data?.data || resp?.data || resp;
        task = Array.isArray(results) && results.length > 0 ? results[0] : null;
      }

      if (!task) {
        await $.respond({
          status: 200,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            success: false,
            error: "Task not found",
          }),
        });
        return;
      }

      // Normalize the response into the format the agent expects
      await $.respond({
        status: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          success: true,
          task: {
            id: task.guid || task.taskGuid || task.id || "",
            reference: task.externalKey || "",
            status: task.statusName || task.status || "",
            recipient_name: task.recipientName || "",
            recipient_phone: task.recipientPhone || "",
            destination_address: task.destinationAddress || "",
            dispatch_address: task.dispatchAddress || "",
            delivery_notes: task.destinationNotes || "",
            assigned_driver: task.driverName || task.assignedDriver || null,
            before_datetime: task.beforeDateTime || "",
            after_datetime: task.afterDateTime || "",
            tracking_link: task.trackingLink || task.tracking_link || null,
          },
        }),
      });
    } catch (err) {
      // 404 from WooDelivery means task not found
      if (err.response?.status === 404) {
        await $.respond({
          status: 200,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            success: false,
            error: "Task not found",
          }),
        });
        return;
      }

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
          error: `Failed to lookup task: ${errMsg}`,
        }),
      });
    }
  },
});
