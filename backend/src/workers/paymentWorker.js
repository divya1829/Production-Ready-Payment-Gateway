const pool = require('../db/connection');
const { enqueueWebhook } = require('../utils/webhookHelper');

async function processPayment(job) {
  const { paymentId } = job.data;

  try {
    // Fetch payment record
    const result = await pool.query(
      'SELECT * FROM payments WHERE id = $1',
      [paymentId]
    );

    if (result.rows.length === 0) {
      throw new Error(`Payment ${paymentId} not found`);
    }

    const payment = result.rows[0];

    // Simulate processing delay
    const testMode = process.env.TEST_MODE === 'true';
    const delay = testMode
      ? parseInt(process.env.TEST_PROCESSING_DELAY || '1000', 10)
      : Math.floor(Math.random() * 5000) + 5000; // 5-10 seconds

    await new Promise((resolve) => setTimeout(resolve, delay));

    // Determine payment outcome
    let success = false;
    if (testMode) {
      success = process.env.TEST_PAYMENT_SUCCESS !== 'false';
    } else {
      const successRate = payment.method === 'upi' ? 0.9 : 0.95;
      success = Math.random() < successRate;
    }

    // Update payment status
    if (success) {
      await pool.query(
        'UPDATE payments SET status = $1, error_code = NULL, error_description = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        ['success', paymentId]
      );

      // Enqueue webhook for payment.success
      await enqueueWebhook(payment.merchant_id, 'payment.success', {
        payment: {
          id: payment.id,
          order_id: payment.order_id,
          amount: payment.amount,
          currency: payment.currency,
          method: payment.method,
          vpa: payment.vpa,
          card_number: payment.card_number,
          card_holder: payment.card_holder,
          card_expiry: payment.card_expiry,
          status: 'success',
          created_at: payment.created_at,
        },
      });
    } else {
      const errorCode = 'PAYMENT_FAILED';
      const errorDescription = 'Payment processing failed';

      await pool.query(
        'UPDATE payments SET status = $1, error_code = $2, error_description = $3, updated_at = CURRENT_TIMESTAMP WHERE id = $4',
        ['failed', errorCode, errorDescription, paymentId]
      );

      // Enqueue webhook for payment.failed
      await enqueueWebhook(payment.merchant_id, 'payment.failed', {
        payment: {
          id: payment.id,
          order_id: payment.order_id,
          amount: payment.amount,
          currency: payment.currency,
          method: payment.method,
          status: 'failed',
          error_code: errorCode,
          error_description: errorDescription,
          created_at: payment.created_at,
        },
      });
    }

    return { success, paymentId };
  } catch (error) {
    console.error(`Error processing payment ${paymentId}:`, error);
    throw error;
  }
}

module.exports = processPayment;
