import { db, applyInventoryDelta, deductServiceUsage, updateInvoiceStatus } from "../db.js";
import { repositories } from "../repositories/repository-registry.js";
import { badRequest, conflict, notFound } from "../utils/app-error.js";
import { tenantService } from "./tenant.service.js";

const now = () => new Date().toISOString();
const makeId = (prefix) => `${prefix}_${crypto.randomUUID().slice(0, 10)}`;
const money = (value) => Math.round((Number(value) || 0) * 100) / 100;

function scope(access, branchId = "") {
  const scoped = tenantService.accessScope(access || {}, "");
  if (branchId) scoped.branchId = branchId;
  return scoped;
}

function requireRecord(repo, id, label, access) {
  const row = repo.getById(id, scope(access));
  if (!row) throw notFound(`${label} not found`);
  if (row.branchId) tenantService.assertBranchAccess(access, row.branchId);
  return row;
}

function calculateInvoice(items = [], discount = 0) {
  const subtotal = items.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 1), 0);
  const discountAmount = Math.min(Number(discount || 0), subtotal);
  const discountRatio = subtotal ? discountAmount / subtotal : 0;
  const gstAmount = items.reduce((sum, item) => {
    const line = Number(item.price || 0) * Number(item.quantity || 1);
    return sum + line * (1 - discountRatio) * (Number(item.gstRate ?? 18) / 100);
  }, 0);
  return {
    subtotal: money(subtotal),
    discount: money(discountAmount),
    gstAmount: money(gstAmount),
    total: money(subtotal - discountAmount + gstAmount)
  };
}

function paymentTotal(payments = []) {
  return money(payments.reduce((sum, payment) => sum + Math.max(0, Number(payment.amount || 0)), 0));
}

function commissionFor(staffId, items = [], access) {
  const staff = staffId ? repositories.staff.getById(staffId, scope(access)) : null;
  const rule = staff?.commissionRule || {};
  return money(
    items.reduce((sum, item) => {
      const line = Number(item.price || 0) * Number(item.quantity || 1);
      const percent = item.type === "product" ? Number(rule.retailPercent || 0) : Number(rule.servicePercent || 0);
      return sum + (line * percent) / 100;
    }, 0)
  );
}

function normalizeSaleItems(items = [], access) {
  return items.map((item) => {
    if (item.type === "service" && item.id) {
      const service = requireRecord(repositories.services, item.id, "Service", access);
      return {
        type: "service",
        id: service.id,
        name: service.name,
        quantity: Number(item.quantity || 1),
        price: Number(item.price ?? service.price),
        gstRate: Number(service.gstRate || 18)
      };
    }
    if (item.type === "product" && item.id) {
      const product = requireRecord(repositories.products, item.id, "Product", access);
      return {
        type: "product",
        id: product.id,
        name: product.name,
        quantity: Number(item.quantity || 1),
        price: Number(item.price ?? product.price),
        gstRate: Number(product.gstRate || 18)
      };
    }
    return {
      type: item.type || "custom",
      id: item.id || "",
      name: item.name,
      quantity: Number(item.quantity || 1),
      price: Number(item.price || 0),
      gstRate: Number(item.gstRate ?? 18)
    };
  });
}

function applyWalletDebit({ clientId, branchId, amount, invoiceId, access }) {
  if (!amount) return null;
  const client = requireRecord(repositories.clients, clientId, "Client", access);
  const balance = money(client.walletBalance || 0);
  if (amount > balance) throw conflict("Wallet payment exceeds available wallet balance");
  const nextBalance = money(balance - amount);
  repositories.clients.update(clientId, { walletBalance: nextBalance }, scope(access));
  return repositories.walletTransactions.create({
    id: makeId("wallet"),
    branchId,
    clientId,
    type: "debit",
    amount,
    balanceAfter: nextBalance,
    referenceType: "invoice",
    referenceId: invoiceId,
    notes: "Wallet payment applied to invoice",
    metadata: { invoiceId }
  }, scope(access, branchId));
}

