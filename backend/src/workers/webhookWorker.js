const pool = require('../db/connection');
const { generateWebhookSignature, calculateNextRetryAt } = require('../utils/webhook');
const { webhookQueue } = require('../config/queues');
const https = require('https');
const http = require('http');

async function deliverWebhook(job) {
  const { merchantId, event, payload, logId: providedLogId } = job.data;

  try {
    // Fetch merchant details
    const merchantResult = await pool.query(
      'SELECT webhook_url, webhook_secret FROM merchants WHERE id = $1',
      [merchantId]
    );

    if (merchantResult.rows.length === 0) {
      throw new Error(`Merchant ${merchantId} not found`);
    }

    const merchant = merchantResult.rows[0];

    if (!merchant.webhook_url) {
      console.log(`Skipping webhook for merchant ${merchantId} - no webhook_url configured`);
      // Update log status if logId provided
      if (providedLogId) {
        await pool.query(
          'UPDATE webhook_logs SET status = $1 WHERE id = $2',
          ['failed', providedLogId]
        );
      }
      return { skipped: true, reason: 'No webhook URL configured' };
    }

    if (!merchant.webhook_secret) {
      console.log(`Skipping webhook for merchant ${merchantId} - no webhook_secret configured`);
      // Update log status if logId provided
      if (providedLogId) {
        await pool.query(
          'UPDATE webhook_logs SET status = $1 WHERE id = $2',
          ['failed', providedLogId]
        );
      }
      return { skipped: true, reason: 'No webhook secret configured' };
    }

    // Get webhook log
    let logId = providedLogId;
    let attempts = 0;

    if (logId) {
      const logResult = await pool.query(
        'SELECT attempts FROM webhook_logs WHERE id = $1',
        [logId]
      );
      if (logResult.rows.length > 0) {
        attempts = logResult.rows[0].attempts + 1;
      }
    } else {
      // Fallback: create log if not provided (for retries)
      const newLogResult = await pool.query(
        'INSERT INTO webhook_logs (merchant_id, event, payload, status, attempts) VALUES ($1, $2, $3, $4, $5) RETURNING id',
        [merchantId, event, JSON.stringify(payload), 'pending', 0]
      );
      logId = newLogResult.rows[0].id;
      attempts = 1;
    }

    // Generate signature
    const signature = generateWebhookSignature(payload, merchant.webhook_secret);

    // Send HTTP POST request
    const payloadString = JSON.stringify(payload);
    const url = new URL(merchant.webhook_url);
    const isHttps = url.protocol === 'https:';
    const client = isHttps ? https : http;

    const options = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname + url.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': signature,
        'Content-Length': Buffer.byteLength(payloadString),
      },
      timeout: 5000,
    };

    const response = await sendRequest(client, options, payloadString);

    // Update webhook log
    const responseCode = response.statusCode;
    const responseBody = response.body.substring(0, 1000); // Limit response body length

    const isSuccess = responseCode >= 200 && responseCode < 300;

    if (isSuccess) {
      await pool.query(
        'UPDATE webhook_logs SET status = $1, attempts = $2, last_attempt_at = CURRENT_TIMESTAMP, response_code = $3, response_body = $4, next_retry_at = NULL WHERE id = $5',
        ['success', attempts, responseCode, responseBody, logId]
      );
    } else {
      if (attempts >= 5) {
        // Max attempts reached, mark as failed
        await pool.query(
          'UPDATE webhook_logs SET status = $1, attempts = $2, last_attempt_at = CURRENT_TIMESTAMP, response_code = $3, response_body = $4, next_retry_at = NULL WHERE id = $5',
          ['failed', attempts, responseCode, responseBody, logId]
        );
      } else {
        // Schedule retry
        const nextRetryAt = calculateNextRetryAt(attempts - 1);
        await pool.query(
          'UPDATE webhook_logs SET status = $1, attempts = $2, last_attempt_at = CURRENT_TIMESTAMP, response_code = $3, response_body = $4, next_retry_at = $5 WHERE id = $6',
          ['pending', attempts, responseCode, responseBody, nextRetryAt, logId]
        );

        // Re-enqueue for retry
        const delay = nextRetryAt ? Math.max(0, nextRetryAt.getTime() - Date.now()) : 0;
        if (delay > 0) {
          await webhookQueue.add('deliver-webhook', { merchantId, event, payload, logId }, { delay });
        }
      }
    }

    return { success: isSuccess, statusCode: responseCode, attempts };
  } catch (error) {
    console.error(`Error delivering webhook for merchant ${merchantId}:`, error);

    // Update webhook log with error
    const logResult = await pool.query(
      'SELECT id, attempts FROM webhook_logs WHERE merchant_id = $1 AND event = $2 AND payload::text = $3 ORDER BY created_at DESC LIMIT 1',
      [merchantId, event, JSON.stringify(payload)]
    );

    if (logResult.rows.length > 0) {
      const logId = logResult.rows[0].id;
      const attempts = logResult.rows[0].attempts + 1;

      if (attempts >= 5) {
        await pool.query(
          'UPDATE webhook_logs SET status = $1, attempts = $2, last_attempt_at = CURRENT_TIMESTAMP, next_retry_at = NULL WHERE id = $3',
          ['failed', attempts, logId]
        );
      } else {
        const nextRetryAt = calculateNextRetryAt(attempts - 1);
        await pool.query(
          'UPDATE webhook_logs SET status = $1, attempts = $2, last_attempt_at = CURRENT_TIMESTAMP, next_retry_at = $3 WHERE id = $4',
          ['pending', attempts, nextRetryAt, logId]
        );

        // Re-enqueue for retry
        if (nextRetryAt) {
          const delay = Math.max(0, nextRetryAt.getTime() - Date.now());
          await webhookQueue.add('deliver-webhook', { merchantId, event, payload, logId }, { delay });
        }
      }
    }

    throw error;
  }
}

function sendRequest(client, options, data) {
  return new Promise((resolve, reject) => {
    const req = client.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        resolve({ statusCode: res.statusCode, body });
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.write(data);
    req.end();
  });
}

module.exports = deliverWebhook;
