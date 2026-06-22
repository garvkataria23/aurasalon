import { createHash } from "node:crypto";
import { db } from "../../db.js";
import { badRequest, notFound } from "../../utils/app-error.js";
import { tenantService } from "../tenant.service.js";

const now = () => new Date().toISOString();
const makeId = (prefix) => `${prefix}_${crypto.randomUUID().slice(0, 10)}`;

function parseJson(value, fallback) {
  if (Array.isArray(value) || (value && typeof value === "object")) return value;
  if (!value || typeof value !== "string") return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function docRow(row) {
  return row ? { ...row, metadata: parseJson(row.metadata, {}) } : null;
}

export function chunkKnowledgeText(content) {
  const clean = String(content || "").replace(/\s+/g, " ").trim();
  if (!clean) return [];
  const chunks = [];
  for (let index = 0; index < clean.length; index += 900) {
    chunks.push(clean.slice(index, index + 900));
  }
  return chunks;
}

function termsFor(query) {
  return [...new Set(String(query || "")
    .toLowerCase()
    .split(/[^a-z0-9\u0900-\u097f]+/i)
    .map((term) => term.trim())
    .filter((term) => term.length >= 2))];
}

function daysSince(value) {
  const time = new Date(value || 0).getTime();
  if (!time) return 999;
  return Math.max(0, Math.floor((Date.now() - time) / 86400000));
}

function excerptFor(content, terms) {
  const text = String(content || "").replace(/\s+/g, " ").trim();
  const lower = text.toLowerCase();
  const firstTerm = terms.find((term) => lower.includes(term));
  if (!firstTerm) return text.slice(0, 320);
  const index = Math.max(0, lower.indexOf(firstTerm) - 80);
  return text.slice(index, index + 320);
}

function scoreRow(row, terms, phrase, branchId) {
  const title = String(row.title || "").toLowerCase();
  const category = String(row.category || "").toLowerCase();
  const content = String(row.content || "").toLowerCase();
  let score = 0;
  const matchedTerms = [];
  if (phrase && title.includes(phrase)) score += 42;
  if (phrase && content.includes(phrase)) score += 18;
  for (const term of terms) {
    let matched = false;
    if (title.includes(term)) {
      score += 9;
      matched = true;
    }
    if (category.includes(term)) {
      score += 6;
      matched = true;
    }
    if (content.includes(term)) {
      score += 2;
      matched = true;
    }
    if (matched) matchedTerms.push(term);
  }
  if (!score) return { score: 0, matchedTerms: [] };
  if (branchId && row.branchId === branchId) score += 12;
  if (!row.branchId) score += 1;
  score += Math.max(0, 5 - Math.floor(daysSince(row.updatedAt) / 14));
  return { score, matchedTerms: [...new Set(matchedTerms)] };
}

function confidenceFor(score) {
  if (score >= 60) return 0.92;
  if (score >= 35) return 0.78;
  if (score >= 14) return 0.62;
  if (score > 0) return 0.38;
  return 0;
}

function branchWhere(branchId, alias = "") {
  const prefix = alias ? `${alias}.` : "";
  return branchId ? `AND (${prefix}branchId = '' OR ${prefix}branchId = ?)` : "";
}

function sourceIdFor({ tenantId, branchId = "", sourceKey = "" }) {
  const digest = createHash("sha256")
    .update(`${tenantId}:${branchId}:${sourceKey}`)
    .digest("hex")
    .slice(0, 24);
  return `kb_src_${digest}`;
}

export class KnowledgeBaseService {
  replaceChunks(document, access, stamp = now()) {
    const insertChunk = db.prepare(`
      INSERT INTO ai_knowledge_chunks
        (id, tenantId, branchId, documentId, chunkIndex, title, content, tokenCount, createdAt, updatedAt)
      VALUES
        (@id, @tenantId, @branchId, @documentId, @chunkIndex, @title, @content, @tokenCount, @createdAt, @updatedAt)
    `);
    const chunks = chunkKnowledgeText(document.content);
    db.prepare("DELETE FROM ai_knowledge_chunks WHERE documentId = ? AND tenantId = ?").run(document.id, access.tenantId);
    chunks.forEach((chunk, index) => {
      insertChunk.run({
        id: makeId("kb_chunk"),
        tenantId: access.tenantId,
        branchId: document.branchId || "",
        documentId: document.id,
        chunkIndex: index,
        title: document.title,
        content: chunk,
        tokenCount: chunk.split(/\s+/).filter(Boolean).length,
        createdAt: stamp,
        updatedAt: stamp
      });
    });
    return chunks.length;
  }

  createDocument(payload = {}, access) {
    const title = String(payload.title || "").trim();
    const content = String(payload.content || "").trim();
    if (!title) throw badRequest("Knowledge document title is required");
    if (!content) throw badRequest("Knowledge document content is required");
    const branchId = String(payload.branchId || access.branchId || "");
    if (branchId) tenantService.assertBranchAccess(access, branchId);

    const stamp = now();
    const document = {
      id: makeId("kb_doc"),
      tenantId: access.tenantId,
      branchId,
      title,
      category: String(payload.category || "policy"),
      content,
      sourceType: String(payload.sourceType || "manual"),
      status: String(payload.status || "active"),
      metadata: payload.metadata && typeof payload.metadata === "object" ? payload.metadata : {},
      createdAt: stamp,
      updatedAt: stamp
    };
    const insertDocument = db.prepare(`
      INSERT INTO ai_knowledge_documents
        (id, tenantId, branchId, title, category, content, sourceType, status, metadata, createdAt, updatedAt)
      VALUES
        (@id, @tenantId, @branchId, @title, @category, @content, @sourceType, @status, @metadata, @createdAt, @updatedAt)
    `);
    db.transaction(() => {
      insertDocument.run({ ...document, metadata: JSON.stringify(document.metadata) });
      this.replaceChunks(document, access, stamp);
    })();
    return { document, chunks: chunkKnowledgeText(content).length };
  }

  upsertImportedDocument(payload = {}, access) {
    const title = String(payload.title || "").trim();
    const content = String(payload.content || "").trim();
    const sourceKey = String(payload.sourceKey || payload.metadata?.sourceKey || "").trim();
    if (!title) throw badRequest("Knowledge document title is required");
    if (!content) throw badRequest("Knowledge document content is required");
    if (!sourceKey) throw badRequest("Imported knowledge document sourceKey is required");

    const branchId = String(payload.branchId || "");
    if (branchId) tenantService.assertBranchAccess(access, branchId);
    const sourceType = String(payload.sourceType || "google_sheet");
    const stamp = now();
    const id = payload.id || sourceIdFor({ tenantId: access.tenantId, branchId, sourceKey });
    const metadata = {
      ...(payload.metadata && typeof payload.metadata === "object" ? payload.metadata : {}),
      sourceKey,
      importedAt: stamp
    };
    const existing = db.prepare("SELECT * FROM ai_knowledge_documents WHERE id = ? AND tenantId = ?").get(id, access.tenantId);
    const document = {
      id,
      tenantId: access.tenantId,
      branchId,
      title,
      category: String(payload.category || "faq"),
      content,
      sourceType,
      sourceKey,
      status: String(payload.status || "active"),
      metadata,
      createdAt: existing?.createdAt || stamp,
      updatedAt: stamp
    };

    db.transaction(() => {
      if (existing) {
        db.prepare(`
          UPDATE ai_knowledge_documents
          SET branchId = @branchId,
              title = @title,
              category = @category,
              content = @content,
              sourceType = @sourceType,
              sourceKey = @sourceKey,
              status = @status,
              metadata = @metadata,
              updatedAt = @updatedAt
          WHERE id = @id AND tenantId = @tenantId
        `).run({ ...document, metadata: JSON.stringify(document.metadata) });
      } else {
        db.prepare(`
          INSERT INTO ai_knowledge_documents
            (id, tenantId, branchId, title, category, content, sourceType, sourceKey, status, metadata, createdAt, updatedAt)
          VALUES
            (@id, @tenantId, @branchId, @title, @category, @content, @sourceType, @sourceKey, @status, @metadata, @createdAt, @updatedAt)
        `).run({ ...document, metadata: JSON.stringify(document.metadata) });
      }
      this.replaceChunks(document, access, stamp);
    })();

    return { document, chunks: chunkKnowledgeText(content).length, created: !existing };
  }

  listDocuments(query = {}, access) {
    const branchId = String(query.branchId || access.branchId || "");
    if (branchId) tenantService.assertBranchAccess(access, branchId);
    const status = String(query.status || "active");
    const category = String(query.category || "");
    const limit = Math.min(Number(query.limit) || 100, 500);
    const params = [access.tenantId];
    let sql = "SELECT * FROM ai_knowledge_documents WHERE tenantId = ?";
    if (branchId) {
      sql += " AND (branchId = '' OR branchId = ?)";
      params.push(branchId);
    }
    if (status !== "all") {
      sql += " AND status = ?";
      params.push(status);
    }
    if (category) {
      sql += " AND category = ?";
      params.push(category);
    }
    sql += " ORDER BY updatedAt DESC LIMIT ?";
    params.push(limit);
    return db.prepare(sql).all(...params).map(docRow);
  }

  deleteDocument(id, access) {
    const row = db.prepare("SELECT * FROM ai_knowledge_documents WHERE id = ? AND tenantId = ?").get(id, access.tenantId);
    if (!row) throw notFound("Knowledge document not found");
    if (row.branchId) tenantService.assertBranchAccess(access, row.branchId);
    db.transaction(() => {
      db.prepare("DELETE FROM ai_knowledge_chunks WHERE documentId = ? AND tenantId = ?").run(id, access.tenantId);
      db.prepare("DELETE FROM ai_knowledge_documents WHERE id = ? AND tenantId = ?").run(id, access.tenantId);
    })();
    return { deleted: true, id };
  }

  search(payload = {}, access) {
    const query = String(payload.query || payload.prompt || "").trim();
    if (!query) throw badRequest("Knowledge search query is required");
    const branchId = String(payload.branchId || access.branchId || "");
    if (branchId) tenantService.assertBranchAccess(access, branchId);
    const limit = Math.min(Number(payload.limit) || 5, 20);
    const params = branchId ? [access.tenantId, branchId] : [access.tenantId];
    const rows = db.prepare(`
      SELECT c.*, d.category, d.sourceType
      FROM ai_knowledge_chunks c
      JOIN ai_knowledge_documents d ON d.id = c.documentId
      WHERE c.tenantId = ? AND d.status = 'active' ${branchWhere(branchId, "c")}
      ORDER BY c.updatedAt DESC
    `).all(...params);
    const terms = termsFor(query);
    const phrase = query.toLowerCase();
    const minimumScore = Number(payload.minimumScore ?? 5);
    const matches = rows
      .map((row) => {
        const scored = scoreRow(row, terms, phrase, branchId);
        return { ...row, score: scored.score, matchedTerms: scored.matchedTerms };
      })
      .filter((row) => row.score >= minimumScore)
      .sort((a, b) => b.score - a.score || a.chunkIndex - b.chunkIndex)
      .slice(0, limit)
      .map((row) => ({
        documentId: row.documentId,
        chunkId: row.id,
        title: row.title,
        category: row.category,
        score: row.score,
        confidence: confidenceFor(row.score),
        matchedTerms: row.matchedTerms,
        excerpt: excerptFor(row.content, terms)
      }));
    const matchedTerms = [...new Set(matches.flatMap((match) => match.matchedTerms || []))];
    const unmatchedTerms = terms.filter((term) => !matchedTerms.includes(term));
    const confidence = matches.length ? confidenceFor(matches[0].score) : 0;
    const stamp = now();
    db.prepare(`
      INSERT INTO ai_knowledge_query_logs (id, tenantId, branchId, query, matches, createdAt)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(makeId("kb_query"), access.tenantId, branchId, query, JSON.stringify(matches), stamp);
    return {
      query,
      branchId,
      matches,
      sources: [...new Set(matches.map((match) => match.title))],
      confidence,
      unmatchedTerms,
      generatedAt: stamp
    };
  }
}

export const knowledgeBaseService = new KnowledgeBaseService();
