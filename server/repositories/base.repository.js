import { columnsFor, db, deleteRow, deserialize, getRow, insertRow, listRows, updateRow } from "../db.js";

export class BaseRepository {
  constructor(table) {
    this.table = table;
  }

  list(query = {}, scope = {}) {
    return listRows(this.table, { ...query, ...scope });
  }

  all(scope = {}) {
    return listRows(this.table, { ...scope, limit: 1000000 });
  }

  getById(id, scope = {}) {
    return getRow(this.table, id, scope);
  }

  create(payload, scope = {}) {
    const columns = columnsFor(this.table);
    const scopedPayload = { ...payload };
    if (scope.tenantId && columns.includes("tenantId")) scopedPayload.tenantId = scope.tenantId;
    if (!scopedPayload.branchId && scope.branchId && columns.includes("branchId")) scopedPayload.branchId = scope.branchId;
    return insertRow(this.table, scopedPayload);
  }

  update(id, payload, scope = {}) {
    return updateRow(this.table, id, payload, scope);
  }

  delete(id, scope = {}) {
    return deleteRow(this.table, id, scope);
  }

  count(scope = {}) {
    const columns = columnsFor(this.table);
    const where = [];
    const params = {};
    if (scope.tenantId && columns.includes("tenantId")) {
      where.push("tenantId = @tenantId");
      params.tenantId = scope.tenantId;
    }
    if (scope.branchId && columns.includes("branchId")) {
      where.push("branchId = @branchId");
      params.branchId = scope.branchId;
    }
    return db.prepare(`SELECT COUNT(*) AS count FROM ${this.table}${where.length ? ` WHERE ${where.join(" AND ")}` : ""}`).get(params).count;
  }
}
