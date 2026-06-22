import { badRequest } from "../../utils/app-error.js";
import { cashfreeProvider } from "./cashfree.provider.js";
import { phonePeProvider } from "./phonepe.provider.js";
import { razorpayProvider } from "./razorpay.provider.js";

const providers = new Map([
  [razorpayProvider.name, razorpayProvider],
  [cashfreeProvider.name, cashfreeProvider],
  [phonePeProvider.name, phonePeProvider]
]);

export function paymentProviderFor(provider = "razorpay") {
  const normalized = String(provider || "razorpay").toLowerCase();
  const implementation = providers.get(normalized);
  if (!implementation) throw badRequest(`Unsupported payment provider: ${provider}`);
  return implementation;
}

export function paymentProviderNames() {
  return Array.from(providers.keys());
}
