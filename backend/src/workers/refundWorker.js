const pool = require('../db/connection');
const { enqueueWebhook } = require('../utils/webhookHelper');

async function processRefund(job) {
  const { refundId } = job.data;

  try {
    // Fetch refund record
    const refundResult = await pool.query(
      'SELECT * FROM refunds WHERE id = $1',
      [refundId]
    );

    if (refundResult.rows.length === 0) {
      throw new Error(`Refund ${refundId} not found`);
    }

    const refund = refundResult.rows[0];

    // Fetch payment record
    const paymentResult = await pool.query(
      'SELECT * FROM payments WHERE id = $1',
      [refund.payment_id]
    );

    if (paymentResult.rows.length === 0) {
      throw new Error(`Payment ${refund.payment_id} not found`);
    }

    const payment = paymentResult.rows[0];

    // Verify payment is in refundable state
    if (payment.status !== 'success') {
      throw new Error(`Payment ${refund.payment_id} is not in refundable state`);
    }

    // Verify total refunded amount
    const totalRefundedResult = await pool.query(
      'SELECT COALESCE(SUM(amount), 0) as total FROM refunds WHERE payment_id = $1 AND status IN ($2, $3)',
      [refund.payment_id, 'processed', 'pending']
    );

    const totalRefunded = parseInt(totalRefundedResult.rows[0].total, 10);

    if (totalRefunded > payment.amount) {
      throw new Error(`Total refunded amount exceeds payment amount`);
    }

    // Simulate refund processing delay (3-5 seconds)
    const delay = Math.floor(Math.random() * 2000) + 3000;
    await new Promise((resolve) => setTimeout(resolve, delay));

    // Update refund status
    await pool.query(
      'UPDATE refunds SET status = $1, processed_at = CURRENT_TIMESTAMP WHERE id = $2',
      ['processed', refundId]
    );

    // Enqueue webhook for refund.processed
    await enqueueWebhook(refund.merchant_id, 'refund.processed', {
      refund: {
        id: refund.id,
        payment_id: refund.payment_id,
        amount: refund.amount,
        reason: refund.reason,
        status: 'processed',
        created_at: refund.created_at,
        processed_at: new Date().toISOString(),
      },
    });

    return { success: true, refundId };
  } catch (error) {
    console.error(`Error processing refund ${refundId}:`, error);
    throw error;
  }
}

module.exports = processRefund;
