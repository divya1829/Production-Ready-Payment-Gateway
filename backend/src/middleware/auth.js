const pool = require('../db/connection');

async function authenticate(req, res, next) {
  const apiKey = req.headers['x-api-key'];
  const apiSecret = req.headers['x-api-secret'];

  if (!apiKey || !apiSecret) {
    return res.status(401).json({
      error: {
        code: 'UNAUTHORIZED',
        description: 'Missing API credentials',
      },
    });
  }

  try {
    const result = await pool.query(
      'SELECT id, email, name, webhook_url, webhook_secret FROM merchants WHERE api_key = $1 AND api_secret = $2',
      [apiKey, apiSecret]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          description: 'Invalid API credentials',
        },
      });
    }

    req.merchant = result.rows[0];
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        description: 'Authentication failed',
      },
    });
  }
}

module.exports = authenticate;
