'use strict';
const http = require('http');
const { classifyNotes } = require('./claude');
const { createWodelyTask } = require('./wodely');
const { calcDeliveryWindow, calcServiceId } = require('./datetime');
const { deduplicatePhones, buildDestinationAddress, buildDestinationBuilding, buildDispatchAddress, buildTaskDesc, buildPackages, buildTag2, buildTag5 } = require('./normalize');
const PORT = process.env.PORT || 3000;
const MERCHANT_ID = '09cc8b76-6b54-4995-b136-a5dea3f0656a';
const TEMPLATE_ID = 1981;
const OUTLET = {
  address_line_1: process.env.OUTLET_ADDRESS || '2004 17th St NW',
  address_line_2: process.env.OUTLET_BUILDING || 'Little Acre Flowers',
  city: process.env.OUTLET_CITY || 'Washington',
  postal_code: process.env.OUTLET_ZIP || 'DC 20009',
  country: process.env.OUTLET_COUNTRY || '',
  coordinates: process.env.OUTLET_COORDINATES || '',
};
async function handleWebhook(order) {
  const timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
  const tag5Flags = [];
  const deliveryDateStr = order?.zapiet_delivery?.delivery_date;
  if (!deliveryDateStr) throw new Error('Missing zapiet_delivery.delivery_date');
  const { afterDateTime, beforeDateTime, externalKey, tag5Flags: dateFlagsList, rescheduled } = calcDeliveryWindow(deliveryDateStr);
  tag5Flags.push(...dateFlagsList);
  const serviceId = calcServiceId(afterDateTime);
  const senderName = [order.customer?.first_name, order.customer?.last_name].filter(Boolean).join(' ');
  const recipientName = [order.shipping_address?.first_name, order.shipping_address?.last_name].filter(Boolean).join(' ');
  const { requesterPhone, recipientPhone, tag5Flags: phoneFlagsList } = deduplicatePhones(order.customer?.phone, order.shipping_address?.phone, senderName, recipientName);
  tag5Flags.push(...phoneFlagsList);
  tag5Flags.push('EMAIL_SUPPRESSED');
  const destinationAddress = buildDestinationAddress(order.shipping_address || {});
  const destinationBuilding = buildDestinationBuilding(order.shipping_address || {});
  const dispatchAddress = buildDispatchAddress(OUTLET);
  const totalPrice = parseFloat(order.financial_info?.total_price || 0);
  const subtotalPrice = parseFloat(order.financial_info?.subtotal_price || 0);
  const shippingFee = parseFloat(order.shipping_lines?.[0]?.price || 0);
  const isHighValue = totalPrice > 300;
  const priority = isHighValue ? 10 : 20;
  if (isHighValue) tag5Flags.push('HIGH_VALUE');
  const lineItemProperties = order.line_items?.[0]?.properties || [];
  const occasion = lineItemProperties.find(p => p.name === 'Occasion')?.value || null;
  const giftMessage = lineItemProperties.find(p => p.name === 'Gift Message' || p.name === 'gift_message')?.value || null;
  const noteAttributes = (order.note_attributes || []).map(a => ({ name: a.name, value: a.value }));
  const { destinationNotes, specialRequestNote, sentimentFlagged } = await classifyNotes({ orderNote: order.note || null, noteAttributes, giftMessage, occasion });
  if (sentimentFlagged) tag5Flags.push('SENTIMENT_FLAGGED');
  if (destinationNotes && order.note) tag5Flags.push('NOTE_ROUTED_TO_DEST');
  if (specialRequestNote) tag5Flags.push('NOTE_FLAGGED_REVIEW');
  const lineItems = order.line_items || [];
  const capacity = lineItems.reduce((sum, item) => sum + (item.quantity || 1), 0);
  const taskDesc = buildTaskDesc(lineItems);
  const orderNumber = String(order.order_number || order.name || '').replace(/^#/, '');
  const packages = buildPackages(lineItems, orderNumber, rescheduled);
  const tag2 = buildTag2(occasion, shippingFee, subtotalPrice, isHighValue);
  const tag5 = buildTag5(tag5Flags, timestamp);
  const payload = {
    taskTypeId: 1, statusId: 10, taskDesc, externalKey,
    merchantId: MERCHANT_ID, templateId: TEMPLATE_ID, serviceId,
    afterDateTime, beforeDateTime,
    dispatchAddress, dispatchBuilding: OUTLET.address_line_2,
    ...(OUTLET.coordinates ? { dispatchCoordinates: OUTLET.coordinates } : {}),
    requesterName: senderName,
    ...(requesterPhone ? { requesterPhone } : {}),
    destinationAddress,
    ...(destinationBuilding ? { destinationBuilding } : {}),
    ...(destinationNotes ? { destinationNotes } : {}),
    recipientName,
    ...(recipientPhone ? { recipientPhone } : {}),
    requirements: 'N,P,B', priority,
    deliveryFee: shippingFee, amountDue: totalPrice, capacity,
    tag1: orderNumber, tag2, tag3: specialRequestNote || '', tag5,
    packages,
  };
  return createWodelyTask(payload);
}
const server = http.createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok' }));
    return;
  }
  if (req.method !== 'POST' || req.url !== '/webhook') {
    res.writeHead(404); res.end('Not found'); return;
  }
  let body = '';
  req.on('data', chunk => { body += chunk; });
  req.on('end', async () => {
    let order;
    try { order = JSON.parse(body); } catch (e) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid JSON' })); return;
    }
    console.log(`[webhook] Order #${order.order_number || order.name || 'unknown'}`);
    try {
      const result = await handleWebhook(order);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, result }));
    } catch (err) {
      console.error('[webhook] Error:', err.message);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
  });
});
server.listen(PORT, () => console.log(`Zapiet→Wodely webhook handler listening on port ${PORT}`));
