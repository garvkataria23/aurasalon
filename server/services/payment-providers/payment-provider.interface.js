/**
 * Provider contract for invoice collection gateways.
 * Implementations must never mark invoices paid directly; they only create links,
 * verify callbacks, and normalize provider payloads for the collection service.
 */
export class PaymentProvider {
  constructor(name) {
    this.name = name;
  }

  createPaymentLink() {
    throw new Error(`${this.name} createPaymentLink is not implemented`);
  }

  verifyWebhook() {
    throw new Error(`${this.name} verifyWebhook is not implemented`);
  }

  parseWebhookEvent() {
    throw new Error(`${this.name} parseWebhookEvent is not implemented`);
  }

  async fetchLinkStatus() {
    throw new Error(`${this.name} fetchLinkStatus is not implemented`);
  }
}
