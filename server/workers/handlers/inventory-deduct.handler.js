import { applyInventoryDelta, db, deductServiceUsage } from "../../db.js";

function parseJson(value, fallback = []) {
  try {
    return typeof value === "string" ? JSON.parse(value || "null") ?? fallback : value ?? fallback;
  } catch {
    return fallback;
  }
}

export async function run(job) {
  const payload = job.payload || {};
  if (!job.tenantId) return { success: false, error: "tenantId is required" };

  const appointmentId = payload.appointmentId || "";
  const appointment = appointmentId
    ? db.prepare("SELECT * FROM appointments WHERE tenantId = ? AND id = ?").get(job.tenantId, appointmentId)
    : null;
  const branchId = payload.branchId || appointment?.branchId || "";
  if (!branchId) return { success: false, error: "branchId is required" };

  const serviceIds = payload.serviceIds || (appointment ? parseJson(appointment.serviceIds, []) : []);
  if (serviceIds.length) {
    const rows = deductServiceUsage(serviceIds, branchId, payload.referenceType || "job", payload.referenceId || appointmentId || job.id, job.tenantId);
    return { success: true, mode: "service_usage", deducted: rows.length, transactionIds: rows.map((row) => row.id) };
  }

  if (!payload.productId || !Number(payload.quantity || 0)) {
    return { success: false, error: "productId and quantity or serviceIds are required" };
  }
  const quantity = -Math.abs(Number(payload.quantity));
  const row = applyInventoryDelta({
    productId: payload.productId,
    branchId,
    quantity,
    type: payload.type || "consume",
    reason: payload.reason || "Background inventory deduction",
    referenceType: payload.referenceType || "job",
    referenceId: payload.referenceId || job.id,
    tenantId: job.tenantId
  });
  return { success: true, mode: "product", transactionId: row.id, productId: payload.productId, quantity };
}
