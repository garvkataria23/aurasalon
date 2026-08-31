import { db } from "../server/db.js";

const msg = [];
const log = (s) => { console.log(s); msg.push(s); };
const drift1 = () => db.prepare(
  "SELECT COUNT(*) AS c FROM gift_cards WHERE abs(round(COALESCE(balance,0)*100) - COALESCE(balancePaise,0)) >= 1 OR abs(round(COALESCE(initialValue,0)*100) - COALESCE(initialValuePaise,0)) >= 1"
).get().c;
const drift2 = () => db.prepare(
  "SELECT COUNT(*) AS c FROM invoices WHERE abs(round(COALESCE(tax_total,0)*100) - COALESCE(tax_total_paise,0)) >= 1"
).get().c;

log(`gift_cards drift before: ${drift1()}`);
db.prepare(`UPDATE gift_cards SET
  balancePaise = CAST(round(COALESCE(balance,0)*100) AS INTEGER),
  initialValuePaise = CAST(round(COALESCE(initialValue,0)*100) AS INTEGER),
  initial_value = COALESCE(initialValue, 0)
WHERE abs(round(COALESCE(balance,0)*100) - COALESCE(balancePaise,0)) >= 1
   OR abs(round(COALESCE(initialValue,0)*100) - COALESCE(initialValuePaise,0)) >= 1
   OR abs(round(COALESCE(initial_value,0)*100) - COALESCE(initialValuePaise,0)) >= 1`).run();
log(`gift_cards drift after : ${drift1()}`);

log(`invoices.tax drift before: ${drift2()}`);
db.prepare(`UPDATE invoices SET
  tax_total = CAST(tax_total_paise AS REAL)/100
WHERE abs(round(COALESCE(tax_total,0)*100) - COALESCE(tax_total_paise,0)) >= 1`).run();
log(`invoices.tax drift after : ${drift2()}`);

log("Backfill complete (idempotent; rerun is a no-op).");
console.log(msg.join("\n"));
