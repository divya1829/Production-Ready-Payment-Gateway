# Payment Gateway API Test Script
Write-Host "=== Payment Gateway API Tests ===" -ForegroundColor Cyan
Write-Host ""

$headers = @{
    'Content-Type' = 'application/json'
    'X-Api-Key' = 'key_test_abc123'
    'X-Api-Secret' = 'secret_test_xyz789'
}

# Test 1: Health Check
Write-Host "1. Testing Health Endpoint..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:8000/health" -UseBasicParsing
    $result = $response.Content | ConvertFrom-Json
    Write-Host "   ✓ Health check: $($result.status)" -ForegroundColor Green
} catch {
    Write-Host "   ✗ Health check failed: $_" -ForegroundColor Red
}

# Test 2: Job Queue Status
Write-Host "2. Testing Job Queue Status..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:8000/api/v1/test/jobs/status" -UseBasicParsing
    $result = $response.Content | ConvertFrom-Json
    Write-Host "   ✓ Queue Status: pending=$($result.pending), processing=$($result.processing), completed=$($result.completed), worker=$($result.worker_status)" -ForegroundColor Green
} catch {
    Write-Host "   ✗ Job queue status failed: $_" -ForegroundColor Red
}

# Test 3: Create Payment
Write-Host "3. Testing Payment Creation..." -ForegroundColor Yellow
$paymentId = $null
try {
    $paymentData = @{
        order_id = "test_order_$(Get-Date -Format 'yyyyMMddHHmmss')"
        method = "upi"
        vpa = "test@paytm"
        amount = 50000
    } | ConvertTo-Json

    $response = Invoke-WebRequest -Uri "http://localhost:8000/api/v1/payments" -Method POST -Headers $headers -Body $paymentData -UseBasicParsing
    $payment = $response.Content | ConvertFrom-Json
    $paymentId = $payment.id
    Write-Host "   ✓ Payment created: $paymentId (status: $($payment.status))" -ForegroundColor Green
} catch {
    Write-Host "   ✗ Payment creation failed: $_" -ForegroundColor Red
}

if ($paymentId) {
    # Wait for payment processing
    Write-Host "   Waiting for payment processing..." -ForegroundColor Gray
    Start-Sleep -Seconds 3
    
    # Test 4: Check payment status (if we have GET endpoint)
    # Skipping as we might not have implemented GET /payments/:id yet
}

# Test 5: Webhook Logs
Write-Host "5. Testing Webhook Logs..." -ForegroundColor Yellow
try {
    $webhookResponse = Invoke-WebRequest -Uri "http://localhost:8000/api/v1/webhooks?limit=10" -Method GET -Headers $headers -UseBasicParsing
    $webhooks = $webhookResponse.Content | ConvertFrom-Json
    Write-Host "   ✓ Webhook logs retrieved: $($webhooks.total) total logs" -ForegroundColor Green
} catch {
    Write-Host "   ✗ Webhook logs failed: $_" -ForegroundColor Red
}

# Test 6: Job Queue Status (final)
Write-Host "6. Testing Final Job Queue Status..." -ForegroundColor Yellow
try {
    $finalStatus = Invoke-WebRequest -Uri "http://localhost:8000/api/v1/test/jobs/status" -UseBasicParsing
    $queueStatus = $finalStatus.Content | ConvertFrom-Json
    Write-Host "   ✓ Final Queue Status: pending=$($queueStatus.pending), processing=$($queueStatus.processing), completed=$($queueStatus.completed)" -ForegroundColor Green
} catch {
    Write-Host "   ✗ Final job queue status failed: $_" -ForegroundColor Red
}

Write-Host ""
Write-Host "=== Tests Complete ===" -ForegroundColor Cyan
