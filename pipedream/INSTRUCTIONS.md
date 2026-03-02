# Pipedream Workflow Build Instructions

## Context

These instructions are for building Pipedream workflows that serve as the integration layer for the WDLAF dispatch agent. The agent (a Python application) calls these workflows via HTTP POST to their webhook trigger URLs. Each workflow connects to either **Salesmsg** (SMS platform) or **WooDelivery** (delivery task management).

**Important conventions:**
- Every workflow uses an **HTTP Webhook trigger** (receives JSON POST)
- Every workflow **returns a JSON response** to the caller (not fire-and-forget)
- All workflows should include basic error handling that returns `{"success": false, "error": "description"}` on failure
- All successful responses must include `{"success": true, ...}`
- Connect your Salesmsg and WooDelivery accounts in Pipedream before building

---

## Workflow 1: SMS Send

**Name:** `wdlaf-sms-send`
**Purpose:** Send an SMS message to a phone number via Salesmsg

### Trigger
HTTP Webhook (POST, return custom response)

### Incoming request body
```json
{
  "to": "+15551234567",
  "message": "Your delivery is on the way."
}
```

### Steps

1. **Trigger:** HTTP Webhook — accept POST, extract `steps.trigger.event.body`
2. **Send SMS:** Use the **Salesmsg — Send SMS** action
   - **Send To:** `{{steps.trigger.event.body.to}}`
   - **Message:** `{{steps.trigger.event.body.message}}`
   - Leave "Send From" blank (uses default Salesmsg number)
3. **Return response:** Use the HTTP Response step to return:
```json
{
  "success": true,
  "conversation_id": "{{steps.send_sms.$return_value.data.conversation_id}}",
  "message_id": "{{steps.send_sms.$return_value.data.id}}"
}
```

### Error handling
If the Salesmsg step fails, return:
```json
{
  "success": false,
  "error": "Failed to send SMS: <error message>"
}
```

### Notes
- The `conversation_id` in the response is critical — the agent uses it to poll for replies in the approval flow
- This workflow is also used by the approval system to send approval request messages to Todd

---

## Workflow 2: SMS Receive (Poll for Reply)

**Name:** `wdlaf-sms-receive`
**Purpose:** Check for new inbound SMS replies on a conversation, used by the agent to poll for Todd's approval response

### Trigger
HTTP Webhook (POST, return custom response)

### Incoming request body
```json
{
  "conversation_id": "abc123",
  "since": 1709300000.0
}
```

### Steps

1. **Trigger:** HTTP Webhook — accept POST
2. **Fetch messages:** Use the **Salesmsg API Request** action (or a custom code step with the Salesmsg API) to get recent inbound messages for the conversation
   - **Endpoint:** `GET /conversations/{conversation_id}/messages`
   - Filter to messages received after the `since` timestamp (Unix epoch)
   - Filter to **inbound** messages only (direction = "in")
3. **Extract reply:** In a code step, find the most recent inbound message:
```javascript
export default defineComponent({
  async run({ steps }) {
    const messages = steps.fetch_messages.$return_value?.data || [];
    const sinceEpoch = steps.trigger.event.body.since || 0;

    const inbound = messages
      .filter(m => m.direction === "in")
      .filter(m => new Date(m.created_at).getTime() / 1000 > sinceEpoch)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    if (inbound.length > 0) {
      return { reply: inbound[0].body, from: inbound[0].from, timestamp: inbound[0].created_at };
    }
    return { reply: null };
  }
});
```
4. **Return response:**
   - If a reply was found:
```json
{
  "reply": "YES looks good",
  "from": "+15559876543",
  "timestamp": "2026-03-02T14:30:00Z"
}
```
   - If no reply yet:
```json
{
  "reply": null
}
```

### Notes
- The agent polls this every 10 seconds waiting for Todd's YES/NO response
- The agent parses the `reply` field — it expects the raw message text
- If `reply` is null or missing, the agent keeps polling until timeout (5 minutes)

---

## Workflow 3: SMS Lookup Contact

**Name:** `wdlaf-sms-lookup-contact`
**Purpose:** Search for a contact in Salesmsg by name, phone, or email

