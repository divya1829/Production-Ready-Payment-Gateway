const Queue = require('bull');

// Parse Redis URL or use default
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

// Bull 4.x works with redis package, but we can also pass connection string directly

// Payment processing queue
const paymentQueue = new Queue('payment-processing', redisUrl, {
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
  },
});

// Webhook delivery queue
const webhookQueue = new Queue('webhook-delivery', redisUrl, {
  defaultJobOptions: {
    attempts: 1, // We handle retries manually
    removeOnComplete: 100,
    removeOnFail: false,
  },
});

// Refund processing queue
const refundQueue = new Queue('refund-processing', redisUrl, {
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
  },
});

module.exports = {
  paymentQueue,
  webhookQueue,
  refundQueue,
};
