const express = require('express');
const router = express.Router();
const pool = require('../db/connection');
const authenticate = require('../middleware/auth');
const { webhookQueue } = require('../config/queues');

// List webhook logs
router.get('/', authenticate, async (req, res, next) => {
  try {
    const merchantId = req.merchant.id;
    const limit = parseInt(req.query.limit || '10', 10);
    const offset = parseInt(req.query.offset || '0', 10);

    const result = await pool.query(
      `SELECT id, event, status, attempts, created_at, last_attempt_at, response_code 
       FROM webhook_logs 
       WHERE merchant_id = $1 
       ORDER BY created_at DESC 
       LIMIT $2 OFFSET $3`,
      [merchantId, limit, offset]
    );

    const countResult = await pool.query(
      'SELECT COUNT(*) as total FROM webhook_logs WHERE merchant_id = $1',
      [merchantId]
    );

    const total = parseInt(countResult.rows[0].total, 10);

    res.json({
      data: result.rows.map((row) => ({
        id: row.id,
        event: row.event,
        status: row.status,
        attempts: row.attempts,
        created_at: row.created_at,
        last_attempt_at: row.last_attempt_at,
        response_code: row.response_code,
      })),
      total,
      limit,
      offset,
    });
  } catch (error) {
    next(error);
  }
});

// Retry webhook
router.post('/:webhook_id/retry', authenticate, async (req, res, next) => {
  try {
    const { webhook_id } = req.params;
    const merchantId = req.merchant.id;

    const result = await pool.query(
      'SELECT * FROM webhook_logs WHERE id = $1 AND merchant_id = $2',
      [webhook_id, merchantId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          description: 'Webhook log not found',
        },
      });
    }

    const webhookLog = result.rows[0];

    // Reset attempts and status
    await pool.query(
      'UPDATE webhook_logs SET status = $1, attempts = 0, next_retry_at = NULL WHERE id = $2',
      ['pending', webhook_id]
    );

    // Re-enqueue webhook with the same log ID
    await webhookQueue.add('deliver-webhook', {
      merchantId,
      event: webhookLog.event,
      payload: webhookLog.payload,
      logId: webhook_id,
    });

    res.json({
      id: webhook_id,
      status: 'pending',
      message: 'Webhook retry scheduled',
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
