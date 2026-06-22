import { db } from "../db.js";

const WORKING_HOURS = 10;
const money = (value) => Math.round((Number(value) || 0) * 100) / 100;
const pct = (value) => Math.round((Number(value) || 0) * 100) / 100;
const todayIso = () => new Date().toISOString().slice(0, 10);

function branchFilter(branchId) {
  return branchId ? "AND a.branchId = @branchId" : "";
}

function appointmentDuration(appointment) {
  const start = new Date(appointment.startAt).getTime();
  const end = appointment.endAt ? new Date(appointment.endAt).getTime() : 0;
  if (Number.isFinite(start) && Number.isFinite(end) && end > start) return Math.round((end - start) / 60000);
  return 30;
}

function chairLabel(appointment) {
  return appointment.chair || appointment.room || "Unassigned";
}

export class ChairUtilizationService {
  getUtilizationByDate(tenantId, branchId = "", date = todayIso()) {
    const rows = db.prepare(
      `SELECT a.*, COALESCE(s.total, 0) AS saleTotal
       FROM appointments a
       LEFT JOIN sales s ON s.appointmentId = a.id AND s.tenantId = a.tenantId
       WHERE a.tenantId = @tenantId
         ${branchFilter(branchId)}
         AND substr(a.startAt, 1, 10) = @date
         AND lower(a.status) IN ('completed', 'in_service', 'in-service', 'billed', 'paid')`
    ).all({ tenantId, branchId, date });
    const grouped = new Map();
    for (const appointment of rows) {
      const id = chairLabel(appointment);
      const current = grouped.get(id) || {
        chairId: id,
        chairName: id,
        busyMin: 0,
        availableMin: WORKING_HOURS * 60,
        revenue: 0
      };
      current.busyMin += appointmentDuration(appointment);
      current.revenue += Number(appointment.saleTotal || 0);
      grouped.set(id, current);
    }
    if (!grouped.size) {
      grouped.set("Unassigned", {
        chairId: "Unassigned",
        chairName: "Unassigned",
        busyMin: 0,
        availableMin: WORKING_HOURS * 60,
        revenue: 0
      });
    }
    return [...grouped.values()].map((row) => ({
      ...row,
      utilizationPct: row.availableMin ? pct((row.busyMin * 100) / row.availableMin) : 0,
      revenue: money(row.revenue),
      revenuePerHour: row.busyMin ? money(row.revenue / (row.busyMin / 60)) : 0
    })).sort((a, b) => b.utilizationPct - a.utilizationPct);
  }

  getUtilizationHeatmap(tenantId, branchId = "", fromDate = todayIso(), toDate = todayIso()) {
    const rows = db.prepare(
      `SELECT a.*
       FROM appointments a
       WHERE a.tenantId = @tenantId
         ${branchFilter(branchId)}
         AND substr(a.startAt, 1, 10) BETWEEN @fromDate AND @toDate
         AND lower(a.status) IN ('completed', 'in_service', 'in-service', 'billed', 'paid')`
    ).all({ tenantId, branchId, fromDate, toDate });
    const days = [];
    const cursor = new Date(`${fromDate}T00:00:00.000Z`);
    const end = new Date(`${toDate}T00:00:00.000Z`);
    while (cursor <= end) {
      days.push(cursor.toISOString().slice(0, 10));
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    const hours = Array.from({ length: 12 }, (_, index) => `${String(9 + index).padStart(2, "0")}:00`);
    const cells = days.map(() => hours.map(() => 0));
    for (const appointment of rows) {
      const dayIndex = days.indexOf(String(appointment.startAt || "").slice(0, 10));
      const hourIndex = hours.indexOf(`${String(appointment.startAt || "").slice(11, 13)}:00`);
      if (dayIndex >= 0 && hourIndex >= 0) cells[dayIndex][hourIndex] += appointmentDuration(appointment);
    }
    const maxBusy = Math.max(1, ...cells.flat());
    return {
      days,
      hours,
      cells: cells.map((row) => row.map((value) => pct((value * 100) / maxBusy)))
    };
  }

  getOptimalChairCountRecommendation(tenantId, branchId = "") {
    const date = todayIso();
    const utilization = this.getUtilizationByDate(tenantId, branchId, date);
    const currentChairs = utilization.length;
    const peakUtilization = utilization.reduce((max, row) => Math.max(max, row.utilizationPct), 0);
    const averageUtilization = utilization.length
      ? utilization.reduce((sum, row) => sum + row.utilizationPct, 0) / utilization.length
      : 0;
    const recommendedChairs = peakUtilization > 85
      ? currentChairs + 1
      : averageUtilization < 35 && currentChairs > 1
        ? currentChairs - 1
        : currentChairs;
    return {
      currentChairs,
      recommendedChairs,
      peakUtilization: pct(peakUtilization),
      averageUtilization: pct(averageUtilization),
      reasoning: recommendedChairs > currentChairs
        ? "Peak utilization is high; add or reserve an extra chair during busy slots."
        : recommendedChairs < currentChairs
          ? "Average utilization is low; consolidate chair allocation or run dead-slot offers."
          : "Current chair capacity is balanced for today's demand."
    };
  }
}

export const chairUtilizationService = new ChairUtilizationService();
