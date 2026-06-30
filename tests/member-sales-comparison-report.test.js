import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const page = readFileSync("src/app/pages/financial-summary-report.component.ts", "utf8");

test("financial summary exposes Member vs Non-Member Sales tab and filters", () => {
  assert.match(page, /activeTab === 'member-sales'/);
  assert.match(page, /Member vs Non-Member Sales/);

  for (const label of [
    "Client type",
    "All",
    "Members",
    "Non-members",
    "Client, phone or membership plan",
    "Member clients count",
    "Non-member clients count",
    "Member revenue",
    "Non-member revenue",
    "Paid amount",
    "Pending amount",
    "Collection rate %"
  ]) {
    assert.match(page, new RegExp(label.replace(/[/.]/g, "\\$&")), `missing member report label ${label}`);
  }
});

test("member report includes client table, ROI, conversion and staff sections", () => {
  for (const label of [
    "Client name",
    "Phone",
    "Membership status",
    "Active plan name",
    "Total visits",
    "Total sale",
    "Discount used",
    "Last visit date",
    "Suggested action",
    "Member vs Non-Member Comparison",
    "Membership ROI",
    "Conversion Opportunity",
    "Staff-Wise Impact",
    "Member conversion count",
    "Repeat member visits"
  ]) {
    assert.match(page, new RegExp(label.replace(/[/.]/g, "\\$&")), `missing member report section ${label}`);
  }
});

test("member report implements alerts, lazy data load and exports", () => {
  for (const token of [
    "memberSalesRows",
    "visibleMemberSalesRows",
    "memberSalesSummary",
    "memberComparisonRows",
    "membershipRoiRows",
    "memberConversionOpportunities",
    "memberStaffImpactRows",
    "memberSalesAlerts",
    "ensureMemberSalesDataLoaded",
    "exportMemberSalesCsv",
    "exportMemberSalesOwnerPdf",
    "exportMemberConversionPdf",
    "memberships: this.safeList('memberships'",
    "clients: this.safeList('clients'"
  ]) {
    assert.match(page, new RegExp(token.replace(/[()]/g, "\\$&")), `missing member report implementation token ${token}`);
  }

  for (const alert of [
    "High value non-member",
    "Repeat non-member not converted",
    "Member using high discount",
    "Member pending due",
    "Expired member still visiting",
    "Staff with low membership conversion"
  ]) {
    assert.match(page, new RegExp(alert), `missing owner alert ${alert}`);
  }
});
