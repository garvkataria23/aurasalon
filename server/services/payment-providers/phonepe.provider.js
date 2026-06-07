import { badRequest } from "../../utils/app-error.js";
import { PaymentProvider } from "./payment-provider.interface.js";

export class PhonePeProvider extends PaymentProvider {
  constructor() {
    super("phonepe");
  }

  createPaymentLink() {
    throw badRequest("PhonePe provider is configured as a future placeholder");
  }

  verifyWebhook() {
    throw badRequest("PhonePe webhook support is not enabled yet");
  }

  parseWebhookEvent() {
    throw badRequest("PhonePe webhook support is not enabled yet");
  }
}

export const phonePeProvider = new PhonePeProvider();
