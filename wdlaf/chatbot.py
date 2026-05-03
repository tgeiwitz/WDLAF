import json
from anthropic import Anthropic
from wdlaf.woodelivery import WooDeliveryClient

TOOLS = [
    {
        "name": "list_tasks",
        "description": "List delivery tasks. Can filter by status (Unassigned, Assigned, InTransit, Completed, Failed, Returned). Supports pagination.",
        "input_schema": {
            "type": "object",
            "properties": {
                "page": {"type": "integer", "description": "Page number (default 1)", "default": 1},
                "page_size": {"type": "integer", "description": "Results per page (default 20)", "default": 20},
                "status": {
                    "type": "string",
                    "description": "Filter by status",
                    "enum": ["Unassigned", "Assigned", "InTransit", "Completed", "Failed", "Returned"],
                },
            },
            "required": [],
        },
    },
    {
        "name": "get_task",
        "description": "Get details of a specific delivery task by its ID.",
        "input_schema": {
            "type": "object",
            "properties": {
                "task_id": {"type": "string", "description": "The task ID to look up"},
            },
            "required": ["task_id"],
        },
    },
    {
        "name": "create_task",
        "description": "Create a new delivery task.",
        "input_schema": {
            "type": "object",
            "properties": {
                "description": {"type": "string", "description": "Task description / order details"},
                "recipient_name": {"type": "string", "description": "Customer name"},
                "recipient_phone": {"type": "string", "description": "Customer phone"},
                "recipient_email": {"type": "string", "description": "Customer email"},
                "destination_address": {"type": "string", "description": "Delivery address"},
                "destination_building": {"type": "string", "description": "Building name/number"},
                "delivery_notes": {"type": "string", "description": "Special delivery instructions"},
                "dispatch_address": {"type": "string", "description": "Pickup/origin address"},
                "dispatch_building": {"type": "string", "description": "Pickup building details"},
                "dispatch_notes": {"type": "string", "description": "Notes for pickup"},
                "sender_name": {"type": "string", "description": "Sender name"},
                "sender_phone": {"type": "string", "description": "Sender phone"},
                "sender_email": {"type": "string", "description": "Sender email"},
                "due_amount": {"type": "number", "description": "COD amount due"},
                "shipping_fee": {"type": "number", "description": "Delivery fee"},
                "external_key": {"type": "string", "description": "External reference ID"},
                "action": {"type": "string", "description": "Task type (e.g. delivery, pickup)"},
            },
            "required": ["description"],
        },
    },
    {
        "name": "update_task",
        "description": "Update an existing delivery task. Provide the task ID and any fields to change. Can update status to: Unassigned, Assigned, InTransit, Completed, Failed, Returned.",
        "input_schema": {
            "type": "object",
            "properties": {
                "task_id": {"type": "string", "description": "The task ID to update"},
                "description": {"type": "string", "description": "New task description"},
                "status": {
                    "type": "string",
                    "description": "New status",
                    "enum": ["Unassigned", "Assigned", "InTransit", "Completed", "Failed", "Returned"],
                },
                "recipient_name": {"type": "string"},
                "recipient_phone": {"type": "string"},
                "recipient_email": {"type": "string"},
                "destination_address": {"type": "string"},
                "destination_building": {"type": "string"},
                "delivery_notes": {"type": "string"},
                "dispatch_address": {"type": "string"},
                "dispatch_building": {"type": "string"},
                "dispatch_notes": {"type": "string"},
                "sender_name": {"type": "string"},
                "sender_phone": {"type": "string"},
                "sender_email": {"type": "string"},
                "due_amount": {"type": "number"},
                "shipping_fee": {"type": "number"},
                "external_key": {"type": "string"},
                "action": {"type": "string"},
            },
            "required": ["task_id"],
        },
    },
    {
        "name": "delete_task",
        "description": "Delete a delivery task by its ID. This is permanent.",
        "input_schema": {
            "type": "object",
            "properties": {
                "task_id": {"type": "string", "description": "The task ID to delete"},
            },
            "required": ["task_id"],
        },
    },
    {
        "name": "test_auth",
        "description": "Test whether the WooDelivery API connection and credentials are working.",
        "input_schema": {
            "type": "object",
            "properties": {},
            "required": [],
        },
    },
]

SYSTEM_PROMPT = """\
You are a WooDelivery task management assistant. You help users manage their delivery tasks through natural conversation.

You can:
- List tasks (optionally filtered by status)
- View task details
- Create new delivery tasks
- Update existing tasks (change status, address, recipient info, etc.)
- Delete tasks
- Test the API connection

Task statuses: Unassigned, Assigned, InTransit, Completed, Failed, Returned.

When the user asks to do something, use the appropriate tool. If they're vague, ask for clarification.
When showing task data, format it in a readable way. Keep responses concise and helpful.
If an API call fails, explain the error clearly and suggest what to do.\
"""


class ChatBot:
    def __init__(self, anthropic_api_key: str, woodelivery_api_key: str, model: str = "claude-sonnet-4-20250514"):
        self.client = Anthropic(api_key=anthropic_api_key)
        self.wd = WooDeliveryClient(woodelivery_api_key)
        self.model = model
        self.messages: list[dict] = []

    def _execute_tool(self, name: str, input_args: dict) -> str:
        dispatch = {
            "list_tasks": lambda args: self.wd.list_tasks(
                page=args.get("page", 1),
                page_size=args.get("page_size", 20),
                status=args.get("status"),
            ),
            "get_task": lambda args: self.wd.get_task(args["task_id"]),
            "create_task": lambda args: self.wd.create_task(**args),
            "update_task": lambda args: self.wd.update_task(
                args.pop("task_id"), **args
            ),
            "delete_task": lambda args: self.wd.delete_task(args["task_id"]),
            "test_auth": lambda _: self.wd.test_auth(),
        }
        handler = dispatch.get(name)
        if not handler:
            return json.dumps({"error": f"Unknown tool: {name}"})
        try:
            result = handler(dict(input_args))
            return json.dumps(result, indent=2, default=str)
        except Exception as e:
            return json.dumps({"error": str(e)})

    def chat(self, user_message: str) -> str:
        self.messages.append({"role": "user", "content": user_message})

        while True:
            response = self.client.messages.create(
                model=self.model,
                max_tokens=4096,
                system=[{"type": "text", "text": SYSTEM_PROMPT, "cache_control": {"type": "ephemeral"}}],
                tools=TOOLS,
                messages=self.messages,
            )

            if response.stop_reason == "tool_use":
                self.messages.append({"role": "assistant", "content": response.content})
                tool_results = []
                for block in response.content:
                    if block.type == "tool_use":
                        result = self._execute_tool(block.name, block.input)
                        tool_results.append({
                            "type": "tool_result",
                            "tool_use_id": block.id,
                            "content": result,
                        })
                self.messages.append({"role": "user", "content": tool_results})
                continue

            text_parts = [block.text for block in response.content if block.type == "text"]
            assistant_text = "\n".join(text_parts)
            self.messages.append({"role": "assistant", "content": response.content})
            return assistant_text