function createPaymentRecords(invoiceId, payments = [], access, { clientId = "", branchId = "", invoiceTotal = 0 } = {}) {
  const totalPaid = paymentTotal(payments);
  if (invoiceTotal && totalPaid > money(invoiceTotal) + 0.01) throw conflict("Payment total cannot exceed invoice total");
  payments
    .filter((payment) => Number(payment.amount) > 0)
    .forEach((payment) => {
      if (payment.mode === "wallet") {
        applyWalletDebit({ clientId, branchId, amount: money(payment.amount), invoiceId, access });
      }
      repositories.payments.create({
        id: makeId("pay"),
        invoiceId,
        mode: payment.mode,
        amount: money(payment.amount),
        reference: payment.reference || ""
      }, scope(access));
    });
  return updateInvoiceStatus(invoiceId, access?.tenantId);
}

function updateClientAfterSale(clientId, sale, invoice, access) {
  const client = requireRecord(repositories.clients, clientId, "Client", access);
  const visitHistory = Array.isArray(client.visitHistory) ? client.visitHistory : [];
  const purchaseHistory = Array.isArray(client.purchaseHistory) ? client.purchaseHistory : [];
  const loyaltyEarned = Math.floor(Number(invoice.total || 0) / 100);
  repositories.clients.update(clientId, {
    totalSpend: money(Number(client.totalSpend || 0) + Number(invoice.total || 0)),
    visitCount: Number(client.visitCount || 0) + 1,
    lastVisitAt: now(),
    loyaltyPoints: Number(client.loyaltyPoints || 0) + loyaltyEarned,
    visitHistory: [
      { date: now().slice(0, 10), saleId: sale.id, staffId: sale.staffId, appointmentId: sale.appointmentId || "" },
      ...visitHistory
    ].slice(0, 50),
    purchaseHistory: [
      { date: now().slice(0, 10), invoice: invoice.invoiceNumber, amount: invoice.total, items: sale.items },
      ...purchaseHistory
    ].slice(0, 50)
  }, scope(access));
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderInvoiceHtml({ invoice, sale, client, branch, payments }) {
  const rows = (invoice.lineItems || []).map((item) => `
    <tr>
      <td>${escapeHtml(item.name)}</td>
      <td>${Number(item.quantity || 1)}</td>
      <td>INR ${money(item.price || 0).toFixed(2)}</td>
      <td>${Number(item.gstRate || 0)}%</td>
      <td>INR ${money(Number(item.price || 0) * Number(item.quantity || 1)).toFixed(2)}</td>
    </tr>`).join("");
  return `<!doctype html>
<html>
<head><meta charset="utf-8"><title>${escapeHtml(invoice.invoiceNumber)}</title></head>
<body>
  <h1>${escapeHtml(branch?.name || "Aura Salon")}</h1>
  <p>${escapeHtml(branch?.address || "")}</p>
  <h2>Tax Invoice ${escapeHtml(invoice.invoiceNumber)}</h2>
  <p>Client: ${escapeHtml(client?.name || "")} (${escapeHtml(client?.phone || "")})</p>
  <p>Date: ${escapeHtml(invoice.createdAt || "")}</p>
  <table border="1" cellspacing="0" cellpadding="6">
    <thead><tr><th>Item</th><th>Qty</th><th>Price</th><th>GST</th><th>Total</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <p>Subtotal: INR ${money(invoice.subtotal).toFixed(2)}</p>
  <p>Discount: INR ${money(invoice.discount).toFixed(2)}</p>
  <p>Coupon: ${escapeHtml(invoice.couponCode || sale?.couponCode || "None")} / INR ${money(invoice.couponDiscount || 0).toFixed(2)}</p>
  <p>GST: INR ${money(invoice.gstAmount).toFixed(2)}</p>
  <h3>Total: INR ${money(invoice.total).toFixed(2)}</h3>
  <p>Paid: INR ${money(invoice.paid).toFixed(2)} | Balance: INR ${money(invoice.balance).toFixed(2)} | Status: ${escapeHtml(invoice.status)}</p>
  <p>Payments: ${escapeHtml(payments.map((payment) => `${payment.mode}: INR ${money(payment.amount).toFixed(2)}`).join(", ") || "None")}</p>
</body>
</html>`;
}

export class SalonOperationsService {
  completeAppointment(id, notes, access) {
    const appointment = requireRecord(repositories.appointments, id, "Appointment", access);
    const updated = repositories.appointments.update(appointment.id, {
      status: "completed",
      billable: 1,
      notes: notes ?? appointment.notes
    }, scope(access));
    const inventoryDeductions = deductServiceUsage(appointment.serviceIds, appointment.branchId, "appointment", appointment.id, access.tenantId);
    return { appointment: updated, billable: true, inventoryDeductions };
  }

  updateAppointmentStatus(id, status, access) {
    const allowed = ["booked", "arrived", "no-show", "completed", "cancelled"];
    if (!allowed.includes(status)) throw badRequest("Invalid appointment status");
    const appointment = requireRecord(repositories.appointments, id, "Appointment", access);
    return repositories.appointments.update(appointment.id, {
      status,
      billable: status === "completed" ? 1 : appointment.billable
    }, scope(access));
  }

  adjustInventory({ productId, branchId, quantity, type = "adjustment", reason = "Manual stock adjustment" }, access) {
    if (!productId || !branchId || !quantity) throw badRequest("productId, branchId and quantity are required");
    tenantService.assertBranchAccess(access, branchId);
    return applyInventoryDelta({
      productId,
      branchId,
      quantity: Number(quantity),
      type,
      reason,
      referenceType: "manual",
      referenceId: "",
      tenantId: access.tenantId
    });
  }

  transferStock({ productId, fromBranchId, toBranchId, quantity }, access) {
    if (!productId || !fromBranchId || !toBranchId || !quantity) {
      throw badRequest("productId, fromBranchId, toBranchId and quantity are required");
    }
    tenantService.assertBranchAccess(access, fromBranchId);
    tenantService.assertBranchAccess(access, toBranchId);
    const product = requireRecord(repositories.products, productId, "Product", access);
    const outgoing = applyInventoryDelta({
      productId,
      branchId: fromBranchId,
      quantity: -Math.abs(Number(quantity)),
      type: "transfer-out",
      reason: `Transfer to ${toBranchId}`,
      referenceType: "branch-transfer",
      referenceId: toBranchId,
      tenantId: access.tenantId
    });
    const targetProduct = repositories.products.list({ branchId: toBranchId, limit: 10000 }, scope(access)).find((item) => item.sku === product.sku);
    const incomingProduct =
      targetProduct ||
      repositories.products.create({
        ...product,
        id: makeId("prod"),
        branchId: toBranchId,
        stock: 0,
        createdAt: undefined,
        updatedAt: undefined
      }, scope(access));
    const incoming = applyInventoryDelta({
      productId: incomingProduct.id,
      branchId: toBranchId,
      quantity: Math.abs(Number(quantity)),
      type: "transfer-in",
      reason: `Transfer from ${fromBranchId}`,
      referenceType: "branch-transfer",
      referenceId: fromBranchId,
      tenantId: access.tenantId
    });
    return { outgoing, incoming };
  }

  checkoutSale(payload, access) {
    const {
      clientId,
      appointmentId = "",
      branchId,
      staffId = "",
      discount = 0,
      couponCode = "",
      payments = [],
      membershipRedeem = {}
    } = payload;
    const requestedItems = payload.items || [];
    if (!clientId || !branchId || !requestedItems.length) throw badRequest("clientId, branchId and items are required");
    tenantService.ensureSubscriptionActive(access.tenantId);
    tenantService.assertBranchAccess(access, branchId);
    requireRecord(repositories.clients, clientId, "Client", access);

    if (appointmentId) {
      const appointment = requireRecord(repositories.appointments, appointmentId, "Appointment", access);
      if (appointment.status !== "completed") throw conflict("Appointment must be completed before billing");
    }

    const items = normalizeSaleItems(requestedItems, access);
    const coupon = couponCode ? this.validateCoupon({ code: couponCode, branchId, items, subtotal: items.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 1), 0) }, access) : null;
    const couponDiscount = money(coupon?.discountAmount || 0);
    const totals = calculateInvoice(items, Number(discount || 0) + couponDiscount);
    const sale = repositories.sales.create({
      id: makeId("sale"),
      clientId,
      appointmentId,
      branchId,
      staffId,
      items,
      ...totals,
      couponCode: coupon?.coupon?.code || "",
      couponDiscount,
      commissionTotal: commissionFor(staffId, items, access),
      membershipRedeem,
      splitPayments: payments,
      status: "completed"
    }, scope(access));

    for (const item of items) {
      if (item.type === "product") {
        applyInventoryDelta({
          productId: item.id,
          branchId,
          quantity: -Math.abs(Number(item.quantity || 1)),
          type: "sale-deduction",
          reason: "Retail product sold",
          referenceType: "sale",
          referenceId: sale.id,
          tenantId: access.tenantId
        });
      }
    }

    if (!appointmentId) {
      deductServiceUsage(
        items.filter((item) => item.type === "service").map((item) => item.id),
        branchId,
        "sale",
        sale.id,
        access.tenantId
      );
    }

    if (membershipRedeem?.membershipId && membershipRedeem?.creditsUsed) {
      this.redeemMembership({ ...membershipRedeem, saleId: sale.id, serviceId: membershipRedeem.serviceId || "" }, access);
    }

    const invoice = repositories.invoices.create({
      id: makeId("inv"),
      saleId: sale.id,
      clientId,
      invoiceNumber: `AURA-${new Date().getFullYear()}-${String(repositories.invoices.count(scope(access)) + 1).padStart(5, "0")}`,
      lineItems: items,
      ...totals,
      couponCode: coupon?.coupon?.code || "",
      couponDiscount,
      paid: 0,
      balance: totals.total,
      status: "unpaid",
      dueDate: now().slice(0, 10)
    }, scope(access));
    if (coupon?.coupon?.id) {
      repositories.couponCodes.update(coupon.coupon.id, { usedCount: Number(coupon.coupon.usedCount || 0) + 1 }, scope(access));
    }
    const paidInvoice = createPaymentRecords(invoice.id, payments, access, { clientId, branchId, invoiceTotal: totals.total });
    updateClientAfterSale(clientId, sale, paidInvoice, access);
    tenantService.recordUsage({ tenantId: access.tenantId, metric: "sales", referenceType: "sale", referenceId: sale.id });
    const invoiceDocument = this.generateInvoiceDocument(paidInvoice.id, access);
    return { sale, invoice: paidInvoice, coupon, invoiceDocument };
  }

  addInvoicePayment(invoiceId, { mode, amount, reference = "" }, access) {
    const invoice = requireRecord(repositories.invoices, invoiceId, "Invoice", access);
    const sale = invoice.saleId ? repositories.sales.getById(invoice.saleId, scope(access)) : null;
    if (mode === "wallet") {
      applyWalletDebit({ clientId: invoice.clientId, branchId: sale?.branchId || "", amount: money(amount), invoiceId, access });
    }
    const payment = repositories.payments.create({
      id: makeId("pay"),
      invoiceId,
      mode,
      amount: money(amount),
      reference
    }, scope(access));
    return { payment, invoice: updateInvoiceStatus(invoiceId, access.tenantId) };
  }

  validateCoupon({ code = "", branchId = "", items = [], subtotal = 0 } = {}, access) {
    const normalizedCode = String(code || "").trim().toUpperCase();
    if (!normalizedCode) throw badRequest("coupon code is required");
    if (branchId) tenantService.assertBranchAccess(access, branchId);
    const coupon = repositories.couponCodes
      .list({ limit: 10000 }, scope(access))
      .find((item) => String(item.code || "").toUpperCase() === normalizedCode && (!item.branchId || item.branchId === branchId));
    if (!coupon || coupon.status !== "active") throw notFound("Coupon code not found or inactive");
    const today = now().slice(0, 10);
    if (coupon.startsAt && coupon.startsAt > today) throw conflict("Coupon is not active yet");
    if (coupon.endsAt && coupon.endsAt < today) throw conflict("Coupon has expired");
    if (Number(coupon.usageLimit || 0) && Number(coupon.usedCount || 0) >= Number(coupon.usageLimit)) throw conflict("Coupon usage limit reached");
    const subtotalAmount = money(subtotal || items.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 1), 0));
    if (subtotalAmount < Number(coupon.minSubtotal || 0)) throw conflict(`Coupon requires minimum subtotal of ${coupon.minSubtotal}`);
    const rawDiscount = coupon.type === "percentage" ? subtotalAmount * (Number(coupon.value || 0) / 100) : Number(coupon.value || 0);
    const maxDiscount = Number(coupon.maxDiscount || 0);
    const discountAmount = money(Math.min(subtotalAmount, maxDiscount ? Math.min(rawDiscount, maxDiscount) : rawDiscount));
    return { coupon, subtotal: subtotalAmount, discountAmount };
  }

  adjustWallet(clientId, payload = {}, access) {
    const client = requireRecord(repositories.clients, clientId, "Client", access);
    const amount = money(payload.amount);
    if (!amount || amount <= 0) throw badRequest("amount must be greater than zero");
    const type = payload.type === "debit" ? "debit" : "credit";
    const branchId = payload.branchId || client.branchId || access.branchId || "";
    if (branchId) tenantService.assertBranchAccess(access, branchId);
    const current = money(client.walletBalance || 0);
    const nextBalance = type === "credit" ? money(current + amount) : money(current - amount);
    if (nextBalance < 0) throw conflict("Wallet balance cannot go below zero");
    repositories.clients.update(client.id, { walletBalance: nextBalance }, scope(access));
    const transaction = repositories.walletTransactions.create({
      id: makeId("wallet"),
      branchId,
      clientId: client.id,
      type,
      amount,
      balanceAfter: nextBalance,
      referenceType: payload.referenceType || "manual",
      referenceId: payload.referenceId || "",
      notes: payload.notes || "",
      metadata: payload.metadata || {}
    }, scope(access, branchId));
    return { transaction, client: repositories.clients.getById(client.id, scope(access)) };
  }

  generateInvoiceDocument(invoiceId, access) {
    const invoice = requireRecord(repositories.invoices, invoiceId, "Invoice", access);
    const sale = invoice.saleId ? repositories.sales.getById(invoice.saleId, scope(access)) : null;
    if (sale?.branchId) tenantService.assertBranchAccess(access, sale.branchId);
    const client = repositories.clients.getById(invoice.clientId, scope(access));
    const branch = sale?.branchId ? repositories.branches.getById(sale.branchId, scope(access)) : null;
    const payments = repositories.payments.list({ limit: 10000 }, scope(access)).filter((payment) => payment.invoiceId === invoice.id);
    const payload = { invoice, sale, client, branch, payments };
    const content = renderInvoiceHtml(payload);
    return repositories.invoiceDocuments.create({
      id: makeId("idoc"),
      branchId: sale?.branchId || "",
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      format: "html",
      content,
      payload,
      status: "generated"
    }, scope(access, sale?.branchId || ""));
  }

  createCreditNote({ invoiceId, amount, reason = "", lineItems = [] } = {}, access) {
    if (!invoiceId || !amount) throw badRequest("invoiceId and amount are required");
    const invoice = requireRecord(repositories.invoices, invoiceId, "Invoice", access);
    const sale = invoice.saleId ? repositories.sales.getById(invoice.saleId, scope(access)) : null;
    if (sale?.branchId) tenantService.assertBranchAccess(access, sale.branchId);
    const count = repositories.creditNotes.count(scope(access));
    return repositories.creditNotes.create({
      id: makeId("cn"),
      branchId: sale?.branchId || "",
      invoiceId: invoice.id,
      saleId: invoice.saleId || "",
      clientId: invoice.clientId,
      creditNoteNumber: `CN-${new Date().getFullYear()}-${String(count + 1).padStart(5, "0")}`,
      amount: money(amount),
      reason,
      lineItems: lineItems.length ? lineItems : invoice.lineItems,
      status: "issued",
      createdBy: access.userId || ""
    }, scope(access, sale?.branchId || ""));
  }

  redeemMembership({ membershipId, creditsUsed = 0, saleId = "", serviceId = "" }, access) {
    if (!membershipId || !creditsUsed) return null;
    const membership = requireRecord(repositories.memberships, membershipId, "Membership", access);
    if (Number(membership.creditsRemaining) < Number(creditsUsed)) {
      throw conflict("Membership does not have enough credits");
    }
    return repositories.memberships.update(membershipId, {
      creditsRemaining: Number(membership.creditsRemaining) - Number(creditsUsed),
      redeemHistory: [
        { date: now().slice(0, 10), credits: Number(creditsUsed), saleId, serviceId },
        ...(membership.redeemHistory || [])
      ]
    }, scope(access));
  }

  segmentClients({ tag = "", minSpend = 0, minVisits = 0, branchId = "", membershipOnly = false }, access) {
    if (branchId) tenantService.assertBranchAccess(access, branchId);
    const clients = repositories.clients.list({ branchId, limit: 10000 }, scope(access)).filter((client) => {
      const tagMatch = tag ? (client.tags || []).map((item) => String(item).toLowerCase()).includes(String(tag).toLowerCase()) : true;
      const spendMatch = Number(client.totalSpend || 0) >= Number(minSpend || 0);
      const visitMatch = Number(client.visitCount || 0) >= Number(minVisits || 0);
      const membershipMatch = membershipOnly ? Boolean(client.membershipId) : true;
      return tagMatch && spendMatch && visitMatch && membershipMatch;
    });
    return { count: clients.length, clients };
  }

  sendCampaign(id, clients = [], access) {
    const campaign = requireRecord(repositories.campaigns, id, "Campaign", access);
    const segment = clients.length ? clients : repositories.clients.list({ limit: 10000 }, scope(access));
    segment.forEach((client) => {
      repositories.notifications.create({
        id: makeId("note"),
        clientId: client.id,
        type: "campaign",
        channel: campaign.channel,
        message: campaign.template.replaceAll("{{name}}", client.name),
        status: campaign.channel.toLowerCase() === "whatsapp" ? "queued-whatsapp" : "queued"
      }, scope(access));
    });
    return repositories.campaigns.update(campaign.id, {
      status: "sent",
      sentCount: Number(campaign.sentCount || 0) + segment.length
    }, scope(access));
  }

  dashboardReport(branchId = "", access) {
    if (branchId) tenantService.assertBranchAccess(access, branchId);
    const queryScope = scope(access, branchId);
    const sales = repositories.sales.list({ branchId, limit: 10000 }, queryScope);
    const invoices = repositories.invoices.list({ limit: 10000 }, queryScope);
    const appointments = repositories.appointments.list({ branchId, limit: 10000 }, queryScope);
    const clients = repositories.clients.list({ branchId, limit: 10000 }, queryScope);
    const products = repositories.products.list({ branchId, limit: 10000 }, queryScope);
    const memberships = repositories.memberships.list({ branchId, limit: 10000 }, queryScope);
    const staff = repositories.staff.list({ branchId, limit: 10000 }, queryScope);
    const today = new Date().toISOString().slice(0, 10);
    const month = today.slice(0, 7);
    const todaySales = sales.filter((sale) => sale.createdAt?.startsWith(today));
    const monthSales = sales.filter((sale) => sale.createdAt?.startsWith(month));
    const pendingInvoices = invoices.filter((invoice) => invoice.status !== "paid");
    const completedAppointments = appointments.filter((appointment) => appointment.status === "completed");
    const repeatCustomers = clients.filter((client) => Number(client.visitCount) > 1).length;

    return {
      revenueToday: money(todaySales.reduce((sum, sale) => sum + Number(sale.total), 0)),
      revenueMonth: money(monthSales.reduce((sum, sale) => sum + Number(sale.total), 0)),
      totalBookings: appointments.length,
      newClients: clients.filter((client) => client.createdAt?.startsWith(month)).length,
      pendingPayments: money(pendingInvoices.reduce((sum, invoice) => sum + Number(invoice.balance), 0)),
      lowStockAlerts: products.filter((product) => Number(product.stock) <= Number(product.lowStockThreshold)),
      expiryAlerts: products.filter((product) => product.expiryDate && product.expiryDate <= "2026-08-31"),
      staffPerformance: staff.map((person) => ({
        id: person.id,
        name: person.name,
        role: person.role,
        branchId: person.branchId,
        revenue: Number(person.performance?.revenue || 0),
        bookings: Number(person.performance?.bookings || 0),
        commission: commissionFor(person.id, sales.flatMap((sale) => sale.items || []), access)
      })),
      membershipRevenue: money(memberships.reduce((sum, membership) => sum + Number(membership.price || 0), 0)),
      repeatCustomerRate: clients.length ? Math.round((repeatCustomers / clients.length) * 100) : 0,
      clientRetention: appointments.length ? Math.round((completedAppointments.length / appointments.length) * 100) : 0,
      quickActions: ["Front-desk quick booking", "Walk-in POS checkout", "WhatsApp confirmation", "Purchase entry", "Daily closing"]
    };
  }

  advancedReport(access) {
    const queryScope = scope(access);
    const sales = repositories.sales.all(queryScope);
    const invoices = repositories.invoices.all(queryScope);
    const appointments = repositories.appointments.all(queryScope);
    const clients = repositories.clients.all(queryScope);
    const products = repositories.products.all(queryScope);
    const memberships = repositories.memberships.all(queryScope);
    const payments = repositories.payments.all(queryScope);
    const revenue = sales.reduce((sum, sale) => sum + Number(sale.total || 0), 0);
    const cost = products.reduce((sum, product) => sum + Number(product.unitCost || 0) * Number(product.stock || 0), 0);
    return {
      sales: { count: sales.length, revenue: money(revenue), gst: money(invoices.reduce((sum, invoice) => sum + Number(invoice.gstAmount || 0), 0)) },
      bookings: {
        total: appointments.length,
        completed: appointments.filter((item) => item.status === "completed").length,
        noShow: appointments.filter((item) => item.status === "no-show").length
      },
      staff: repositories.staff.list({ limit: 10000 }, queryScope).map((person) => ({ name: person.name, role: person.role, ...person.performance })),
      inventory: { lowStock: products.filter((item) => Number(item.stock) <= Number(item.lowStockThreshold)).length, stockValue: money(cost) },
      retention: { repeatCustomerRate: clients.length ? Math.round((clients.filter((item) => Number(item.visitCount) > 1).length / clients.length) * 100) : 0 },
      memberships: {
        active: memberships.filter((item) => item.status === "active").length,
        creditsOpen: memberships.reduce((sum, item) => sum + Number(item.creditsRemaining || 0), 0)
      },
      gst: { collected: money(invoices.reduce((sum, invoice) => sum + Number(invoice.gstAmount || 0), 0)), invoices: invoices.length },
      dailyClosing: {
        cash: money(payments.filter((item) => item.mode === "cash").reduce((sum, item) => sum + Number(item.amount), 0)),
        upi: money(payments.filter((item) => item.mode === "upi").reduce((sum, item) => sum + Number(item.amount), 0)),
        card: money(payments.filter((item) => item.mode === "card").reduce((sum, item) => sum + Number(item.amount), 0))
      },
      profitLoss: { revenue: money(revenue), estimatedInventoryCost: money(cost), grossProfit: money(revenue - cost) }
    };
  }

  reportByType(type, branchId = "", access) {
    const report = db.prepare("SELECT ? AS type").get(type);
    return { ...report, generatedAt: now(), dashboard: this.dashboardReport(branchId, access) };
  }
}

export const salonOperationsService = new SalonOperationsService();
