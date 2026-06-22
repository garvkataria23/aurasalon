import { inflateRawSync, inflateSync } from "node:zlib";
import { env } from "../config/env.js";

const money = (value) => Math.round((Number(value) || 0) * 100) / 100;
const GSTIN_PATTERN = /[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]/gi;

function number(value, fallback = 0) {
  const parsed = Number(String(value ?? "").replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseJsonObject(text = "") {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

function dateFromText(text = "") {
  const match = text.match(/\b(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})\b/);
  if (!match) return "";
  const day = match[1].padStart(2, "0");
  const month = match[2].padStart(2, "0");
  const year = match[3].length === 2 ? `20${match[3]}` : match[3];
  return `${year}-${month}-${day}`;
}

function firstMatch(text = "", patterns = []) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return match[1].trim();
  }
  return "";
}

function invoiceNoFromText(text = "") {
  return firstMatch(text, [
    /\b(?:invoice|inv|bill)\s*(?:no|number|#)?\.?\s*[:#-]?\s*([A-Z]{1,6}\d[A-Z0-9/-]{2,})\b/i,
    /\b(TW\d+\/\d{2}-\d{2})\b/i,
    /\b([A-Z]{2,5}[-/]\d{2,}[-/]\d{2,})\b/i
  ]);
}

function cleanName(value = "") {
  return String(value)
    .replace(/\b(hsn|sac|gst|cgst|sgst|igst|mrp|qty|rate|amount|total|discount|disc)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function supplierNameFromText(rawText = "", lines = []) {
  const upperLines = lines.map((line) => line.trim()).filter(Boolean);
  const invoiceIndex = upperLines.findIndex((line) => /(tax|gst)\s+invoice/i.test(line));
  const searchLines = invoiceIndex >= 0 ? upperLines.slice(invoiceIndex + 1, invoiceIndex + 12) : upperLines.slice(0, 20);
  const candidate = searchLines.find((line) => {
    if (!/[A-Z]/.test(line)) return false;
    if (/(quantity|product|description|invoice|date|details|hsn|gstin|state|unit|rate|amount|original|subject)/i.test(line)) return false;
    return line.replace(/[^A-Z]/g, "").length >= 5;
  });
  if (candidate) return candidate.trim();
  return lines.find((line) => !/(invoice|bill|gst|date|phone|email|m\/s)/i.test(line)) || "";
}

function dataUrlBuffer(payload = {}) {
  const raw = String(payload.fileBase64 || payload.imageBase64 || payload.fileDataUrl || "");
  const base64 = raw.replace(/^data:[^;]+;base64,/, "");
  if (!base64) return null;
  try {
    const buffer = Buffer.from(base64, "base64");
    if (!buffer.length) return null;
    const mimeType = payload.fileMimeType || payload.mimeType || raw.match(/^data:([^;]+);base64,/)?.[1] || "";
    return { buffer, mimeType };
  } catch {
    return null;
  }
}

function isPdfPayload(payload = {}, file = dataUrlBuffer(payload)) {
  const fileName = String(payload.fileName || payload.originalFileName || "").toLowerCase();
  const mimeType = String(file?.mimeType || payload.fileMimeType || payload.mimeType || "").toLowerCase();
  return Boolean(file?.buffer?.slice(0, 5).toString("latin1") === "%PDF-" || mimeType.includes("pdf") || fileName.endsWith(".pdf"));
}

function unescapePdfString(value = "") {
  return String(value)
    .replace(/\\([0-7]{1,3})/g, (_, octal) => String.fromCharCode(parseInt(octal, 8)))
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\r")
    .replace(/\\t/g, "\t")
    .replace(/\\b/g, "\b")
    .replace(/\\f/g, "\f")
    .replace(/\\\(/g, "(")
    .replace(/\\\)/g, ")")
    .replace(/\\\\/g, "\\");
}

function decodePdfHex(value = "") {
  const hex = value.replace(/\s+/g, "");
  if (!hex || hex.length % 2 !== 0) return "";
  const bytes = Buffer.from(hex, "hex");
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    const chars = [];
    for (let index = 2; index + 1 < bytes.length; index += 2) {
      chars.push(String.fromCharCode(bytes.readUInt16BE(index)));
    }
    return chars.join("");
  }
  return bytes.toString("latin1");
}

function extractPdfTextOperators(content = "") {
  const chunks = [];
  const operatorPattern = /\[((?:\s*(?:\((?:\\.|[^\\)])*\)|<[0-9A-Fa-f\s]+>)\s*-?\d*\.?\d*)+)\]\s*TJ|\(((?:\\.|[^\\)])*)\)\s*Tj|<([0-9A-Fa-f\s]+)>\s*Tj/g;
  let match;
  while ((match = operatorPattern.exec(content))) {
    if (match[1]) {
      const arrayText = [];
      const stringPattern = /\((?:\\.|[^\\)])*\)|<[0-9A-Fa-f\s]+>/g;
      let part;
      while ((part = stringPattern.exec(match[1]))) {
        const token = part[0];
        arrayText.push(token.startsWith("<") ? decodePdfHex(token.slice(1, -1)) : unescapePdfString(token.slice(1, -1)));
      }
      chunks.push(arrayText.join(""));
    } else if (match[2] !== undefined) {
      chunks.push(unescapePdfString(match[2]));
    } else if (match[3]) {
      chunks.push(decodePdfHex(match[3]));
    }
  }
  return chunks
    .map((chunk) => chunk.replace(/\s+/g, " ").trim())
    .filter((chunk) => chunk && /[A-Za-z0-9]/.test(chunk))
    .join("\n");
}

