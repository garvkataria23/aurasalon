import { repositories } from "../../repositories/repository-registry.js";
import { badRequest, notFound } from "../../utils/app-error.js";
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

function itemAmount(item) {
  return money(Number(item.price || item.unitPrice || 0) * Number(item.quantity || 1));
}

function safeItems(items = [], servicesById, productsById) {
  return (Array.isArray(items) ? items : []).map((item) => {
    const service = servicesById.get(item.id || item.serviceId);
    const product = productsById.get(item.id || item.productId);
    return {
      id: item.id || item.serviceId || item.productId || "",
      type: item.type || (service ? "service" : "product"),
      name: item.name || service?.name || product?.name || "",
      quantity: Number(item.quantity || 1),
      price: Number(item.price || item.unitPrice || service?.price || product?.price || 0),
      amount: itemAmount({ ...item, price: item.price || item.unitPrice || service?.price || product?.price || 0 }),
      stock: product ? Number(product.stock || 0) : undefined,
      margin: product ? money(Number(product.price || 0) - Number(product.unitCost || 0)) : undefined
    };
  });
}

export function buildPosAiContext({ clientId = "", branchId = "", staffId = "", appointmentId = "", items = [], discount = 0, payments = [], access }) {
  const effectiveBranchId = branchId || access.branchId || "";
  if (effectiveBranchId) tenantService.assertBranchAccess(access, effectiveBranchId);
  const scoped = scope(access, effectiveBranchId);
  const tenantScoped = scope(access);

  const services = repositories.services.list({ limit: 10000 }, tenantScoped);
  const products = repositories.products.list(effectiveBranchId ? { branchId: effectiveBranchId, limit: 10000 } : { limit: 10000 }, scoped);
  const servicesById = new Map(services.map((service) => [service.id, service]));
  const productsById = new Map(products.map((product) => [product.id, product]));
  const normalizedItems = safeItems(items, servicesById, productsById);

  const client = clientId ? repositories.clients.getById(clientId, tenantScoped) : null;
  if (clientId && !client) throw notFound("Client not found for POS AI");
  if (client?.branchId) tenantService.assertBranchAccess(access, client.branchId);

  const appointment = appointmentId ? repositories.appointments.getById(appointmentId, tenantScoped) : null;
  if (appointmentId && !appointment) throw notFound("Appointment not found for POS AI");
  if (appointment?.branchId) tenantService.assertBranchAccess(access, appointment.branchId);

  const activeBranchId = appointment?.branchId || client?.branchId || effectiveBranchId;
  const activeScope = scope(access, activeBranchId);
  const branchQuery = activeBranchId ? { branchId: activeBranchId, limit: 10000 } : { limit: 10000 };
  const staff = staffId ? repositories.staff.getById(staffId, activeScope) : null;
  if (staffId && !staff) throw notFound("Staff member not found for POS AI");

  const clientSales = client
    ? repositories.sales.list(branchQuery, activeScope).filter((sale) => sale.clientId === client.id)
    : [];
  const clientInvoices = client
    ? repositories.invoices.list(branchQuery, activeScope).filter((invoice) => invoice.clientId === client.id)
    : [];
  const memberships = client
    ? repositories.memberships.list(branchQuery, activeScope).filter((membership) => membership.clientId === client.id)
    : [];

  const subtotal = money(normalizedItems.reduce((sum, item) => sum + item.amount, 0));
  const discountAmount = money(discount);
  const paidAmount = money((Array.isArray(payments) ? payments : []).reduce((sum, payment) => sum + Number(payment.amount || 0), 0));
  const productMargin = money(normalizedItems
    .filter((item) => item.type === "product")
    .reduce((sum, item) => sum + Number(item.margin || 0) * Number(item.quantity || 1), 0));
  const serviceRevenue = money(normalizedItems.filter((item) => item.type === "service").reduce((sum, item) => sum + item.amount, 0));
  const pendingPaymentAmount = money(clientInvoices
    .filter((invoice) => status(invoice.status) !== "paid")
    .reduce((sum, invoice) => sum + Number(invoice.balance || 0), 0));

  return {
    tenantId: access.tenantId,
    branchId: activeBranchId,
    client: client ? {
      id: client.id,
      name: client.name,
      phonePresent: Boolean(client.phone),
      emailPresent: Boolean(client.email),
      totalSpend: Number(client.totalSpend || 0),
      visitCount: Number(client.visitCount || 0),
      walletBalance: Number(client.walletBalance || 0),
      loyaltyPoints: Number(client.loyaltyPoints || 0),
      tags: client.tags || []
    } : null,
    staff: staff ? { id: staff.id, name: staff.name, role: staff.role, status: staff.status || "active" } : null,
    appointment: appointment ? {
      id: appointment.id,
      status: appointment.status,
      startAt: appointment.startAt,
      serviceIds: appointment.serviceIds || []
    } : null,
    cart: {
      items: normalizedItems,
      subtotal,
      discount: discountAmount,
      payable: money(Math.max(0, subtotal - discountAmount)),
      paidAmount,
      serviceRevenue,
      productMargin,
      itemCount: normalizedItems.length
    },
    memberships: memberships.map((membership) => ({
      id: membership.id,
      planName: membership.planName,
      status: membership.status || "active",
      creditsRemaining: Number(membership.creditsRemaining || 0),
      validityDate: membership.validityDate || "",
      price: Number(membership.price || 0)
    })),
    history: {
      salesCount: clientSales.length,
      totalHistoricalSpend: money(clientSales.reduce((sum, sale) => sum + Number(sale.total || 0), 0)),
      pendingPaymentAmount,
      invoicesCount: clientInvoices.length
    },
    catalog: {
      activeServices: services.filter((service) => status(service.status || "active") === "active").slice(0, 40).map((service) => ({
        id: service.id,
        name: service.name,
        category: service.category,
        price: Number(service.price || 0),
        durationMinutes: Number(service.durationMinutes || 0),
        addOns: service.addOns || []
      })),
      retailProducts: products.filter((product) => status(product.status || "active") === "active" && Number(product.stock || 0) > 0).slice(0, 40).map((product) => ({
        id: product.id,
        name: product.name,
        category: product.category,
        stock: Number(product.stock || 0),
        price: Number(product.price || 0),
        unitCost: Number(product.unitCost || 0)
      }))
    }
  };
}

export function requireCartItems(context) {
  if (!context.cart.items.length) throw badRequest("At least one cart item is required for this POS AI task");
}
