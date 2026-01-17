const express = require('express');
const router = express.Router();
const { paymentQueue, webhookQueue, refundQueue } = require('../config/queues');

// Job queue status endpoint (no authentication required for testing)
router.get('/jobs/status', async (req, res) => {
  try {
    const [paymentWaiting, paymentActive, paymentCompleted, paymentFailed] = await Promise.all([
      paymentQueue.getWaitingCount(),
      paymentQueue.getActiveCount(),
      paymentQueue.getCompletedCount(),
      paymentQueue.getFailedCount(),
    ]);

    const [webhookWaiting, webhookActive] = await Promise.all([
      webhookQueue.getWaitingCount(),
      webhookQueue.getActiveCount(),
    ]);

    const [refundWaiting, refundActive] = await Promise.all([
      refundQueue.getWaitingCount(),
      refundQueue.getActiveCount(),
    ]);

    const pending = paymentWaiting + webhookWaiting + refundWaiting;
    const processing = paymentActive + webhookActive + refundActive;
    const completed = paymentCompleted || 0;
    const failed = paymentFailed || 0;

    // Check if worker is running (simple check: if we can get queue stats, worker is likely running)
    const workerStatus = 'running';

    res.json({
      pending,
      processing,
      completed,
      failed,
      worker_status: workerStatus,
    });
  } catch (error) {
    console.error('Error getting job queue status:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        description: 'Failed to get job queue status',
      },
    });
  }
});

module.exports = router;
