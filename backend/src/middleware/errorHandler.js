function errorHandler(err, req, res, next) {
  console.error('Error:', err);

  if (err.status) {
    return res.status(err.status).json({
      error: {
        code: err.code || 'ERROR',
        description: err.message || 'An error occurred',
      },
    });
  }

  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      description: 'An internal error occurred',
    },
  });
}

module.exports = errorHandler;
