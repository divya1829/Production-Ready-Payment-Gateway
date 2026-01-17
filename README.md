# Payment Gateway - Deliverable 2

Production-ready payment gateway with asynchronous processing, webhooks, embeddable SDK, and refund management.

## Features

- Asynchronous payment processing using Redis + Bull job queues
- Webhook delivery with HMAC signature verification and exponential backoff retry
- Embeddable JavaScript SDK for seamless payment integration
- Refund management (full and partial refunds)
- Idempotency keys for payment creation
- Enhanced dashboard with webhook configuration and API documentation

## Tech Stack

- **Backend**: Node.js + Express.js
- **Job Queue**: Bull (Redis-based)
- **Database**: PostgreSQL
- **Frontend**: React
- **Containerization**: Docker Compose

## Getting Started

### Prerequisites

- Docker and Docker Compose
- Node.js 18+ (for local development)

### Running the Application

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop all services
docker-compose down
```

### Services

- **API**: http://localhost:8000
- **Dashboard**: http://localhost:3000
- **Checkout**: http://localhost:3001
- **PostgreSQL**: localhost:5432
- **Redis**: localhost:6379

## API Documentation

See the dashboard at http://localhost:3000/dashboard/docs for complete API documentation.

## Testing

Test mode can be enabled via environment variables:
- `TEST_MODE=true`: Enables test mode for deterministic processing
- `TEST_PROCESSING_DELAY=1000`: Processing delay in ms (default: 1000)
- `TEST_PAYMENT_SUCCESS=true`: Payment success flag (default: true)
- `WEBHOOK_RETRY_INTERVALS_TEST=true`: Uses test retry intervals (5s, 10s, 15s, 20s)

## License

MIT
