const express = require('express');
const router = express.Router();
const pool = require('../db/connection');
const authenticate = require('../middleware/auth');

// Get refund
router.get('/:refund_id', authenticate, async (req, res, next) => {
  try {
    const { refund_id } = req.params;
    const merchantId = req.merchant.id;

    const result = await pool.query(
      'SELECT * FROM refunds WHERE id = $1 AND merchant_id = $2',
      [refund_id, merchantId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          description: 'Refund not found',
        },
      });
    }

    const refund = result.rows[0];

    res.json({
      id: refund.id,
      payment_id: refund.payment_id,
      amount: refund.amount,
      reason: refund.reason,
      status: refund.status,
      created_at: refund.created_at,
      processed_at: refund.processed_at,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
