import { badRequest } from "../../utils/app-error.js";
import { PaymentProvider } from "./payment-provider.interface.js";

export class CashfreeProvider extends PaymentProvider {
  constructor() {
    super("cashfree");
  }

  createPaymentLink() {
    throw badRequest("Cashfree provider is configured as a future placeholder");
  }

  verifyWebhook() {
    throw badRequest("Cashfree webhook support is not enabled yet");
  }

  parseWebhookEvent() {
    throw badRequest("Cashfree webhook support is not enabled yet");
  }
}

export const cashfreeProvider = new CashfreeProvider();
