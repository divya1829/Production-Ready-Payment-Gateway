const pool = require('../db/connection');

async function checkIdempotencyKey(key, merchantId) {
  const result = await pool.query(
    'SELECT response, expires_at FROM idempotency_keys WHERE key = $1 AND merchant_id = $2',
    [key, merchantId]
  );

  if (result.rows.length === 0) {
    return null;
  }

  const { response, expires_at } = result.rows[0];

  // Check if expired
  if (new Date(expires_at) < new Date()) {
    // Delete expired key
    await pool.query(
      'DELETE FROM idempotency_keys WHERE key = $1 AND merchant_id = $2',
      [key, merchantId]
    );
    return null;
  }

  return response;
}

async function storeIdempotencyKey(key, merchantId, response) {
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 24); // 24 hours from now

  await pool.query(
    'INSERT INTO idempotency_keys (key, merchant_id, response, expires_at) VALUES ($1, $2, $3, $4) ON CONFLICT (key, merchant_id) DO UPDATE SET response = $3, expires_at = $4',
    [key, merchantId, JSON.stringify(response), expiresAt]
  );
}

module.exports = {
  checkIdempotencyKey,
  storeIdempotencyKey,
};
