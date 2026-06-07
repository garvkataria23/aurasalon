import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  importKnowledgeWorkbook,
  readWorkbook
} from "../server/services/ai/knowledgeSheetImporter.service.js";

const DEFAULT_SPREADSHEET_ID = "13BJQs6cBcRfR3xjIQHGm4ZbB7Ed8TIctEUlfhtIQbyo";
const DEFAULT_SPREADSHEET_TITLE = "AURASHINE SALON";

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    if (key === "dry-run" || key === "no-delete-stale") {
      args[key] = true;
      continue;
    }
    args[key] = argv[index + 1];
    index += 1;
  }
  return args;
}

function exportUrlFor(spreadsheetId) {
  return `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=xlsx`;
}

async function downloadWorkbook(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Unable to download workbook: ${response.status} ${response.statusText}`);
  }
  const contentType = response.headers.get("content-type") || "";
  const buffer = Buffer.from(await response.arrayBuffer());
  if (!buffer.length || contentType.includes("text/html")) {
    throw new Error("Workbook download did not return an XLSX file. Export the Google Sheet locally or provide an authenticated export URL.");
  }
  const filePath = join(tmpdir(), `aurashine-salon-${Date.now()}.xlsx`);
  writeFileSync(filePath, buffer);
  return filePath;
}

function usage() {
  return [
    "Usage:",
    "  npm run seed:ai-knowledge -- --workbook path/to/AURASHINE-SALON.xlsx",
    "  npm run seed:ai-knowledge -- --source-url https://docs.google.com/spreadsheets/d/.../export?format=xlsx",
    "  npm run seed:ai-knowledge -- --spreadsheet-id 13BJQs6cBcRfR3xjIQHGm4ZbB7Ed8TIctEUlfhtIQbyo",
    "",
    "Optional:",
    "  --tenant tenant_aura",
    "  --branch branch_hyd",
    "  --dry-run",
    "  --no-delete-stale"
  ].join("\n");
}

async function resolveWorkbookPath(args) {
  const workbookPath = args.workbook || process.env.AURASHINE_WORKBOOK_PATH || "";
  if (workbookPath) {
    if (!existsSync(workbookPath)) throw new Error(`Workbook not found: ${workbookPath}`);
    return workbookPath;
  }

  const sourceUrl = args["source-url"] || process.env.AURASHINE_SHEETS_EXPORT_URL || "";
  if (sourceUrl) return downloadWorkbook(sourceUrl);

  const spreadsheetId = args["spreadsheet-id"] || process.env.AURASHINE_GOOGLE_SHEET_ID || "";
  if (spreadsheetId) return downloadWorkbook(exportUrlFor(spreadsheetId));

  throw new Error(`No workbook source supplied.\n${usage()}`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const workbookPath = await resolveWorkbookPath(args);
  const spreadsheetId = args["spreadsheet-id"] || process.env.AURASHINE_GOOGLE_SHEET_ID || DEFAULT_SPREADSHEET_ID;
  const tenantId = args.tenant || process.env.SEED_TENANT_ID || "tenant_aura";
  const branchId = args.branch || process.env.AURASHINE_BRANCH_ID || "";
  const access = {
    tenantId,
    role: "owner",
    userId: "aurashine-ai-knowledge-seed",
    branchId,
    branchIds: branchId ? [branchId] : []
  };

  const workbook = readWorkbook(workbookPath);
  const result = importKnowledgeWorkbook(workbook, access, {
    branchId,
    dryRun: Boolean(args["dry-run"]),
    sourceWorkbookId: spreadsheetId,
    sourceWorkbookTitle: DEFAULT_SPREADSHEET_TITLE,
    sourceSpreadsheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}`,
    syncStale: !args["no-delete-stale"]
  });

  console.log(JSON.stringify({
    ok: true,
    tenantId,
    branchId: branchId || "global",
    workbook: DEFAULT_SPREADSHEET_TITLE,
    summary: result.summary,
    includedSheets: result.includedSheets,
    skippedSheets: result.skippedSheets
  }, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
