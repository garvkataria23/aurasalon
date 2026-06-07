import { repositories } from "../../repositories/repository-registry.js";
import { salonOperationsService } from "../salon-operations.service.js";
import { tenantService } from "../tenant.service.js";

const money = (value) => Math.round((Number(value) || 0) * 100) / 100;

function scope(access, branchId = "") {
  const scoped = tenantService.accessScope(access || {});
  if (branchId) scoped.branchId = branchId;
  return scoped;
}

function status(value) {
  return String(value || "").toLowerCase();
}

export function buildDashboardAiContext({ branchId = "", access }) {
  const effectiveBranchId = branchId || access.branchId || "";
  if (effectiveBranchId) tenantService.assertBranchAccess(access, effectiveBranchId);
  const scoped = scope(access, effectiveBranchId);
  const query = effectiveBranchId ? { branchId: effectiveBranchId, limit: 10000 } : { limit: 10000 };
  const dashboard = salonOperationsService.dashboardReport(effectiveBranchId, access);
  const advanced = salonOperationsService.advancedReport(access);
  const appointments = repositories.appointments.list(query, scoped);
  const sales = repositories.sales.list(query, scoped);
  const invoices = repositories.invoices.list(query, scoped);
  const clients = repositories.clients.list(query, scoped);
  const products = repositories.products.list(query, scoped);
  const staff = repositories.staff.list(query, scoped);

  const pendingPaymentAmount = money(invoices
    .filter((invoice) => status(invoice.status) !== "paid")
    .reduce((sum, invoice) => sum + Number(invoice.balance || 0), 0));
  const lowStockProducts = products.filter((product) => Number(product.stock || 0) <= Number(product.lowStockThreshold || 0));
  const completedAppointments = appointments.filter((item) => ["completed", "billed", "paid"].includes(status(item.status))).length;
  const cancelledAppointments = appointments.filter((item) => status(item.status) === "cancelled").length;
  const noShowAppointments = appointments.filter((item) => status(item.status) === "no-show").length;

  return {
    tenantId: access.tenantId,
    branchId: effectiveBranchId,
    dashboard,
    advanced,
    metrics: {
      appointments: appointments.length,
      completedAppointments,
      cancelledAppointments,
      noShowAppointments,
      sales: sales.length,
      salesRevenue: money(sales.reduce((sum, sale) => sum + Number(sale.total || 0), 0)),
      invoices: invoices.length,
      pendingPaymentAmount,
      clients: clients.length,
      staff: staff.length,
      lowStockProducts: lowStockProducts.length
    },
    risks: {
      pendingPaymentAmount,
      lowStockProducts: lowStockProducts.slice(0, 12).map((product) => ({
        id: product.id,
        name: product.name,
        stock: Number(product.stock || 0),
        lowStockThreshold: Number(product.lowStockThreshold || 0)
      })),
      noShowAppointments,
      cancelledAppointments
    }
  };
}
