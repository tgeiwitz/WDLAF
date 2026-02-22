'use strict';
const Anthropic = require('@anthropic-ai/sdk');
const SYSTEM_PROMPT = `You are a delivery order processing assistant for a floral delivery business. Your job is to analyze order notes from a Shopify/Zapiet order and return structured JSON for use in a delivery management system.
You will receive a pre-processed order object. Your output must be valid JSON only — no explanation, no markdown, no preamble.
Tasks:
1. Classify order_note as: "delivery", "special_request", "both", or "none"
2. Classify note_attributes for special request or timing info
3. Construct destinationNotes: only populate when order_note is delivery-related. If delivery note present: prepend [OCCASION] if occasion exists, append "Gift message: {text}" if gift message exists, then append delivery note on new line. If no delivery note, destinationNotes is empty string.
4. Extract specialRequestNote: full text of any special request or timing instruction, else empty string
5. Identify sentimentFlagged: true if any occasion/sentiment value present, else false
Input format: {"order_note": "string or null", "note_attributes": [{"name": "string", "value": "string"}], "gift_message": "string or null", "occasion": "string or null"}
Output format (JSON only, nothing else): {"destinationNotes": "string", "specialRequestNote": "string", "orderNoteClassification": "delivery | special_request | both | none", "sentimentFlagged": true | false}
Rules:
- Return only valid JSON. No markdown, no explanation, no code fences.
- Never invent content. Use customer's exact wording.
- Uppercase occasion in [OCCASION] label.
- destinationNotes and specialRequestNote must always be present, may be empty strings.
- Do not include PII in output.`;
let client;
function getClient() {
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}
async function classifyNotes({ orderNote, noteAttributes, giftMessage, occasion }) {
  const input = { order_note: orderNote || null, note_attributes: noteAttributes || [], gift_message: giftMessage || null, occasion: occasion || null };
  if (!input.order_note && !input.gift_message && !input.occasion && (!input.note_attributes || input.note_attributes.length === 0)) {
    return { destinationNotes: '', specialRequestNote: '', orderNoteClassification: 'none', sentimentFlagged: false };
  }
  const response = await getClient().messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 512,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: JSON.stringify(input) }],
  });
  return JSON.parse(response.content[0].text.trim());
}
module.exports = { classifyNotes };
