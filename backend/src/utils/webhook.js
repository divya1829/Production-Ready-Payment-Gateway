const crypto = require('crypto');

function generateWebhookSignature(payload, secret) {
  const jsonString = typeof payload === 'string' ? payload : JSON.stringify(payload);
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(jsonString);
  return hmac.digest('hex');
}

function getRetryIntervals() {
  const testMode = process.env.WEBHOOK_RETRY_INTERVALS_TEST === 'true';
  
  if (testMode) {
    return [0, 5, 10, 15, 20]; // Test intervals in seconds
  }
  
  return [0, 60, 300, 1800, 7200]; // Production intervals: immediate, 1min, 5min, 30min, 2hr
}

function calculateNextRetryAt(attemptNumber) {
  const intervals = getRetryIntervals();
  if (attemptNumber >= intervals.length) {
    return null; // No more retries
  }
  
  const delaySeconds = intervals[attemptNumber];
  const nextRetryAt = new Date();
  nextRetryAt.setSeconds(nextRetryAt.getSeconds() + delaySeconds);
  return nextRetryAt;
}

module.exports = {
  generateWebhookSignature,
  calculateNextRetryAt,
  getRetryIntervals,
};
