import xlsx from "xlsx";
import { db } from "../../db.js";
import { badRequest, notFound } from "../../utils/app-error.js";
import { tenantService } from "../tenant.service.js";
import { knowledgeBaseService } from "./knowledgeBase.service.js";

export const AURASHINE_IMPORTER_NAME = "aurashine-salon-google-sheet";
export const AURASHINE_IMPORTER_VERSION = "2026-05-22";
const DEFAULT_SOURCE_TYPE = "google_sheet";
const EXCLUDED_SHEET_HINTS = ["enquiry tracker"];
const INCLUDED_SHEET_HINTS = [
  "faq",
  "quick reference",
  "intent router",
  "n8n setup",
  "price list",
  "advanced treatments",
  "aftercare tips",
  "products",
  "jobs careers",
  "membership packages"
];

function clean(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function canonical(value) {
  return clean(value)
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function slug(value) {
  return canonical(value).replace(/\s+/g, "-").slice(0, 120) || "row";
}

function stripMarker(value) {
  return clean(value).replace(/^[\s#>*\-\u2022\u25b6]+/u, "").trim();
}

function isKnowledgeSheet(sheetName) {
  const name = canonical(sheetName);
  if (EXCLUDED_SHEET_HINTS.some((hint) => name.includes(hint))) return false;
  return INCLUDED_SHEET_HINTS.some((hint) => name.includes(hint));
}

function filledCells(row = []) {
  return row.map(clean).filter(Boolean);
}

function findHeaderRow(rows) {
  const known = new Set([
    "category",
    "question",
    "answer",
    "most asked question",
    "quick answer",
    "priority",
    "intent",
    "trigger keywords phrases",
    "primary sheet",
    "secondary sheet",
    "n8n route label",
    "match rule",
    "example user messages",
    "service",
    "ladies",
    "gents",
    "duration",
    "step",
    "node setting",
    "what to do",
    "copy example"
  ]);

  const maxScan = Math.min(rows.length, 12);
  for (let index = 0; index < maxScan; index += 1) {
    const headers = rows[index].map(canonical);
    const score = headers.filter((header) => known.has(header)).length;
    if (score >= 2) {
      return { index, headers, rawHeaders: rows[index].map(clean) };
    }
  }

  return { index: 0, headers: (rows[0] || []).map(canonical), rawHeaders: (rows[0] || []).map(clean) };
}

function headerIndex(headers, candidates) {
  const wanted = candidates.map(canonical);
  return headers.findIndex((header) => wanted.includes(header));
}

function valueFor(row, headers, candidates) {
  const index = headerIndex(headers, candidates);
  return index >= 0 ? clean(row[index]) : "";
}

function detectKind(headers) {
  if (headerIndex(headers, ["Question"]) >= 0 && headerIndex(headers, ["Answer"]) >= 0) return "faq";
  if (headerIndex(headers, ["Most Asked Question"]) >= 0 && headerIndex(headers, ["Quick Answer"]) >= 0) return "quick-reference";
  if (headerIndex(headers, ["Intent"]) >= 0 && headerIndex(headers, ["Trigger keywords / phrases"]) >= 0) return "intent-router";
  if (headerIndex(headers, ["Service"]) >= 0 && headerIndex(headers, ["Duration"]) >= 0) return "price-list";
  if (headerIndex(headers, ["Node / Setting"]) >= 0 || headerIndex(headers, ["What to do"]) >= 0) return "routing-setup";
  return "table";
}

function rowAsObject(row, rawHeaders) {
  const output = {};
  rawHeaders.forEach((header, index) => {
    const key = header || `Column ${index + 1}`;
    const value = clean(row[index]);
    if (value) output[key] = value;
  });
  return output;
}

function branchFor(row, headers, fallbackBranchId = "") {
  const branch = valueFor(row, headers, ["branchId", "branch_id", "branch"]);
  if (!branch || ["all", "global", "*"].includes(canonical(branch))) return fallbackBranchId;
  return branch;
}

function contentFromFields(fields) {
  return Object.entries(fields)
    .filter(([, value]) => clean(value))
    .map(([label, value]) => `${label}: ${clean(value)}`)
    .join("\n");
}

function sourceKeyFor({ workbookId, sheetName, kind, rowNumber, title }) {
  return [
    AURASHINE_IMPORTER_NAME,
    AURASHINE_IMPORTER_VERSION,
    slug(workbookId || "workbook"),
    slug(sheetName),
    kind,
    String(rowNumber),
    slug(title)
  ].join(":");
}

function metadataFor({ options, sheetName, kind, rowNumber, rawHeaders, rowObject, sourceKey }) {
  return {
    importer: AURASHINE_IMPORTER_NAME,
    importerVersion: AURASHINE_IMPORTER_VERSION,
    sourceWorkbookId: options.sourceWorkbookId || "",
    sourceWorkbookTitle: options.sourceWorkbookTitle || "AURASHINE SALON",
    sourceSpreadsheetUrl: options.sourceSpreadsheetUrl || "",
    sourceSheetName: sheetName,
    sourceSheetKind: kind,
    sourceRowNumber: rowNumber,
    sourceHeaders: rawHeaders,
    sourceRow: rowObject,
    sourceKey
  };
}

function buildFaqDocument({ row, headers, currentCategory, sheetName, rowNumber, rawHeaders, options }) {
  const question = valueFor(row, headers, ["Question"]);
  const answer = valueFor(row, headers, ["Answer"]);
  if (!question || !answer) return null;
  const category = valueFor(row, headers, ["Category"]) || currentCategory || stripMarker(sheetName);
  const title = `${stripMarker(sheetName)}: ${question}`;
  const content = contentFromFields({
    "Source sheet": sheetName,
    Category: category,
    Question: question,
    Answer: answer
  });
  return { title, category: "faq", content };
}

function buildQuickReferenceDocument({ row, headers, sheetName }) {
  const question = valueFor(row, headers, ["Most Asked Question"]);
  const answer = valueFor(row, headers, ["Quick Answer"]);
  if (!question || !answer) return null;
  return {
    title: `${stripMarker(sheetName)}: ${question}`,
    category: "quick-reference",
    content: contentFromFields({
      "Source sheet": sheetName,
      Question: question,
      Answer: answer
    })
  };
}

function buildIntentRouterDocument({ row, headers, sheetName }) {
  const intent = valueFor(row, headers, ["Intent"]);
  if (!intent) return null;
  const triggerKeywords = valueFor(row, headers, ["Trigger keywords / phrases"]);
  const routeLabel = valueFor(row, headers, ["n8n route label"]);
  return {
    title: `WhatsApp route: ${intent}`,
    category: "whatsapp-routing",
    content: contentFromFields({
      "Source sheet": sheetName,
      Intent: intent,
      "Trigger keywords": triggerKeywords,
      "Primary sheet": valueFor(row, headers, ["Primary sheet"]),
      "Secondary sheet": valueFor(row, headers, ["Secondary sheet"]),
      "Route label": routeLabel,
      "Match rule": valueFor(row, headers, ["Match rule"]),
      Examples: valueFor(row, headers, ["Example user messages"])
    })
  };
}

function buildPriceDocument({ row, headers, currentCategory, sheetName }) {
  const service = valueFor(row, headers, ["Service"]);
  if (!service) return null;
  const category = valueFor(row, headers, ["Category"]) || currentCategory || "Price List";
  const ladies = valueFor(row, headers, ["Ladies", "Ladies Price"]);
  const gents = valueFor(row, headers, ["Gents", "Gents Price"]);
  const duration = valueFor(row, headers, ["Duration"]);
  return {
    title: `Price List: ${service}`,
    category: "price-list",
    content: contentFromFields({
      "Source sheet": sheetName,
      Category: category,
      Service: service,
      "Customer price/rate/cost answer": service,
      "Ladies price": ladies,
      "Gents price": gents,
      Duration: duration
    })
  };
}

function buildRoutingSetupDocument({ row, headers, sheetName, rowNumber }) {
  const step = valueFor(row, headers, ["Step"]) || String(rowNumber);
  const node = valueFor(row, headers, ["Node / Setting"]);
  const whatToDo = valueFor(row, headers, ["What to do"]);
  const example = valueFor(row, headers, ["Copy / Example"]);
  if (!node && !whatToDo && !example) return null;
  return {
    title: `WhatsApp routing setup: ${node || `Step ${step}`}`,
    category: "whatsapp-routing",
    content: contentFromFields({
      "Source sheet": sheetName,
      Step: step,
      "Node or setting": node,
      "What to do": whatToDo,
      Example: example
    })
  };
}

function buildTableDocument({ row, rawHeaders, sheetName, rowNumber }) {
  const rowObject = rowAsObject(row, rawHeaders);
  const values = Object.values(rowObject).filter(Boolean);
  if (values.length < 2) return null;
  return {
    title: `${stripMarker(sheetName)}: ${values[0] || `Row ${rowNumber}`}`,
    category: "sheet-table",
    content: contentFromFields({ "Source sheet": sheetName, ...rowObject })
  };
}

export function readWorkbook(filePath) {
  return xlsx.readFile(filePath, { cellDates: true });
}

export function buildKnowledgeDocumentsFromWorkbook(workbook, options = {}) {
  if (!workbook?.SheetNames?.length) throw badRequest("A valid workbook is required");
  const documents = [];
  const includedSheets = [];
  const skippedSheets = [];

  for (const sheetName of workbook.SheetNames) {
    if (!isKnowledgeSheet(sheetName)) {
      skippedSheets.push(sheetName);
      continue;
    }
    const sheet = workbook.Sheets[sheetName];
    const rows = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: "", blankrows: false });
    if (!rows.length) {
      skippedSheets.push(sheetName);
      continue;
    }

    const header = findHeaderRow(rows);
    const kind = detectKind(header.headers);
    let currentCategory = "";
    let importedRows = 0;

    for (let rowIndex = header.index + 1; rowIndex < rows.length; rowIndex += 1) {
      const row = rows[rowIndex] || [];
      if (!filledCells(row).length) continue;
      const first = clean(row[0]);
      const second = clean(row[1]);
      const third = clean(row[2]);
      if (first && !second && !third) {
        currentCategory = stripMarker(first);
        continue;
      }

      const rowNumber = rowIndex + 1;
      const rowObject = rowAsObject(row, header.rawHeaders);
      const context = { row, headers: header.headers, rawHeaders: header.rawHeaders, currentCategory, sheetName, rowNumber, options };
      const document = kind === "faq"
        ? buildFaqDocument(context)
        : kind === "quick-reference"
          ? buildQuickReferenceDocument(context)
          : kind === "intent-router"
            ? buildIntentRouterDocument(context)
            : kind === "price-list"
              ? buildPriceDocument(context)
              : kind === "routing-setup"
                ? buildRoutingSetupDocument(context)
                : buildTableDocument(context);

      if (!document) continue;
      const branchId = branchFor(row, header.headers, options.branchId || "");
      const sourceKey = sourceKeyFor({
        workbookId: options.sourceWorkbookId || "aurashine-salon",
        sheetName,
        kind,
        rowNumber,
        title: document.title
      });
      documents.push({
        ...document,
        branchId,
        sourceType: options.sourceType || DEFAULT_SOURCE_TYPE,
        sourceKey,
        metadata: metadataFor({ options, sheetName, kind, rowNumber, rawHeaders: header.rawHeaders, rowObject, sourceKey })
      });
      importedRows += 1;
    }

    includedSheets.push({ name: sheetName, kind, importedRows });
  }

  return { documents, includedSheets, skippedSheets };
}

function assertImportAccess(access, branchIds = []) {
  const tenant = db.prepare("SELECT id FROM tenants WHERE id = ?").get(access?.tenantId || "");
  if (!tenant) throw notFound("Tenant not found for knowledge import");
  for (const branchId of branchIds.filter(Boolean)) {
    const branch = db.prepare("SELECT id FROM branches WHERE id = ? AND tenantId = ?").get(branchId, access.tenantId);
    if (!branch) throw notFound(`Branch not found for knowledge import: ${branchId}`);
    tenantService.assertBranchAccess(access, branchId);
  }
}

function parseJson(value, fallback) {
  if (!value || typeof value !== "string") return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function deleteStaleImportedDocuments({ documents, access, sourceType, sourceWorkbookId, dryRun = false }) {
  const keepKeys = new Set(documents.map((document) => document.sourceKey));
  const branchIds = new Set(documents.map((document) => document.branchId || ""));
  const rows = db.prepare(`
    SELECT id, branchId, sourceKey, metadata
    FROM ai_knowledge_documents
    WHERE tenantId = ? AND sourceType = ?
  `).all(access.tenantId, sourceType);

  const stale = rows.filter((row) => {
    if (!branchIds.has(row.branchId || "")) return false;
    const metadata = parseJson(row.metadata, {});
    if (metadata.importer !== AURASHINE_IMPORTER_NAME) return false;
    if (sourceWorkbookId && metadata.sourceWorkbookId !== sourceWorkbookId) return false;
    return !keepKeys.has(row.sourceKey || metadata.sourceKey || "");
  });

  if (!dryRun) {
    for (const row of stale) {
      knowledgeBaseService.deleteDocument(row.id, access);
    }
  }
  return stale.length;
}

export function importKnowledgeDocuments(documents = [], access, options = {}) {
  const sourceType = options.sourceType || DEFAULT_SOURCE_TYPE;
  const sourceWorkbookId = options.sourceWorkbookId || "";
  const branchIds = [...new Set(documents.map((document) => document.branchId || ""))];
  assertImportAccess(access, branchIds);
  const summary = {
    created: 0,
    updated: 0,
    deleted: 0,
    chunks: 0,
    documents: documents.length,
    dryRun: Boolean(options.dryRun)
  };

  if (!options.dryRun) {
    for (const document of documents) {
      const result = knowledgeBaseService.upsertImportedDocument({ ...document, sourceType }, access);
      if (result.created) summary.created += 1;
      else summary.updated += 1;
      summary.chunks += result.chunks;
    }
  }

  if (options.syncStale !== false) {
    summary.deleted = deleteStaleImportedDocuments({
      documents,
      access,
      sourceType,
      sourceWorkbookId,
      dryRun: options.dryRun
    });
  }

  return summary;
}

export function importKnowledgeWorkbook(workbook, access, options = {}) {
  const parsed = buildKnowledgeDocumentsFromWorkbook(workbook, options);
  const summary = importKnowledgeDocuments(parsed.documents, access, options);
  return { ...parsed, summary };
}