### Trigger
HTTP Webhook (POST, return custom response)

### Incoming request body
```json
{
  "query": "+15551234567"
}
```
The query can be a phone number, name, or email address.

### Steps

1. **Trigger:** HTTP Webhook — accept POST
2. **Search contacts:** Use the **Salesmsg — Find Contact** action
   - **Search by:** `{{steps.trigger.event.body.query}}`
3. **Return response:**
```json
{
  "success": true,
  "contacts": [
    {
      "id": "123",
      "first_name": "Jane",
      "last_name": "Doe",
      "phone": "+15551234567",
      "email": "jane@example.com",
      "tags": ["driver", "active"],
      "custom_fields": {
        "role": "driver",
        "task_id": "abc-123"
      }
    }
  ]
}
```

### Error handling
Return `{"success": false, "contacts": [], "error": "..."}` on failure.

---

## Workflow 4: SMS Create/Update Contact

**Name:** `wdlaf-sms-create-contact`
**Purpose:** Create a new contact or update an existing one in Salesmsg

### Trigger
HTTP Webhook (POST, return custom response)

### Incoming request body
```json
{
  "number": "+15551234567",
  "first_name": "Jane",
  "last_name": "Doe",
  "email": "jane@example.com",
  "tags": ["customer"],
  "custom.role": "customer",
  "custom.delivery_address": "123 Main St",
  "custom.merchant": "Acme Florist",
  "custom.order_number": "ORD-456",
  "custom.task_id": "task-789",
  "custom.tracking_link": "https://track.example.com/abc",
  "custom.delivery_date": "2026-03-05"
}
```
All fields except `number` are optional. Only include fields that are present in the request body.

### Steps

1. **Trigger:** HTTP Webhook — accept POST
2. **Create/update contact:** Use the **Salesmsg — Create or Update Contact** action
   - Map each field from the request body to the corresponding Salesmsg field
   - **Phone Number:** `{{steps.trigger.event.body.number}}`
   - **First Name:** `{{steps.trigger.event.body.first_name}}`
   - **Last Name:** `{{steps.trigger.event.body.last_name}}`
   - **Email:** `{{steps.trigger.event.body.email}}`
   - **Tags:** `{{steps.trigger.event.body.tags}}`
   - **Custom fields:** Map any `custom.*` fields to their Salesmsg custom field equivalents
3. **Return response:**
```json
{
  "success": true,
  "contact_id": "123",
  "phone": "+15551234567"
}
```

---

## Workflow 5: Task Create

**Name:** `wdlaf-task-create`
**Purpose:** Create a new delivery or pickup task in WooDelivery

### Trigger
HTTP Webhook (POST, return custom response)

### Incoming request body
```json
{
  "recipientName": "Jane Doe",
  "recipientPhone": "+15551234567",
  "destinationAddress": "456 Oak Ave, Austin TX 78701",
  "dispatchAddress": "123 Warehouse Blvd, Austin TX 78702",
  "destinationNotes": "Leave at front door, ring doorbell",
  "externalKey": "ORD-789",
  "merchantId": "merchant-abc",
  "beforeDateTime": "2026-03-02T17:00:00",
  "afterDateTime": "2026-03-02T09:00:00"
}
```
Only `recipientName`, `recipientPhone`, and `destinationAddress` are always present. All other fields are optional — only pass them to WooDelivery if they have a value.

### Steps

1. **Trigger:** HTTP Webhook — accept POST
2. **Create task:** Use the **WooDelivery — Create Task** action
   - **Recipient Name:** `{{steps.trigger.event.body.recipientName}}`
   - **Recipient Phone:** `{{steps.trigger.event.body.recipientPhone}}`
   - **Destination Address:** `{{steps.trigger.event.body.destinationAddress}}`
   - **Dispatch Address:** `{{steps.trigger.event.body.dispatchAddress}}` (if present)
   - **Delivery Notes:** `{{steps.trigger.event.body.destinationNotes}}` (if present)
   - **Reference Number:** `{{steps.trigger.event.body.externalKey}}` (if present)
   - **Merchant ID:** `{{steps.trigger.event.body.merchantId}}` (if present)
   - **Complete Before:** `{{steps.trigger.event.body.beforeDateTime}}` (if present)
   - **Complete After:** `{{steps.trigger.event.body.afterDateTime}}` (if present)
