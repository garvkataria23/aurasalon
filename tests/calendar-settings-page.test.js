import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(path, "utf8");

test("calendar settings page is routed and discoverable from admin navigation", () => {
  const routes = read("src/app/app.routes.ts");
  const app = read("src/app/app.component.ts");
  const sidebar = read("src/app/shell/sidebar/sidebar.service.ts");

  assert.match(routes, /path:\s*'setting\/calendar'/, "Salonist-style calendar settings route should exist");
  assert.match(routes, /path:\s*'settings\/calendar'/, "settings/calendar alias should exist");
  assert.match(routes, /CalendarSettingsComponent/, "route should lazy-load CalendarSettingsComponent");
  assert.match(app, /Calendar Settings/, "main sidebar nav should expose Calendar Settings");
  assert.match(app, /\/setting\/calendar/, "main sidebar nav should link to Calendar Settings");
  assert.match(sidebar, /\/setting\/calendar/, "enterprise sidebar grouping should include Calendar Settings");
});

test("calendar settings page contains time, color and appointment controls", () => {
  const page = read("src/app/pages/calendar-settings.component.ts");

  for (const label of [
    "Calendar settings",
    "Calendar Time settings",
    "Overlap Time Slot",
    "Previous Time Slot",
    "Week Start From",
    "Time Slot",
    "Time Format",
    "Calendar Color settings",
    "Enable/Disable",
    "Select Color",
    "Enter Button Text",
    "Appointment settings",
    "Room Number Option",
    "Staff Calendar",
    "Appointment status",
    "Save"
  ]) {
    assert.match(page, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `missing calendar setting label ${label}`);
  }

  for (const status of ["Confirmed", "Arrived", "Start", "Completed", "Cancel", "Not Came", "Not Confirmed", "Reschedule Booking", "Add Payment", "Delete"]) {
    assert.match(page, new RegExp(status.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `missing color row ${status}`);
  }

  assert.match(page, /localStorage\.setItem\(STORAGE_KEY/, "settings should persist locally");
  assert.match(page, /color-table-wrap[\s\S]*overflow-x:\s*auto/, "color table should contain horizontal scroll");
});
