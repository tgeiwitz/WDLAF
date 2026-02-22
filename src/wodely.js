'use strict';
const https = require('https');
async function createWodelyTask(payload) {
  const apiKey = process.env.WODELY_API_KEY;
  if (!apiKey) throw new Error('WODELY_API_KEY not set');
  const body = JSON.stringify(payload);
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'app.wodely.com',
      path: '/v2/tasks',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body), 'Authorization': `Bearer ${apiKey}` },
    }, res => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          res.statusCode >= 200 && res.statusCode < 300 ? resolve(parsed) : reject(new Error(`Wodely ${res.statusCode}: ${JSON.stringify(parsed)}`));
        } catch (e) { reject(new Error(`Wodely parse error: ${data}`)); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}
module.exports = { createWodelyTask };
