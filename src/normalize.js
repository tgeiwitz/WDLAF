'use strict';
function normalizePhone(raw) {
  if (!raw) return null;
  const digits = String(raw).replace(/\D/g, '');
  const local = digits.length === 11 && digits[0] === '1' ? digits.slice(1) : digits;
  if (local.length !== 10) return null;
  return `(${local.slice(0, 3)}) ${local.slice(3, 6)}-${local.slice(6)}`;
}
function deduplicatePhones(customerPhone, shippingPhone, senderName, recipientName) {
  const reqPhone = normalizePhone(customerPhone);
  const recPhone = normalizePhone(shippingPhone);
  if (!reqPhone && !recPhone) return { requesterPhone: null, recipientPhone: null, tag5Flags: [] };
  if (!recPhone) return { requesterPhone: reqPhone, recipientPhone: null, tag5Flags: [] };
  if (!reqPhone) return { requesterPhone: null, recipientPhone: recPhone, tag5Flags: [] };
  if (reqPhone === recPhone) {
    const sameName = senderName && recipientName &&
      senderName.trim().toLowerCase() === recipientName.trim().toLowerCase();
    if (sameName) {
      return { requesterPhone: reqPhone, recipientPhone: null, tag5Flags: ['PHONE_DEDUPED'] };
    } else {
      return { requesterPhone: reqPhone, recipientPhone: null, tag5Flags: ['NO_RECEIVER_PHONE'] };
    }
  }
  return { requesterPhone: reqPhone, recipientPhone: recPhone, tag5Flags: [] };
}
function buildDestinationAddress(addr) {
  const parts = [addr.address1, addr.city, addr.province ? `${addr.province} ${addr.zip}` : addr.zip].filter(Boolean);
  return parts.join(', ');
}
function buildDestinationBuilding(addr) {
  const company = (addr.company || '').trim();
  const address2 = (addr.address2 || '').trim();
  if (company && address2) return `${company}, ${address2}`;
  return company || address2 || '';
}
function buildDispatchAddress(outlet) {
  const parts = [outlet.address_line_1, outlet.city, outlet.postal_code, outlet.country].filter(Boolean);
  return parts.join(', ');
}
function buildTaskDesc(lineItems) {
  return lineItems.map(item => {
    const variant = item.variant_title && item.variant_title !== 'Default Title' ? ` - ${item.variant_title}` : '';
    return `${item.title}${variant} x ${item.quantity}`;
  }).join(', ');
}
function buildPackages(lineItems, orderNumber, rescheduled) {
  return lineItems.map(item => ({
    productId: item.sku || String(item.variant_id || item.product_id),
    productDesc: item.title + (item.variant_title && item.variant_title !== 'Default Title' ? ` - ${item.variant_title}` : ''),
    orderId: orderNumber,
    quantity: item.quantity,
    weight: item.grams || 0,
    price: parseFloat(item.price),
    packageTypeId: 1,
    field1: '',
    field2: '',
    field3: rescheduled ? 'RESCHEDULED' : '',
  }));
}
function buildTag2(occasion, shippingFee, subtotal, isHighValue) {
  const sentiment = occasion || 'None';
  const fee = parseFloat(shippingFee).toFixed(2);
  const sub = parseFloat(subtotal).toFixed(2);
  let tag = `Sentiment: ${sentiment} | Fee: $${fee} | Subtotal: $${sub}`;
  if (isHighValue) tag += ' | HIGH_VALUE';
  return tag;
}
function buildTag5(flags, timestamp) {
  if (!flags || flags.length === 0) return '';
  const ts = timestamp || new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
  return `${ts} ${flags.join(', ')}`;
}
module.exports = { normalizePhone, deduplicatePhones, buildDestinationAddress, buildDestinationBuilding, buildDispatchAddress, buildTaskDesc, buildPackages, buildTag2, buildTag5 };
