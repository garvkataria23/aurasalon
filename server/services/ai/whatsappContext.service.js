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

function hasOptOut(client) {
  const tags = (client?.tags || []).map((tag) => String(tag).toLowerCase());
  return tags.some((tag) => ["opt-out", "dnd", "do-not-disturb", "whatsapp-opt-out"].includes(tag));
}

export function buildWhatsappAiContext({
  clientId = "",
  appointmentId = "",
  invoiceId = "",
  branchId = "",
  message = "",
  access
}) {
  if (!clientId && !message) throw badRequest("clientId or message is required for WhatsApp AI");
  const effectiveBranchId = branchId || access.branchId || "";
  if (effectiveBranchId) tenantService.assertBranchAccess(access, effectiveBranchId);
  const tenantScoped = scope(access);

  const appointment = appointmentId ? repositories.appointments.getById(appointmentId, tenantScoped) : null;
  if (appointmentId && !appointment) throw notFound("Appointment not found for WhatsApp AI");
  if (appointment?.branchId) tenantService.assertBranchAccess(access, appointment.branchId);

  const invoice = invoiceId ? repositories.invoices.getById(invoiceId, tenantScoped) : null;
  if (invoiceId && !invoice) throw notFound("Invoice not found for WhatsApp AI");
  if (invoice?.branchId) tenantService.assertBranchAccess(access, invoice.branchId);

  const resolvedClientId = clientId || appointment?.clientId || invoice?.clientId || "";
  const client = resolvedClientId ? repositories.clients.getById(resolvedClientId, tenantScoped) : null;
  if (resolvedClientId && !client) throw notFound("Client not found for WhatsApp AI");
  if (client?.branchId) tenantService.assertBranchAccess(access, client.branchId);

  const activeBranchId = appointment?.branchId || invoice?.branchId || client?.branchId || effectiveBranchId;
  const activeScope = scope(access, activeBranchId);
  const branchQuery = activeBranchId ? { branchId: activeBranchId, limit: 10000 } : { limit: 10000 };
  const clientAppointments = client ? repositories.appointments.list(branchQuery, activeScope).filter((item) => item.clientId === client.id) : [];
  const clientInvoices = client ? repositories.invoices.list(branchQuery, activeScope).filter((item) => item.clientId === client.id) : [];
  const pendingPaymentAmount = money(clientInvoices
    .filter((item) => status(item.status) !== "paid")
    .reduce((sum, item) => sum + Number(item.balance || 0), 0));

  return {
    tenantId: access.tenantId,
    branchId: activeBranchId,
    message,
    safeguards: {
      phonePresent: Boolean(client?.phone),
      optedOut: hasOptOut(client),
      draftOnly: true
    },
    client: client ? {
      id: client.id,
      name: client.name,
      phonePresent: Boolean(client.phone),
      emailPresent: Boolean(client.email),
      tags: client.tags || [],
      totalSpend: Number(client.totalSpend || 0),
      visitCount: Number(client.visitCount || 0),
      lastVisitAt: client.lastVisitAt || "",
      walletBalance: Number(client.walletBalance || 0),
      loyaltyPoints: Number(client.loyaltyPoints || 0)
    } : null,
    appointment: appointment ? {
      id: appointment.id,
      startAt: appointment.startAt,
      endAt: appointment.endAt,
      status: appointment.status,
      serviceIds: appointment.serviceIds || []
    } : null,
    invoice: invoice ? {
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      total: Number(invoice.total || 0),
      paid: Number(invoice.paid || 0),
      balance: Number(invoice.balance || 0),
      status: invoice.status || "unpaid"
    } : null,
    history: {
      appointments: clientAppointments.length,
      invoices: clientInvoices.length,
      pendingPaymentAmount,
      lastAppointmentAt: clientAppointments.map((item) => item.startAt).filter(Boolean).sort().at(-1) || ""
    }
  };
}