function decodePdfStream(buffer, dictionary = "") {
  if (/\/Subtype\s*\/Image/i.test(dictionary)) return "";
  let data = buffer;
  if (/FlateDecode/i.test(dictionary)) {
    try {
      data = inflateSync(buffer);
    } catch {
      try {
        data = inflateRawSync(buffer);
      } catch {
        return "";
      }
    }
  }
  return extractPdfTextOperators(data.toString("latin1"));
}

export function extractPdfTextFromBuffer(buffer) {
  if (!Buffer.isBuffer(buffer) || !buffer.length) return "";
  const chunks = [];
  let position = 0;
  const streamToken = Buffer.from("stream", "latin1");
  const endStreamToken = Buffer.from("endstream", "latin1");
  while (position < buffer.length) {
    const streamStart = buffer.indexOf(streamToken, position);
    if (streamStart < 0) break;
    const streamEnd = buffer.indexOf(endStreamToken, streamStart + streamToken.length);
    if (streamEnd < 0) break;
    const dictionaryStart = Math.max(0, buffer.lastIndexOf(Buffer.from("<<", "latin1"), streamStart));
    const dictionary = buffer.slice(dictionaryStart, streamStart).toString("latin1");
    let dataStart = streamStart + streamToken.length;
    if (buffer[dataStart] === 0x0d && buffer[dataStart + 1] === 0x0a) dataStart += 2;
    else if (buffer[dataStart] === 0x0a || buffer[dataStart] === 0x0d) dataStart += 1;
    let dataEnd = streamEnd;
    if (buffer[dataEnd - 2] === 0x0d && buffer[dataEnd - 1] === 0x0a) dataEnd -= 2;
    else if (buffer[dataEnd - 1] === 0x0a || buffer[dataEnd - 1] === 0x0d) dataEnd -= 1;
    const text = decodePdfStream(buffer.slice(dataStart, dataEnd), dictionary);
    if (text) chunks.push(text);
    position = streamEnd + endStreamToken.length;
  }
  return chunks.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

export function extractPdfTextFromPayload(payload = {}) {
  const file = dataUrlBuffer(payload);
  if (!file || !isPdfPayload(payload, file)) return "";
  return extractPdfTextFromBuffer(file.buffer);
}

function textLines(text = "") {
  return String(text).split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
}

function gstinsFromText(text = "") {
  return [...new Set(String(text).toUpperCase().match(GSTIN_PATTERN) || [])];
}

function nearbyNumber(lines = [], startIndex = 0, direction = 1, maxSteps = 5) {
  for (let step = 1; step <= maxSteps; step += 1) {
    const line = lines[startIndex + step * direction];
    if (!line) continue;
    const value = line.match(/^\s*(\d+(?:,\d{3})*(?:\.\d+)?)\s*$/)?.[1];
    if (value) return number(value);
  }
  return 0;
}

const UNIT_LINE_PATTERN = /^(pcs|pc|piece|box|pack|tube|bottle|ml|ltr|l|kg|gm|g|unit|nos)$/i;
const HSN_LINE_PATTERN = /^\d{6,8}$/;
const MONEY_LINE_PATTERN = /^\d+(?:,\d{3})*(?:\.\d+)?$/;

function isMoneyLine(line = "") {
  return MONEY_LINE_PATTERN.test(String(line).trim());
}

function isUnitLine(line = "") {
  return UNIT_LINE_PATTERN.test(String(line).trim());
}

function isHsnLine(line = "") {
  return HSN_LINE_PATTERN.test(String(line).trim());
}

function numericLineValue(line = "") {
  return isMoneyLine(line) ? number(line, NaN) : NaN;
}

function invoiceTaxPercent(rawText = "") {
  const rates = [...String(rawText).matchAll(/\b(0|5|12|18|28)\s*%/g)].map((match) => number(match[1], 0)).filter(Boolean);
  return rates.includes(18) ? 18 : rates.at(-1) || 18;
}

function grandTotalFromLines(lines = [], fallback = 0) {
  const grandIndex = lines.findIndex((line) => /^grand\s+total$/i.test(line));
  if (grandIndex > 0) {
    for (let index = grandIndex - 1; index >= Math.max(0, grandIndex - 4); index -= 1) {
      const value = numericLineValue(lines[index]);
      if (Number.isFinite(value) && value > 0) return money(value);
    }
  }
  const totalIndex = lines.findIndex((line) => /^total$/i.test(line));
  if (totalIndex > 0) {
    for (let index = totalIndex - 1; index >= Math.max(0, totalIndex - 4); index -= 1) {
      const value = numericLineValue(lines[index]);
      if (Number.isFinite(value) && value > 0) return money(value);
    }
  }
  return money(fallback);
}

function gstTotalFromLines(lines = []) {
  return gstBreakupFromLines(lines).gstAmount;
}

function gstBreakupFromLines(lines = []) {
  const taxStart = lines.findIndex((line) => /^add\s*:\s*(cgst|sgst|igst)$/i.test(line));
  const empty = { cgstAmount: 0, sgstAmount: 0, igstAmount: 0, gstAmount: 0 };
  if (taxStart < 0) return empty;
  const labels = [];
  let cursor = taxStart;
  while (cursor < lines.length) {
    const label = lines[cursor].match(/^add\s*:\s*(cgst|sgst|igst)$/i)?.[1]?.toLowerCase();
    if (!label) break;
    labels.push(label);
    cursor += 1;
  }
  const values = lines.slice(cursor, cursor + 10)
    .map((line) => numericLineValue(line))
    .filter((value) => Number.isFinite(value) && value > 0);
  const breakup = { ...empty };
  labels.forEach((label, index) => {
    const key = `${label}Amount`;
    breakup[key] = money(values[index] || nearbyNumber(lines, lines.findIndex((line) => new RegExp(`^add\\s*:\\s*${label}$`, "i").test(line)), 1, 6));
  });
  breakup.gstAmount = money(breakup.cgstAmount + breakup.sgstAmount + breakup.igstAmount);
  return breakup.gstAmount ? breakup : empty;
}

export function gstBreakupFromText(rawText = "") {
  return gstBreakupFromLines(textLines(rawText));
}

function cleanTurquoiseProductName(parts = []) {
  return cleanName(parts.join(" ")
    .replace(/\bMRP\s*\d+(?:\.\d+)?/gi, "")
    .replace(/\s+/g, " ")
    .trim());
}

function parseTurquoiseProductRows(lines = [], rawText = "") {
  const items = [];
  const gstPercent = invoiceTaxPercent(rawText);
  const productStart = lines.findIndex((line) => /product\s+description/i.test(line));
  const tableEnd = lines.findIndex((line, index) => index > productStart && /^(rupees|grand\s+total|taxable\s+amt)$/i.test(line));
  const start = productStart >= 0 ? productStart + 1 : 0;
  const end = tableEnd > start ? tableEnd : lines.length;

  for (let index = start; index < end; index += 1) {
    const line = lines[index];
    const rateBefore = numericLineValue(lines[index - 1]);
    if (!Number.isFinite(rateBefore) || rateBefore <= 0) continue;
    if (!/[A-Z]/.test(line) || /(invoice|gstin|state|contact|mobile|email|details|consignee|m\/s\.?|subject|original|payment|terms)/i.test(line)) continue;
    if (isMoneyLine(line) || isUnitLine(line) || isHsnLine(line)) continue;

    const nameParts = [];
    let cursor = index;
    while (cursor < end) {
      const current = lines[cursor];
      if (!current || isMoneyLine(current) || isUnitLine(current) || isHsnLine(current)) break;
      if (/^(sr\.?|no\.?|state|taxable|total|rupees)$/i.test(current)) break;
      nameParts.push(current);
      cursor += 1;
    }

    const productName = cleanTurquoiseProductName(nameParts);
    if (!productName || !/\b(mrp|shampoo|conditioner|serum|mask|calyx|morfose|cream|developer|color)\b/i.test(nameParts.join(" "))) continue;

    const hsnIndex = lines.findIndex((candidate, candidateIndex) => candidateIndex >= cursor && candidateIndex <= cursor + 8 && isHsnLine(candidate));
    if (hsnIndex < 0) continue;
    const segment = lines.slice(cursor, hsnIndex);
    const numericRows = segment
      .map((value, offset) => ({ value: numericLineValue(value), offset }))
      .filter((row) => Number.isFinite(row.value));
    if (numericRows.length < 3) continue;

    const inlineMrp = number(nameParts.join(" ").match(/\bMRP\s*(\d+(?:\.\d+)?)/i)?.[1], 0);
    const mrp = money(inlineMrp || numericRows[0].value);
    const qty = money(numericRows[1].value);
    const discountPercent = money(numericRows[2].value);
    const unit = segment.find((value) => isUnitLine(value))?.toLowerCase() || "nos";
    const amountAfterHsn = numericLineValue(lines[hsnIndex + 1]);
    const taxableAmount = money(Number.isFinite(amountAfterHsn) && amountAfterHsn > 0 ? amountAfterHsn : qty * rateBefore);
    const gstAmount = money(taxableAmount * (gstPercent / 100));

    items.push({
      lineNo: items.length + 1,
      rawName: productName,
      productName,
      hsnSac: lines[hsnIndex],
      qty,
      purchaseUnit: unit,
      stockUnit: unit,
      packSize: 1,
      conversionFactor: 1,
      mrp,
      discountPercent,
      discountAmount: money(Math.max(0, qty * mrp - taxableAmount)),
      unitCost: money(taxableAmount / Math.max(qty, 1)),
      gstPercent,
      taxableAmount,
      gstAmount,
      cgstAmount: money(gstAmount / 2),
      sgstAmount: money(gstAmount / 2),
      igstAmount: 0,
      lineTotal: money(taxableAmount + gstAmount),
      confidence: 0.9
    });

    index = hsnIndex;
  }
  return items;
}

function parseTurquoiseWellnessInvoice(rawText = "") {
  if (!/TURQUOISE\s+WELLNESS/i.test(rawText)) return null;
  const lines = textLines(rawText);
  const gstins = gstinsFromText(rawText);
  const items = parseTurquoiseProductRows(lines, rawText);
  if (!items.length) return null;
  const subtotal = money(items.reduce((sum, item) => sum + number(item.taxableAmount), 0));
  const billTax = gstBreakupFromLines(lines);
  const itemCgst = money(items.reduce((sum, item) => sum + number(item.cgstAmount), 0));
  const itemSgst = money(items.reduce((sum, item) => sum + number(item.sgstAmount), 0));
  const itemIgst = money(items.reduce((sum, item) => sum + number(item.igstAmount), 0));
  const cgstAmount = money(billTax.cgstAmount || itemCgst);
  const sgstAmount = money(billTax.sgstAmount || itemSgst);
  const igstAmount = money(billTax.igstAmount || itemIgst);
  const gstAmount = money(billTax.gstAmount || cgstAmount + sgstAmount + igstAmount || items.reduce((sum, item) => sum + number(item.gstAmount), 0));
  const totalAmount = grandTotalFromLines(lines, subtotal + gstAmount);
  return {
    supplierName: "TURQUOISE WELLNESS",
    supplierGstin: gstins[0] || "",
    supplierEmail: firstMatch(rawText, [/\bEmail\s*:\s*([^\s,;]+)/i]),
    supplierPhone: firstMatch(rawText, [/\b(?:Mob\.?|Mobile|Phone|Tel(?:e)?)\s*\.?\s*:\s*([+0-9 /-]{8,})/i]),
    supplierAddress: firstMatch(rawText, [/TURQUOISE\s+WELLNESS\s*\n([^\n]+(?:\n[^\n]+)?)/i]).replace(/\n/g, " "),
    billNo: invoiceNoFromText(rawText),
    billDate: dateFromText(rawText),
    subtotal,
    gstAmount,
    cgstAmount,
    sgstAmount,
    igstAmount,
    totalAmount,
    items,
    confidence: 0.9,
    warnings: Math.abs(totalAmount - money(subtotal + gstAmount)) <= 1 ? [] : ["Bill total needs manual review against extracted item total."]
  };
}

function structuredInvoiceFromText(rawText = "") {
  return parseTurquoiseWellnessInvoice(rawText);
}

function parseItemLine(line = "", lineNo = 1) {
  const text = line.replace(/\s+/g, " ").trim();
  if (!text || text.length < 5) return null;
  if (/(invoice|bill no|gstin|subtotal|grand total|total amount|amount due|round off|tax summary|email|mobile|contact|state code|address|consignee|jurisdiction|payment terms|bank name|ifsc)/i.test(text)) return null;
  const numbers = text.match(/\d+(?:,\d{3})*(?:\.\d+)?/g)?.map((item) => number(item)) || [];
  if (numbers.length < 2) return null;
  const firstNumberIndex = text.search(/\d/);
  const rawName = cleanName(text.slice(0, firstNumberIndex));
  if (!rawName || rawName.length < 2) return null;
  if (rawName.split(/\s+/).filter((token) => /[A-Za-z]/.test(token)).length < 2) return null;
  const hsnMatch = text.match(/\b(\d{6,8})\b/);
  const unitMatch = text.match(/\b(pcs|pc|piece|box|pack|tube|bottle|ml|ltr|l|kg|gm|g|unit|nos)\b/i);
  const gstMatch = text.match(/\b(0|5|12|18|28)\s*%/);
  const discountMatch = text.match(/\b(?:disc(?:ount)?\.?\s*)[:%]?\s*(\d+(?:\.\d+)?)\s*%?/i);
  const qty = Math.max(0, numbers[0] || 0);
  const unitCost = numbers.length >= 3 ? numbers[numbers.length - 2] : numbers[1];
  const lineTotal = numbers[numbers.length - 1] || money(qty * unitCost);
  const gstPercent = number(gstMatch?.[1], 18);
  const taxableAmount = lineTotal && gstPercent ? money(lineTotal / (1 + gstPercent / 100)) : money(qty * unitCost);
  const gstAmount = money(lineTotal - taxableAmount);
  return {
    lineNo,
    rawName,
    productName: rawName,
    hsnSac: hsnMatch?.[1] || "",
    qty,
    purchaseUnit: unitMatch?.[1]?.toLowerCase() || "pcs",
    stockUnit: unitMatch?.[1]?.toLowerCase() || "pcs",
    packSize: 1,
    conversionFactor: 1,
    mrp: 0,
    discountPercent: number(discountMatch?.[1], 0),
    discountAmount: 0,
    unitCost: money(unitCost),
    gstPercent,
    taxableAmount,
    gstAmount,
    cgstAmount: money(gstAmount / 2),
    sgstAmount: money(gstAmount / 2),
    igstAmount: 0,
    lineTotal: money(lineTotal),
    confidence: 0.56
  };
}

function localExtract(payload = {}) {
  const rawText = [payload.extractedText || payload.rawText || "", extractPdfTextFromPayload(payload)].filter(Boolean).join("\n");
  const structured = structuredInvoiceFromText(rawText);
  const lines = textLines(rawText);
  const supplierName = payload.supplierName || structured?.supplierName || supplierNameFromText(rawText, lines);
  const billNo = payload.billNo || structured?.billNo || invoiceNoFromText(rawText);
  const supplierGstin = payload.supplierGstin || structured?.supplierGstin || gstinsFromText(rawText)[0] || "";
  const supplierEmail = payload.supplierEmail || structured?.supplierEmail || firstMatch(rawText, [/\bEmail\s*:\s*([^\s,;]+)/i]);
  const supplierPhone = payload.supplierPhone || structured?.supplierPhone || firstMatch(rawText, [/\b(?:Mob\.?|Mobile|Phone|Tel(?:e)?)\s*\.?\s*:\s*([+0-9 /-]{8,})/i]);
  const supplierAddress = payload.supplierAddress || structured?.supplierAddress || "";
  const billDate = payload.billDate || dateFromText(rawText);
  const textItems = lines.map((line, index) => parseItemLine(line, index + 1)).filter(Boolean);
  const payloadItems = Array.isArray(payload.items) ? payload.items : [];
  const items = payloadItems.length ? payloadItems : structured?.items?.length ? structured.items : textItems;
  const subtotal = number(payload.subtotal) || number(structured?.subtotal) || money(items.reduce((sum, item) => sum + number(item.taxableAmount || item.taxable_amount || item.qty * item.unitCost), 0));
  const cgstAmount = number(payload.cgstAmount ?? payload.cgst_amount, NaN) || number(structured?.cgstAmount ?? structured?.cgst_amount, NaN) || money(items.reduce((sum, item) => sum + number(item.cgstAmount || item.cgst_amount), 0));
  const sgstAmount = number(payload.sgstAmount ?? payload.sgst_amount, NaN) || number(structured?.sgstAmount ?? structured?.sgst_amount, NaN) || money(items.reduce((sum, item) => sum + number(item.sgstAmount || item.sgst_amount), 0));
  const igstAmount = number(payload.igstAmount ?? payload.igst_amount, NaN) || number(structured?.igstAmount ?? structured?.igst_amount, NaN) || money(items.reduce((sum, item) => sum + number(item.igstAmount || item.igst_amount), 0));
  const gstAmount = number(payload.gstAmount) || number(structured?.gstAmount) || money(cgstAmount + sgstAmount + igstAmount) || money(items.reduce((sum, item) => sum + number(item.gstAmount || item.gst_amount), 0));
  const totalAmount = number(payload.totalAmount) || number(payload.total) || number(structured?.totalAmount) || money(items.reduce((sum, item) => sum + number(item.lineTotal || item.line_total), 0)) || money(subtotal + gstAmount);
  return {
    supplierName,
    supplierGstin,
    supplierEmail,
    supplierPhone,
    supplierAddress,
    billNo,
    billDate,
    subtotal,
    gstAmount,
    cgstAmount,
    sgstAmount,
    igstAmount,
    totalAmount,
    items,
    rawText: rawText.slice(0, 14000),
    warnings: rawText || items.length ? [] : ["No readable text was provided; draft opened for manual entry."],
    confidence: number(structured?.confidence, items.length ? 0.62 : 0.25),
    provider: "local"
  };
}

async function claudeExtract(payload = {}) {
  if (!env.anthropicApiKey || typeof fetch !== "function") return null;
  const base64 = String(payload.fileBase64 || payload.imageBase64 || payload.fileDataUrl || "").replace(/^data:[^;]+;base64,/, "");
  if (!base64) return null;
  const mimeType = payload.fileMimeType || payload.mimeType || "image/jpeg";
  if (!String(mimeType).toLowerCase().startsWith("image/")) return null;
  const prompt = [
    "Extract this Indian salon supplier purchase invoice into strict JSON.",
    "Return supplierName, supplierGstin, billNo, billDate as YYYY-MM-DD, subtotal, gstAmount, cgstAmount, sgstAmount, igstAmount, totalAmount.",
    "Return items with rawName, productName, hsnSac, qty, purchaseUnit, stockUnit, packSize, conversionFactor, mrp, discountPercent, discountAmount, unitCost, gstPercent, taxableAmount, gstAmount, cgstAmount, sgstAmount, igstAmount, lineTotal, batchNumber, expiryDate, supplierSku.",
    "Do not invent values. Use empty string or 0 when unclear."
  ].join(" ");
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": env.anthropicApiKey,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: env.anthropicModel,
      max_tokens: 4000,
      messages: [{
        role: "user",
        content: [
          { type: "text", text: prompt },
          { type: "image", source: { type: "base64", media_type: mimeType, data: base64 } }
        ]
      }]
    })
  });
  if (!response.ok) return null;
  const body = await response.json();
  const text = body?.content?.map((part) => part.text || "").join("\n") || "";
  const extracted = parseJsonObject(text);
  if (!extracted) return null;
  return {
    ...localExtract({ ...payload, ...extracted, items: extracted.items || [] }),
    ...extracted,
    provider: "claude",
    confidence: number(extracted.confidence, 0.82),
    warnings: Array.isArray(extracted.warnings) ? extracted.warnings : []
  };
}

export const purchaseBillAiService = {
  async extract(payload = {}) {
    const provider = String(payload.aiProvider || env.aiProvider || "local").toLowerCase();
    if (provider.includes("claude") || provider.includes("anthropic")) {
      try {
        const extracted = await claudeExtract(payload);
        if (extracted) return extracted;
      } catch {
        // Fall back to local extraction so upload still opens a reviewable draft.
      }
    }
    return localExtract(payload);
  }
};
