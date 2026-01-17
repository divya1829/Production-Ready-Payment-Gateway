const crypto = require('crypto');

function generatePaymentId() {
  const randomBytes = crypto.randomBytes(8);
  const randomString = randomBytes.toString('hex').substring(0, 16);
  return `pay_${randomString}`;
}

function generateRefundId() {
  const randomBytes = crypto.randomBytes(8);
  const randomString = randomBytes.toString('hex').substring(0, 16);
  return `rfnd_${randomString}`;
}

module.exports = {
  generatePaymentId,
  generateRefundId,
};
