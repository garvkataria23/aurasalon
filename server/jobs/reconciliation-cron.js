import { razorpayReconciliationService } from "../services/razorpay-reconciliation.service.js";

let timer = null;

function yesterday() {
  return new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
}

export function runReconciliationOnce(access = { tenantId: "tenant_aura", role: "owner", userId: "reconciliation-cron", branchIds: [] }) {
  return razorpayReconciliationService.fetchSettlement({ date: yesterday() }, access);
}

export function startReconciliationCron() {
  if (timer) return timer;
  timer = setInterval(() => {
    const hour = new Date().getHours();
    if (hour === 3) {
      try {
        runReconciliationOnce();
      } catch {
        // Cron should never crash the API process.
      }
    }
  }, 60 * 60 * 1000);
  return timer;
}
