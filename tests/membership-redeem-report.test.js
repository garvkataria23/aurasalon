import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const service = read("server/services/membership-enterprise.service.js");
const routes = read("server/routes/membership-enterprise.routes.js");
const component = read("src/app/pages/memberships.component.ts");
const reports = read("src/app/pages/reports.component.ts");

assert.match(routes, /\/membership-enterprise\/reports\/redeem/);
assert.match(routes, /membershipRedeemReport\(req\.query,\s*req\.access\)/);

assert.match(service, /membershipRedeemReport\(query = \{\}, access\)/);
assert.match(service, /redeemHistory/);
assert.match(service, /client_membership_ledger/);
assert.match(service, /membership_invoice_snapshots/);
assert.match(service, /totalMembership/);
assert.match(service, /totalEwallet/);
assert.match(service, /totalRedeemed/);
assert.match(service, /redeemCount/);
assert.match(service, /clientsWithActiveWallet/);
assert.match(service, /lastRedeemedToday/);

assert.match(component, /membershipRedeem/);
assert.match(component, /Membership Redeem/);
assert.match(component, /Total Membership/);
assert.match(component, /Total Ewallet/);
assert.match(component, /Last Redeemed Today/);
assert.match(component, /clientSearch/);
assert.match(component, /planType/);
assert.match(component, /redeemStatus/);
assert.match(component, /walletBalance/);
assert.match(component, /ActivatedRoute/);
assert.match(component, /\['\/clients', row\['clientId'\]\]/);
assert.match(component, /\['\/memberships', row\['membershipId'\]\]/);

assert.match(reports, /Membership Redeem/);
assert.match(reports, /report:\s*'membershipRedeem'/);

console.log("membership redeem report wiring ok");
