const PaymentGateway = require('./sdk/PaymentGateway');
require('./sdk/styles.css');

// Expose globally
if (typeof window !== 'undefined') {
  window.PaymentGateway = PaymentGateway;
}

module.exports = PaymentGateway;
