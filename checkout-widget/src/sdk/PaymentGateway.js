class PaymentGateway {
  constructor(options) {
    // Validate required options
    if (!options.key) {
      throw new Error('API key is required');
    }
    if (!options.orderId) {
      throw new Error('Order ID is required');
    }

    // Store configuration
    this.key = options.key;
    this.orderId = options.orderId;
    this.onSuccess = options.onSuccess || (() => {});
    this.onFailure = options.onFailure || (() => {});
    this.onClose = options.onClose || (() => {});
    this.checkoutUrl = options.checkoutUrl || 'http://localhost:3001/checkout';

    // Modal element
    this.modal = null;
  }

  open() {
    // Create modal overlay
    const modal = document.createElement('div');
    modal.id = 'payment-gateway-modal';
    modal.setAttribute('data-test-id', 'payment-modal');

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';

    const content = document.createElement('div');
    content.className = 'modal-content';

    // Create iframe
    const iframe = document.createElement('iframe');
    iframe.setAttribute('data-test-id', 'payment-iframe');
    const checkoutUrl = new URL(this.checkoutUrl);
    checkoutUrl.searchParams.set('order_id', this.orderId);
    checkoutUrl.searchParams.set('key', this.key);
    checkoutUrl.searchParams.set('embedded', 'true');
    iframe.src = checkoutUrl.toString();
    iframe.frameBorder = '0';
    iframe.style.width = '100%';
    iframe.style.height = '100%';
    iframe.style.border = 'none';

    // Create close button
    const closeButton = document.createElement('button');
    closeButton.setAttribute('data-test-id', 'close-modal-button');
    closeButton.className = 'close-button';
    closeButton.innerHTML = '×';
    closeButton.onclick = () => this.close();

    content.appendChild(iframe);
    content.appendChild(closeButton);
    overlay.appendChild(content);
    modal.appendChild(overlay);

    // Append modal to document body
    document.body.appendChild(modal);
    this.modal = modal;

    // Set up postMessage listener for iframe communication
    this.messageHandler = (event) => {
      // In production, validate event.origin
      if (event.data && event.data.type) {
        if (event.data.type === 'payment_success') {
          this.onSuccess(event.data.data);
          this.close();
        } else if (event.data.type === 'payment_failed') {
          this.onFailure(event.data.data);
        } else if (event.data.type === 'close_modal') {
          this.close();
        }
      }
    };

    window.addEventListener('message', this.messageHandler);

    // Show modal
    setTimeout(() => {
      modal.classList.add('active');
    }, 10);
  }

  close() {
    if (this.modal) {
      // Remove message listener
      if (this.messageHandler) {
        window.removeEventListener('message', this.messageHandler);
      }

      // Remove modal from DOM
      this.modal.remove();
      this.modal = null;

      // Call onClose callback
      this.onClose();
    }
  }
}

// Expose globally
if (typeof window !== 'undefined') {
  window.PaymentGateway = PaymentGateway;
}

module.exports = PaymentGateway;
