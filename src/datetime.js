'use strict';
function calcDeliveryWindow(deliveryDateStr) {
  const tag5Flags = [];
  let rescheduled = false;
  const [year, month, day] = deliveryDateStr.split('-').map(Number);
  let date = new Date(Date.UTC(year, month - 1, day));
  const dow = date.getUTCDay();
  if (dow === 0) {
    date.setUTCDate(date.getUTCDate() + 1);
    tag5Flags.push('DATE_ADV_SUNDAY');
  }
  const todayUTC = new Date();
  const todayStart = Date.UTC(todayUTC.getUTCFullYear(), todayUTC.getUTCMonth(), todayUTC.getUTCDate());
  if (date.getTime() < todayStart) {
    date.setUTCDate(date.getUTCDate() + 1);
    while (date.getUTCDay() === 0) date.setUTCDate(date.getUTCDate() + 1);
    tag5Flags.push('DATE_ADV_PAST');
    rescheduled = true;
  }
  const finalDow = date.getUTCDay();
  const isSaturday = finalDow === 6;
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(date.getUTCDate()).padStart(2, '0');
  const dateStr = `${yyyy}-${mm}-${dd}`;
  const afterDateTime = isSaturday ? `${dateStr}T11:00:00Z` : `${dateStr}T12:00:00Z`;
  const beforeDateTime = isSaturday ? `${dateStr}T17:00:00Z` : `${dateStr}T18:00:00Z`;
  const externalKey = `Flex_${mm}${dd}${String(yyyy).slice(2)}`;
  return { afterDateTime, beforeDateTime, externalKey, tag5Flags, rescheduled, resolvedDate: dateStr };
}
function calcServiceId(afterDateTimeStr) {
  const after = new Date(afterDateTimeStr).getTime();
  return Date.now() >= after - (2 * 60 * 60 * 1000) ? 4624 : 1888;
}
module.exports = { calcDeliveryWindow, calcServiceId };
