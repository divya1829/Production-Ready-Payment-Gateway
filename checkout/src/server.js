require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3001;
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Serve SDK
app.get('/checkout.js', (req, res) => {
  const sdkPath = path.join(__dirname, '../public/checkout.js');
  if (fs.existsSync(sdkPath)) {
    res.sendFile(sdkPath);
  } else {
    res.status(404).send('SDK not found. Please build the checkout-widget first.');
  }
});

// Checkout page
app.get('/checkout', (req, res) => {
  const orderId = req.query.order_id;
  const key = req.query.key;
  const embedded = req.query.embedded === 'true';

  if (!orderId || !key) {
    return res.status(400).send('Missing required parameters');
  }

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Payment Gateway</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      background: #f5f5f5;
      padding: 20px;
    }
    .checkout-container {
      max-width: 500px;
      margin: 0 auto;
      background: white;
      border-radius: 8px;
      padding: 30px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    h1 {
      margin-bottom: 20px;
      color: #333;
    }
    .form-group {
      margin-bottom: 20px;
    }
    label {
      display: block;
      margin-bottom: 8px;
      color: #555;
      font-weight: 500;
    }
    input, select {
      width: 100%;
      padding: 12px;
      border: 1px solid #ddd;
      border-radius: 4px;
      font-size: 16px;
    }
    button {
      width: 100%;
      padding: 14px;
      background: #007bff;
      color: white;
      border: none;
      border-radius: 4px;
      font-size: 16px;
      font-weight: 500;
      cursor: pointer;
      margin-top: 10px;
    }
    button:hover {
      background: #0056b3;
    }
    button:disabled {
      background: #ccc;
      cursor: not-allowed;
    }
    .error {
      color: #dc3545;
      margin-top: 10px;
      padding: 10px;
      background: #f8d7da;
      border-radius: 4px;
    }
    .success {
      color: #155724;
      margin-top: 10px;
      padding: 10px;
      background: #d4edda;
      border-radius: 4px;
    }
  </style>
</head>
<body>
  <div class="checkout-container">
    <h1>Complete Payment</h1>
    <form id="payment-form">
      <div class="form-group">
        <label>Payment Method</label>
        <select id="method" required>
          <option value="upi">UPI</option>
          <option value="card">Card</option>
        </select>
      </div>
      <div class="form-group" id="vpa-group">
        <label>VPA</label>
        <input type="text" id="vpa" placeholder="user@paytm" required>
      </div>
      <div class="form-group" id="card-group" style="display: none;">
        <label>Card Number</label>
        <input type="text" id="card_number" placeholder="1234567890123456" maxlength="16">
        <label style="margin-top: 10px;">Card Holder</label>
        <input type="text" id="card_holder" placeholder="John Doe">
        <label style="margin-top: 10px;">Expiry</label>
        <input type="text" id="card_expiry" placeholder="MM/YYYY" maxlength="7">
        <label style="margin-top: 10px;">CVV</label>
        <input type="text" id="card_cvv" placeholder="123" maxlength="4">
      </div>
      <button type="submit" id="submit-btn">Pay Now</button>
      <div id="message"></div>
    </form>
  </div>
  <script>
    const API_URL = '${API_URL}';
    const orderId = '${orderId}';
    const key = '${key}';
    const embedded = ${embedded};

    document.getElementById('method').addEventListener('change', function(e) {
      const method = e.target.value;
      if (method === 'upi') {
        document.getElementById('vpa-group').style.display = 'block';
        document.getElementById('card-group').style.display = 'none';
        document.getElementById('vpa').required = true;
        document.getElementById('card_number').required = false;
      } else {
        document.getElementById('vpa-group').style.display = 'none';
        document.getElementById('card-group').style.display = 'block';
        document.getElementById('vpa').required = false;
        document.getElementById('card_number').required = true;
      }
    });

    document.getElementById('payment-form').addEventListener('submit', async function(e) {
      e.preventDefault();
      const submitBtn = document.getElementById('submit-btn');
      const messageDiv = document.getElementById('message');
      submitBtn.disabled = true;
      messageDiv.innerHTML = '';

      const method = document.getElementById('method').value;
      const data = {
        order_id: orderId,
        method: method
      };

      if (method === 'upi') {
        data.vpa = document.getElementById('vpa').value;
      } else {
        data.card_number = document.getElementById('card_number').value;
        data.card_holder = document.getElementById('card_holder').value;
        data.card_expiry = document.getElementById('card_expiry').value;
        data.card_cvv = document.getElementById('card_cvv').value;
      }

      try {
        const response = await fetch(API_URL + '/api/v1/payments', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Api-Key': key,
            'X-Api-Secret': 'secret_test_xyz789'
          },
          body: JSON.stringify(data)
        });

        const result = await response.json();

        if (response.ok) {
          messageDiv.innerHTML = '<div class="success">Payment initiated successfully! Payment ID: ' + result.id + '</div>';
          
          if (embedded) {
            // Send success message to parent
            window.parent.postMessage({
              type: 'payment_success',
              data: { paymentId: result.id, payment: result }
            }, '*');
          }
        } else {
          messageDiv.innerHTML = '<div class="error">Error: ' + (result.error?.description || 'Payment failed') + '</div>';
          
          if (embedded) {
            // Send failure message to parent
            window.parent.postMessage({
              type: 'payment_failed',
              data: { error: result.error }
            }, '*');
          }
        }
      } catch (error) {
        messageDiv.innerHTML = '<div class="error">Error: ' + error.message + '</div>';
        
        if (embedded) {
          window.parent.postMessage({
            type: 'payment_failed',
            data: { error: { message: error.message } }
          }, '*');
        }
      } finally {
        submitBtn.disabled = false;
      }
    });
  </script>
</body>
</html>
  `;

  res.send(html);
});

app.listen(PORT, () => {
  console.log(`Checkout service running on port ${PORT}`);
});
