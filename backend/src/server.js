require('dotenv').config();
const express = require('express');
const cors = require('cors');
const pool = require('./db/connection');
const errorHandler = require('./middleware/errorHandler');

const paymentsRoutes = require('./routes/payments');
const refundsRoutes = require('./routes/refunds');
const webhooksRoutes = require('./routes/webhooks');
const testRoutes = require('./routes/test');

const app = express();
const PORT = process.env.PORT || 8000;

// Middleware
app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// API routes
app.use('/api/v1/payments', paymentsRoutes);
app.use('/api/v1/refunds', refundsRoutes);
app.use('/api/v1/webhooks', webhooksRoutes);
app.use('/api/v1/test', testRoutes);

// Error handler
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  console.log(`API server running on port ${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...');
  await pool.end();
  process.exit(0);
});
