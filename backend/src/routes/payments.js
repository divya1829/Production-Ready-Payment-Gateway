const express = require('express');
const router = express.Router();
const pool = require('../db/connection');
const authenticate = require('../middleware/auth');
const { paymentQueue } = require('../config/queues');
const { checkIdempotencyKey, storeIdempotencyKey } = require('../utils/idempotency');
const { generatePaymentId } = require('../utils/paymentId');

// Create payment
router.post('/', authenticate, async (req, res, next) => {
  try {
    const { order_id, method, vpa, card_number, card_holder, card_expiry, card_cvv } = req.body;
    const idempotencyKey = req.headers['idempotency-key'];
    const merchantId = req.merchant.id;

    // Check idempotency key
    if (idempotencyKey) {
      const cachedResponse = await checkIdempotencyKey(idempotencyKey, merchantId);
      if (cachedResponse) {
        return res.status(201).json(cachedResponse);
      }
    }

    // Validate payment details
    if (!order_id || !method) {
      return res.status(400).json({
        error: {
          code: 'BAD_REQUEST_ERROR',
          description: 'order_id and method are required',
        },
      });
    }

    if (method === 'upi' && !vpa) {
      return res.status(400).json({
        error: {
          code: 'BAD_REQUEST_ERROR',
          description: 'vpa is required for UPI payments',
        },
      });
    }

    if (method === 'card') {
      if (!card_number || !card_holder || !card_expiry || !card_cvv) {
        return res.status(400).json({
          error: {
            code: 'BAD_REQUEST_ERROR',
            description: 'card_number, card_holder, card_expiry, and card_cvv are required for card payments',
          },
        });
      }
    }

    // Generate payment ID
    let paymentId = generatePaymentId();
    let exists = true;
    while (exists) {
      const checkResult = await pool.query('SELECT id FROM payments WHERE id = $1', [paymentId]);
      exists = checkResult.rows.length > 0;
      if (exists) {
        paymentId = generatePaymentId();
      }
    }

    // Create payment record
    const result = await pool.query(
      `INSERT INTO payments (id, merchant_id, order_id, amount, currency, method, vpa, card_number, card_holder, card_expiry, card_cvv, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       RETURNING *`,
      [paymentId, merchantId, order_id, req.body.amount || 50000, req.body.currency || 'INR', method, vpa, card_number, card_holder, card_expiry, card_cvv, 'pending']
    );

    const payment = result.rows[0];

    // Enqueue payment processing job
    await paymentQueue.add('process-payment', { paymentId });

    // Prepare response
    const response = {
      id: payment.id,
      order_id: payment.order_id,
      amount: payment.amount,
      currency: payment.currency,
      method: payment.method,
      vpa: payment.vpa,
      status: payment.status,
      created_at: payment.created_at,
    };

    // Store idempotency key if provided
    if (idempotencyKey) {
      await storeIdempotencyKey(idempotencyKey, merchantId, response);
    }

    res.status(201).json(response);
  } catch (error) {
    next(error);
  }
});

// Capture payment
router.post('/:payment_id/capture', authenticate, async (req, res, next) => {
  try {
    const { payment_id } = req.params;
    const { amount } = req.body;
    const merchantId = req.merchant.id;

    // Fetch payment
    const result = await pool.query(
      'SELECT * FROM payments WHERE id = $1 AND merchant_id = $2',
      [payment_id, merchantId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          description: 'Payment not found',
        },
      });
    }

    const payment = result.rows[0];

    // Check if payment can be captured
    if (payment.status !== 'success') {
      return res.status(400).json({
        error: {
          code: 'BAD_REQUEST_ERROR',
          description: 'Payment not in capturable state',
        },
      });
    }

    if (payment.captured) {
      return res.status(400).json({
        error: {
          code: 'BAD_REQUEST_ERROR',
          description: 'Payment already captured',
        },
      });
    }

    // Update payment
    await pool.query(
      'UPDATE payments SET captured = true, updated_at = CURRENT_TIMESTAMP WHERE id = $1',
      [payment_id]
    );

    // Fetch updated payment
    const updatedResult = await pool.query('SELECT * FROM payments WHERE id = $1', [payment_id]);
    const updatedPayment = updatedResult.rows[0];

    res.json({
      id: updatedPayment.id,
      order_id: updatedPayment.order_id,
      amount: updatedPayment.amount,
      currency: updatedPayment.currency,
      method: updatedPayment.method,
      status: updatedPayment.status,
      captured: updatedPayment.captured,
      created_at: updatedPayment.created_at,
      updated_at: updatedPayment.updated_at,
    });
  } catch (error) {
    next(error);
  }
});

// Create refund
router.post('/:payment_id/refunds', authenticate, async (req, res, next) => {
  try {
    const { payment_id } = req.params;
    const { amount, reason } = req.body;
    const merchantId = req.merchant.id;

    // Fetch payment
    const paymentResult = await pool.query(
      'SELECT * FROM payments WHERE id = $1 AND merchant_id = $2',
      [payment_id, merchantId]
    );

    if (paymentResult.rows.length === 0) {
      return res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          description: 'Payment not found',
        },
      });
    }

    const payment = paymentResult.rows[0];

    // Verify payment is refundable
    if (payment.status !== 'success') {
      return res.status(400).json({
        error: {
          code: 'BAD_REQUEST_ERROR',
          description: 'Payment not in refundable state',
        },
      });
    }

    // Calculate total refunded amount
    const refundedResult = await pool.query(
      'SELECT COALESCE(SUM(amount), 0) as total FROM refunds WHERE payment_id = $1 AND status IN ($2, $3)',
      [payment_id, 'processed', 'pending']
    );

    const totalRefunded = parseInt(refundedResult.rows[0].total, 10);
    const requestedAmount = parseInt(amount, 10);

    if (!amount || requestedAmount <= 0) {
      return res.status(400).json({
        error: {
          code: 'BAD_REQUEST_ERROR',
          description: 'Valid amount is required',
        },
      });
    }

    if (requestedAmount + totalRefunded > payment.amount) {
      return res.status(400).json({
        error: {
          code: 'BAD_REQUEST_ERROR',
          description: 'Refund amount exceeds available amount',
        },
      });
    }

    // Generate refund ID
    const { generateRefundId } = require('../utils/paymentId');
    const { refundQueue } = require('../config/queues');

    let refundId = generateRefundId();
    let exists = true;
    while (exists) {
      const checkResult = await pool.query('SELECT id FROM refunds WHERE id = $1', [refundId]);
      exists = checkResult.rows.length > 0;
      if (exists) {
        refundId = generateRefundId();
      }
    }

    // Create refund record
    const refundResult = await pool.query(
      'INSERT INTO refunds (id, payment_id, merchant_id, amount, reason, status, created_at) VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP) RETURNING *',
      [refundId, payment_id, merchantId, requestedAmount, reason || null, 'pending']
    );

    const refund = refundResult.rows[0];

    // Enqueue refund processing job
    await refundQueue.add('process-refund', { refundId });

    // Enqueue webhook for refund.created
    const { enqueueWebhook } = require('../utils/webhookHelper');
    await enqueueWebhook(merchantId, 'refund.created', {
      refund: {
        id: refund.id,
        payment_id: refund.payment_id,
        amount: refund.amount,
        reason: refund.reason,
        status: refund.status,
        created_at: refund.created_at,
      },
    });

    res.status(201).json({
      id: refund.id,
      payment_id: refund.payment_id,
      amount: refund.amount,
      reason: refund.reason,
      status: refund.status,
      created_at: refund.created_at,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
