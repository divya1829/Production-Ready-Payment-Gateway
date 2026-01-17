require('dotenv').config();
const { paymentQueue, webhookQueue, refundQueue } = require('./config/queues');
const processPayment = require('./workers/paymentWorker');
const deliverWebhook = require('./workers/webhookWorker');
const processRefund = require('./workers/refundWorker');
const pool = require('./db/connection');

// Process payment jobs
paymentQueue.process('process-payment', async (job) => {
  console.log(`Processing payment job: ${job.id}`);
  return await processPayment(job);
});

// Process webhook jobs
webhookQueue.process('deliver-webhook', async (job) => {
  console.log(`Delivering webhook job: ${job.id}`);
  return await deliverWebhook(job);
});

// Process refund jobs
refundQueue.process('process-refund', async (job) => {
  console.log(`Processing refund job: ${job.id}`);
  return await processRefund(job);
});

// Process scheduled webhook retries
async function processScheduledWebhooks() {
  const result = await pool.query(
    "SELECT DISTINCT merchant_id, event, payload FROM webhook_logs WHERE status = 'pending' AND next_retry_at IS NOT NULL AND next_retry_at <= CURRENT_TIMESTAMP LIMIT 10"
  );

  for (const row of result.rows) {
    await webhookQueue.add('deliver-webhook', {
      merchantId: row.merchant_id,
      event: row.event,
      payload: row.payload,
    });
  }
}

// Check for scheduled webhooks every 10 seconds
setInterval(processScheduledWebhooks, 10000);

console.log('Worker started. Waiting for jobs...');

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...');
  await paymentQueue.close();
  await webhookQueue.close();
  await refundQueue.close();
  await pool.end();
  process.exit(0);
});