3. **Return response:**
```json
{
  "success": true,
  "task_id": "guid-from-woodelivery",
  "reference": "ORD-789",
  "tracking_link": "https://app.woodelivery.com/track/..."
}
```

### Error handling
Return `{"success": false, "error": "..."}` on failure.

---

## Workflow 6: Task Update

**Name:** `wdlaf-task-update`
**Purpose:** Update fields on an existing WooDelivery task

### Trigger
HTTP Webhook (POST, return custom response)

### Incoming request body
```json
{
  "TaskGuid": "existing-task-guid",
  "destinationAddress": "789 New Address, Austin TX 78703",
  "recipientPhone": "+15559999999",
  "destinationNotes": "Updated: use side entrance"
}
```
`TaskGuid` is always present. All other fields are optional — only the fields included should be updated.

### Steps

1. **Trigger:** HTTP Webhook — accept POST
2. **Parse fields:** In a code step, separate `TaskGuid` from the update fields:
```javascript
export default defineComponent({
  async run({ steps }) {
    const body = steps.trigger.event.body;
    const taskGuid = body.TaskGuid;
    const updates = { ...body };
    delete updates.TaskGuid;
    return { taskGuid, updates };
  }
});
```
3. **Update task:** Use the **WooDelivery — Update Task** action
   - **Task ID:** `{{steps.parse_fields.taskGuid}}`
   - Map each field from `{{steps.parse_fields.updates}}` to the corresponding WooDelivery field
   - Supported update fields: `recipientName`, `recipientPhone`, `recipientEmail`, `destinationAddress`, `destinationBuilding`, `destinationNotes`, `dispatchAddress`, `dispatchBuilding`, `dispatchNotes`, `externalKey`, `merchantId`, `beforeDateTime`, `amountDue`, `deliveryFee`, `capacity`, `requirements`, `skills`, `tag1`-`tag5`, `taskDesc`
4. **Return response:**
```json
{
  "success": true,
  "task_id": "existing-task-guid"
}
```

---

## Workflow 7: Task Lookup

**Name:** `wdlaf-task-lookup`
**Purpose:** Look up a delivery task by task ID or reference number

### Trigger
HTTP Webhook (POST, return custom response)

### Incoming request body
```json
{
  "task_id": "some-task-guid",
  "reference": "ORD-789"
}
```
One or both fields will be provided. Prefer `task_id` if both are present.

### Steps

1. **Trigger:** HTTP Webhook — accept POST
2. **Lookup task:** Use the **WooDelivery API** (custom HTTP request step) to fetch task details
   - If `task_id` is provided: `GET /api/v1/tasks/{task_id}`
   - If only `reference` is provided: `GET /api/v1/tasks?externalKey={reference}`
   - Use your WooDelivery API key in the Authorization header
3. **Format response:** In a code step, normalize the response:
```javascript
export default defineComponent({
  async run({ steps }) {
    const task = steps.lookup_task.$return_value?.data;
    if (!task) {
      return {
        success: false,
        error: "Task not found"
      };
    }
    return {
      success: true,
      task: {
        id: task.guid || task.taskGuid,
        reference: task.externalKey,
        status: task.statusName || task.status,
        recipient_name: task.recipientName,
        recipient_phone: task.recipientPhone,
        destination_address: task.destinationAddress,
        dispatch_address: task.dispatchAddress,
        delivery_notes: task.destinationNotes,
        assigned_driver: task.driverName || null,
        before_datetime: task.beforeDateTime,
        after_datetime: task.afterDateTime,
        tracking_link: task.trackingLink || null
      }
    };
  }
});
```
4. **Return response:**
```json
{
  "success": true,
  "task": {
    "id": "task-guid",
    "reference": "ORD-789",
    "status": "Assigned",
    "recipient_name": "Jane Doe",
    "recipient_phone": "+15551234567",
    "destination_address": "456 Oak Ave, Austin TX 78701",
    "dispatch_address": "123 Warehouse Blvd, Austin TX 78702",
    "delivery_notes": "Leave at front door",
    "assigned_driver": "Mike",
    "before_datetime": "2026-03-02T17:00:00",
    "after_datetime": "2026-03-02T09:00:00",
    "tracking_link": "https://track.example.com/abc"
  }
}
```

