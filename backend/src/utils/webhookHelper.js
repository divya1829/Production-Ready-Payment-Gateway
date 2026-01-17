const pool = require('../db/connection');
const { webhookQueue } = require('../config/queues');

async function enqueueWebhook(merchantId, event, data) {
  const payload = {
    event,
    timestamp: Math.floor(Date.now() / 1000),
    data,
  };

  // Create webhook log entry
  const logResult = await pool.query(
    'INSERT INTO webhook_logs (merchant_id, event, payload, status, attempts) VALUES ($1, $2, $3, $4, $5) RETURNING id',
    [merchantId, event, JSON.stringify(payload), 'pending', 0]
  );

  const logId = logResult.rows[0].id;

  // Enqueue webhook delivery job
  await webhookQueue.add('deliver-webhook', {
    merchantId,
    event,
    payload,
    logId,
  });

  return logId;
}

module.exports = { enqueueWebhook };
