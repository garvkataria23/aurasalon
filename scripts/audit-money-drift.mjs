import { db } from "../server/db.js";

const PAISE_SUFFIX = /(paise|_paise|paiseAmount)$/i;
const MONEY_REAL_TYPES = /(REAL|NUMERIC|DOUBLE|FLOAT)/i;
const MONEY_REAL_NAME = /amount|price|cost|balance|value|total|revenue|paid|due|charge|fee|commission|spend|refund|discount|tip|tax|payment|credit|debit|capital|salary|wage|rate|estimated|notional|subtotal|gross|net|face|nominal/i;

function normalize(name) {
  return String(name || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function rupeeTwinName(paiseName) {
  const base = String(paiseName).replace(PAISE_SUFFIX, "");
  return base;
}

function uniq(arr) {
  return [...new Set(arr.map((s) => String(s)))];
}

function moneyColumns(table) {
  let cols = [];
  try { cols = db.prepare(`PRAGMA table_info(${table})`).all(); } catch { return []; }
  return cols;
}

const reports = [];
let totalDualPairs = 0;
let totalDriftRows = 0;

const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map((r) => r.name);

for (const table of tables) {
  const cols = moneyColumns(table);
  const paiseCols = cols.filter((c) => PAISE_SUFFIX.test(c.name));
  const realMoneyCols = cols.filter((c) => MONEY_REAL_TYPES.test(c.type) && MONEY_REAL_NAME.test(c.name));
  if (!paiseCols.length || !realMoneyCols.length) continue;

  const realByName = new Map(realMoneyCols.map((c) => [normalize(c.name), c]));

  for (const p of paiseCols) {
    const twinName = rupeeTwinName(p.name);
    const real = realByName.get(normalize(twinName));
    if (!real) continue;

    totalDualPairs++;
    let drift = 0;
    let total = 0;
    const examples = [];
    try {
      const s = db.prepare(
        `SELECT COUNT(*) AS total, ` +
          `COALESCE(SUM(CASE WHEN CAST(${p.name} AS INTEGER) IS NOT NULL AND CAST(${real.name} AS REAL) IS NOT NULL AND abs(round(CAST(${real.name} AS REAL) * 100) - CAST(${p.name} AS INTEGER)) >= 1 THEN 1 ELSE 0 END), 0) AS drift ` +
          `FROM ${table}`
      ).get();
      total = Number(s.total || 0);
      drift = Number(s.drift || 0);
      if (drift > 0) {
        const idCol = (cols.find((c) => /^id$/.test(c.name)) || {}).name;
        if (idCol) {
          const ex = db.prepare(
            `SELECT ${idCol} AS __id, ${p.name} AS __paise, ${real.name} AS __rupee FROM ${table} ` +
              `WHERE abs(round(CAST(${real.name} AS REAL) * 100) - CAST(${p.name} AS INTEGER)) >= 1 LIMIT 3`
          ).all();
          examples.push(...ex.map((r) => `${r.__id} (rupee=${r.__rupee}, paise=${r.__paise})`));
        }
        totalDriftRows += drift;
      }
    } catch { continue; }

    if (drift > 0) {
      reports.push({ table, rupee: real.name, paise: p.name, total, drift, examples });
    }
  }
}

reports.sort((a, b) => b.drift - a.drift);

console.log("=== MONEY DRIFT SCAN (read-only) ===");
console.log(`Tables scanned   : ${tables.length}`);
console.log(`Dual money pairs : ${totalDualPairs}`);
console.log(`Drift rows total : ${totalDriftRows}`);
console.log(`Tables with drift: ${reports.length}`);
console.log("");

if (!reports.length) {
  console.log("No drift detected. All dual REAL<->Paise columns are in sync.");
} else {
  for (const r of reports) {
    console.log(`--- ${r.table}  [${r.rupee} <-> ${r.paise}]  drift ${r.drift}/${r.total}`);
    for (const ex of r.examples) console.log("    " + ex);
  }
}
console.log("");
console.log("NOTE: read-only scan; writes nothing.");