### Error handling
Return `{"success": false, "error": "Task not found"}` if no match.

---

## Workflow 8: Task Status Change

**Name:** `wdlaf-task-status-change`
**Purpose:** Change the status of a WooDelivery task (e.g. assigned, in-progress, completed, cancelled)

### Trigger
HTTP Webhook (POST, return custom response)

### Incoming request body
```json
{
  "taskGuid": "existing-task-guid",
  "statusId": "3"
}
```

### WooDelivery status IDs (for reference)
| Status ID | Meaning         |
|-----------|-----------------|
| 0         | Unassigned      |
| 1         | Assigned        |
| 2         | In Progress     |
| 3         | Completed       |
| 4         | Cancelled       |
| 5         | Failed          |

Verify these against your WooDelivery account — they may differ.

### Steps

1. **Trigger:** HTTP Webhook — accept POST
2. **Change status:** Use the **WooDelivery — Change Task Status** action
   - **Task ID:** `{{steps.trigger.event.body.taskGuid}}`
   - **Status ID:** `{{steps.trigger.event.body.statusId}}`
3. **Return response:**
```json
{
  "success": true,
  "task_id": "existing-task-guid",
  "new_status": "3"
}
```

---

## Setup Checklist

After building all 8 workflows:

1. [ ] Connect Salesmsg account in Pipedream
2. [ ] Connect WooDelivery account in Pipedream (API key)
3. [ ] Deploy all workflows
4. [ ] Copy each workflow's webhook trigger URL
5. [ ] Set the URLs in the agent's `.env` file:

```
PIPEDREAM_SMS_SEND_URL=<wdlaf-sms-send webhook URL>
PIPEDREAM_SMS_RECEIVE_URL=<wdlaf-sms-receive webhook URL>
PIPEDREAM_SMS_LOOKUP_CONTACT_URL=<wdlaf-sms-lookup-contact webhook URL>
PIPEDREAM_SMS_CREATE_CONTACT_URL=<wdlaf-sms-create-contact webhook URL>
PIPEDREAM_TASK_CREATE_URL=<wdlaf-task-create webhook URL>
PIPEDREAM_TASK_UPDATE_URL=<wdlaf-task-update webhook URL>
PIPEDREAM_TASK_LOOKUP_URL=<wdlaf-task-lookup webhook URL>
PIPEDREAM_TASK_STATUS_URL=<wdlaf-task-status-change webhook URL>
```

6. [ ] Set Todd's phone number: `TODD_PHONE_NUMBER=+1XXXXXXXXXX`
7. [ ] Test each workflow individually by sending a test POST to its webhook URL
8. [ ] Test the full approval loop: trigger an action → verify Todd gets SMS → reply YES → verify action executes

## Testing Each Workflow

Use curl to test each workflow after deployment:

```bash
# Test SMS Send
curl -X POST <WEBHOOK_URL> \
  -H "Content-Type: application/json" \
  -d '{"to": "+15551234567", "message": "Test from WDLAF"}'

# Test SMS Receive (poll)
curl -X POST <WEBHOOK_URL> \
  -H "Content-Type: application/json" \
  -d '{"conversation_id": "test-convo-id", "since": 0}'

# Test Contact Lookup
curl -X POST <WEBHOOK_URL> \
  -H "Content-Type: application/json" \
  -d '{"query": "+15551234567"}'

# Test Task Create
curl -X POST <WEBHOOK_URL> \
  -H "Content-Type: application/json" \
  -d '{"recipientName": "Test User", "recipientPhone": "+15551234567", "destinationAddress": "123 Test St"}'

# Test Task Lookup
curl -X POST <WEBHOOK_URL> \
  -H "Content-Type: application/json" \
  -d '{"reference": "ORD-TEST"}'

# Test Task Status Change
curl -X POST <WEBHOOK_URL> \
  -H "Content-Type: application/json" \
  -d '{"taskGuid": "test-guid", "statusId": "1"}'
```
