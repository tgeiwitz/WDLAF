import requests


class WooDeliveryClient:
    def __init__(self, api_key: str, base_url: str = "https://api.woodelivery.com/v2"):
        self.base_url = base_url.rstrip("/")
        self.session = requests.Session()
        self.session.headers.update({
            "Authorization": f"Basic {api_key}",
            "Accept": "application/json",
            "Content-Type": "application/json",
        })

    def _url(self, path: str) -> str:
        return f"{self.base_url}/{path.lstrip('/')}"

    def _handle(self, resp: requests.Response) -> dict:
        try:
            resp.raise_for_status()
        except requests.HTTPError:
            try:
                detail = resp.json()
            except Exception:
                detail = resp.text
            return {"ok": False, "status": resp.status_code, "error": detail}
        try:
            return {"ok": True, "data": resp.json()}
        except Exception:
            return {"ok": True, "data": resp.text}

    def test_auth(self) -> dict:
        return self._handle(self.session.get(self._url("auth/test")))

    def list_tasks(self, page: int = 1, page_size: int = 20, status: str | None = None) -> dict:
        params: dict = {"page": page, "pageSize": page_size}
        if status:
            params["status"] = status
        return self._handle(self.session.get(self._url("Task"), params=params))

    def get_task(self, task_id: str) -> dict:
        return self._handle(self.session.get(self._url(f"Task/{task_id}")))

    def create_task(
        self,
        description: str,
        recipient_name: str | None = None,
        recipient_phone: str | None = None,
        recipient_email: str | None = None,
        destination_address: str | None = None,
        destination_building: str | None = None,
        delivery_notes: str | None = None,
        dispatch_address: str | None = None,
        dispatch_building: str | None = None,
        dispatch_notes: str | None = None,
        sender_name: str | None = None,
        sender_phone: str | None = None,
        sender_email: str | None = None,
        due_amount: float | None = None,
        shipping_fee: float | None = None,
        external_key: str | None = None,
        action: str | None = None,
    ) -> dict:
        body: dict = {"description": description}
        optional = {
            "recipientName": recipient_name,
            "recipientPhone": recipient_phone,
            "recipientEmail": recipient_email,
            "destinationAddress": destination_address,
            "destinationBuilding": destination_building,
            "deliveryNotes": delivery_notes,
            "dispatchAddress": dispatch_address,
            "dispatchBuilding": dispatch_building,
            "dispatchNotes": dispatch_notes,
            "senderName": sender_name,
            "senderPhone": sender_phone,
            "senderEmail": sender_email,
            "dueAmount": due_amount,
            "shippingFee": shipping_fee,
            "externalKey": external_key,
            "action": action,
        }
        body.update({k: v for k, v in optional.items() if v is not None})
        return self._handle(self.session.post(self._url("Task"), json=body))

    def update_task(self, task_id: str, **fields) -> dict:
        field_map = {
            "description": "description",
            "status": "status",
            "recipient_name": "recipientName",
            "recipient_phone": "recipientPhone",
            "recipient_email": "recipientEmail",
            "destination_address": "destinationAddress",
            "destination_building": "destinationBuilding",
            "delivery_notes": "deliveryNotes",
            "dispatch_address": "dispatchAddress",
            "dispatch_building": "dispatchBuilding",
            "dispatch_notes": "dispatchNotes",
            "sender_name": "senderName",
            "sender_phone": "senderPhone",
            "sender_email": "senderEmail",
            "due_amount": "dueAmount",
            "shipping_fee": "shippingFee",
            "external_key": "externalKey",
            "action": "action",
        }
        body = {}
        for py_name, api_name in field_map.items():
            if py_name in fields and fields[py_name] is not None:
                body[api_name] = fields[py_name]
        if not body:
            return {"ok": False, "error": "No fields to update"}
        return self._handle(self.session.put(self._url(f"Task/{task_id}"), json=body))

    def delete_task(self, task_id: str) -> dict:
        return self._handle(self.session.delete(self._url(f"Task/{task_id}")))
