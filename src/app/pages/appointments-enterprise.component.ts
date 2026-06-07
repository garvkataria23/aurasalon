import { CommonModule, DatePipe } from '@angular/common';
import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ApiRecord, ApiService } from '../core/api.service';
import { AppStateService } from '../core/state/app-state.service';
import { StateComponent } from '../shared/ui/state/state.component';

type SchedulerDrawer = '' | 'booking' | 'blocked-time' | 'appointment' | 'ai-slots';
type BlockMode = 'add' | 'remove';
type SchedulerActionMenu = {
  staffId: string;
  minute: number;
  top: number;
};

type StaffLane = {
  id: string;
  name: string;
  shortName?: string;
  role?: string;
  status?: string;
  avatar?: string;
  phone?: string;
};

type BookingLineDraft = {
  id: string;
  serviceId: string;
  staffId: string;
  startAt: string;
  durationMinutes: number;
  chair: string;
  room: string;
};

type AppointmentBillLine = {
  id: string;
  name: string;
  staffName: string;
  quantity: number;
  price: number;
  discount: number;
  taxable: number;
  gstRate: number;
  gstAmount: number;
  total: number;
};

type AppointmentActivityLine = {
  id: string;
  title: string;
  time: string;
  body: string;
};

type SchedulerContext = {
  branchId: string;
  date: string;
  from: string;
  to: string;
  staff: StaffLane[];
  staffTotal: number;
  staffWindow: { offset: number; limit: number; total: number; showingFrom: number; showingTo: number };
  appointments: ApiRecord[];
  appointmentTotal: number;
  clients: ApiRecord[];
  services: ApiRecord[];
  schedules: ApiRecord[];
  blockedTimes: ApiRecord[];
  waitlist: ApiRecord[];
  summary: ApiRecord;
};

type CalendarDay = {
  date: string;
  day: string;
  weekday: string;
  selected: boolean;
  today: boolean;
};

type TimeSlot = {
  minute: number;
  label: string;
  input: string;
};

type AppointmentCard = {
  appointment: ApiRecord;
  top: number;
  height: number;
  status: string;
  clientName: string;
  serviceLabel: string;
  timeLabel: string;
};

type LaneBlock = {
  id: string;
  staffId: string;
  top: number;
  height: number;
  label: string;
  kind: 'shift' | 'blocked';
  reason: string;
};

const DAY_START_MINUTES = 8 * 60;
const DAY_END_MINUTES = 22 * 60;
const ROW_HEIGHT = 44;
const STAFF_LIMIT = 15;
const STATUS_OPTIONS = ['booked', 'confirmed', 'arrived', 'waiting', 'in-service', 'completed', 'billed', 'paid', 'cancelled', 'no-show'];
const STATUS_TONES: Record<string, string> = {
  booked: 'blue',
  confirmed: 'indigo',
  arrived: 'teal',
  waiting: 'amber',
  'in-service': 'violet',
  completed: 'green',
  billed: 'emerald',
  paid: 'emerald',
  cancelled: 'red',
  'no-show': 'slate'
};

@Component({
  selector: 'app-appointments-enterprise',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, DatePipe, StateComponent],
  template: `
    <section class="enterprise-scheduler">
      <app-state [loading]="loading()" [error]="error()" loadingText="Loading enterprise scheduler"></app-state>
      <ng-container *ngIf="!loading() && !error()">
        <section class="month-strip-band">
          <button type="button" (click)="shiftMonth(-1)" aria-label="Previous month">&lt;&lt;</button>
          <strong>From {{ monthRange().from | date: 'dd/MM/yyyy' }} To {{ monthRange().to | date: 'dd/MM/yyyy' }}</strong>
          <button type="button" (click)="shiftMonth(1)" aria-label="Next month">&gt;&gt;</button>
          <div class="month-strip" aria-label="Month date strip">
            <button
              type="button"
              *ngFor="let day of monthDays(); trackBy: trackDate"
              [class.active]="day.selected"
              [class.today]="day.today"
              (click)="selectDate(day.date)"
            >
              <strong>{{ day.day }}</strong>
              <span>{{ day.weekday }}</span>
              <small>{{ day.date === selectedDate() ? (context()?.appointmentTotal || 0) : 0 }}/0</small>
            </button>
          </div>
        </section>

        <section class="summary-strip">
          <article><span>Booked</span><strong>{{ summaryValue('booked') }}</strong><small>scheduled</small></article>
          <article><span>Arrived</span><strong>{{ summaryValue('arrived') }}</strong><small>front desk</small></article>
          <article><span>In service</span><strong>{{ summaryValue('inService') }}</strong><small>chair busy</small></article>
          <article><span>Completed</span><strong>{{ summaryValue('completed') }}</strong><small>ready to bill</small></article>
          <article><span>Waitlist</span><strong>{{ summaryValue('waitlist') }}</strong><small>open demand</small></article>
          <article><span>Revenue</span><strong>{{ money(summaryValue('revenue')) }}</strong><small>planned value</small></article>
        </section>

        <section class="scheduler-grid-shell">
          <div class="scheduler-grid" [style.--staff-count]="visibleStaff().length" [style.--row-height.px]="rowHeight">
            <div class="time-head">Time</div>
            <div class="staff-head" *ngFor="let person of visibleStaff(); trackBy: trackStaff">
              <span class="avatar">{{ initials(person.name) }}</span>
              <div>
                <strong>{{ person.name }}</strong>
                <small>{{ person.role || 'Staff' }}</small>
              </div>
              <button class="staff-menu-button" type="button" (click)="openSchedulerActionMenu(person, $event)" title="Staff slot actions">⌄</button>
            </div>

            <div class="time-column">
              <div class="time-row" *ngFor="let slot of timeSlots(); trackBy: trackSlot">{{ slot.label }}</div>
              <span class="current-time-badge" *ngIf="currentTimeBodyTop() >= 0" [style.top.px]="currentTimeBodyTop()">
                {{ currentTimeLabel() }}
              </span>
            </div>

            <div
              class="staff-lane"
              *ngFor="let person of visibleStaff(); trackBy: trackStaff"
              (dragover)="$event.preventDefault()"
              (drop)="dropAppointment(person, $event)"
            >
              <ng-container *ngIf="schedulerActionMenu() as menu">
                <div class="staff-action-menu" *ngIf="menu.staffId === person.id" [style.top.px]="menu.top" (click)="$event.stopPropagation()">
                  <button type="button" (click)="openAddBlockedTimeFromMenu(person, menu.minute)">Add Blocked Time</button>
                  <button type="button" (click)="openRemoveBlockedTimeFromMenu(person, menu.minute)">
                    Remove Blocked Time
                    <span>{{ blockedCountForStaff(person.id) }}</span>
                  </button>
                </div>
              </ng-container>
              <button
                class="lane-cell"
                type="button"
                *ngFor="let slot of timeSlots(); trackBy: trackSlot"
                [title]="slot.label + ' - ' + person.name + ' | ' + cellCount(person.id, slot.minute)"
                (click)="openQuickBooking(person, slot)"
                (contextmenu)="openAddBlockedTime(person, slot, $event)"
                (mouseenter)="hoverSlot.set({ staffName: person.name, label: slot.label, top: minuteTop(slot.minute) })"
                (mouseleave)="hoverSlot.set(null)"
              ></button>
              <span class="current-time-line" *ngIf="currentTimeBodyTop() >= 0" [style.top.px]="currentTimeBodyTop()"></span>

              <div class="lane-block shift" *ngFor="let block of shiftBlocksByStaff().get(person.id) || []; trackBy: trackBlock" [style.top.px]="block.top" [style.height.px]="block.height">
                {{ block.label }}
              </div>
              <button
                class="lane-block blocked"
                type="button"
                *ngFor="let block of blockedBlocksByStaff().get(person.id) || []; trackBy: trackBlock"
                [style.top.px]="block.top"
                [style.height.px]="block.height"
                (click)="openRemoveBlockedTime(person, $event)"
              >
                {{ block.reason || 'Blocked' }}
              </button>

              <button
                type="button"
                class="appointment-card"
                *ngFor="let card of appointmentCardsByStaff().get(person.id) || []; trackBy: trackCard"
                [class]="statusClass(card.status)"
                [style.top.px]="card.top"
                [style.height.px]="card.height"
                draggable="true"
                (dragstart)="beginDrag(card.appointment)"
                (dragend)="clearDrag()"
                (click)="openAppointment(card.appointment); $event.stopPropagation()"
              >
                <strong>{{ card.timeLabel }}</strong>
                <b>{{ card.clientName }}</b>
                <span>{{ card.serviceLabel }}</span>
                <small>{{ label(card.status) }}</small>
                <span class="resize-handle" (pointerdown)="beginResize(card.appointment, $event)"></span>
              </button>
            </div>

            <div class="slot-hover" *ngIf="hoverSlot() as hover" [style.top.px]="hover.top">
              {{ hover.label }} - {{ hover.staffName }} | {{ hoverSummary() }}
            </div>
          </div>
        </section>

        <section class="operations-grid">
          <article
            class="ops-panel ai-slot-launch"
            role="button"
            tabindex="0"
            aria-label="Open AI slot pilot"
            (click)="openAiSlotPilot()"
            (keydown.enter)="openAiSlotPilot()"
            (keydown.space)="openAiSlotPilot(); $event.preventDefault()"
          >
            <div class="panel-head"><span class="eyebrow">AI slot pilot</span><strong>Best safe slots</strong><small>Open</small></div>
            <button type="button" *ngFor="let slot of smartSlots(); trackBy: trackSmartSlot" (click)="openQuickBooking(slot.staff, slot.slot); $event.stopPropagation()">
              <b>{{ slot.slot.label }}</b>
              <span>{{ slot.staff.name }}</span>
              <small>{{ slot.reason }}</small>
            </button>
            <div class="empty-state" *ngIf="!smartSlots().length">No open safe slot in the visible window.</div>
          </article>
          <article class="ops-panel">
            <div class="panel-head"><span class="eyebrow">Waitlist</span><strong>Demand queue</strong></div>
            <div class="waitlist-row" *ngFor="let row of waitlist(); trackBy: trackApiRecord">
              <strong>{{ clientName(row.clientId) }}</strong>
              <span>{{ serviceNames(row.serviceIds) }}</span>
              <small>{{ row.priority || 'normal' }} · {{ row.preferredDate || selectedDate() }}</small>
            </div>
            <div class="empty-state" *ngIf="!waitlist().length">No waiting clients for this date.</div>
          </article>
          <article class="ops-panel pulse">
            <div class="panel-head"><span class="eyebrow">Operations pulse</span><strong>Risk radar</strong></div>
            <div class="pulse-grid">
              <div><span>Capacity</span><strong>{{ summaryValue('capacityPct') }}%</strong><small>{{ summaryValue('bookedMinutes') }} of {{ summaryValue('plannedMinutes') }} min</small></div>
              <div><span>Conflicts</span><strong>{{ summaryValue('conflicts') }}</strong><small>staff/chair overlaps</small></div>
              <div><span>Blocked</span><strong>{{ summaryValue('blockedTimes') }}</strong><small>staff unavailable slots</small></div>
              <div><span>No-show</span><strong>{{ summaryValue('noShow') }}</strong><small>recovery queue</small></div>
            </div>
          </article>
        </section>
      </ng-container>

      <div class="drawer-backdrop" *ngIf="drawer()" (click)="closeDrawer()"></div>

      <aside class="scheduler-drawer ai-slot-drawer" *ngIf="drawer() === 'ai-slots'">
        <header>
          <div>
            <span class="eyebrow">AI slot pilot</span>
            <h3>Best safe slots</h3>
          </div>
          <button type="button" (click)="closeDrawer()">×</button>
        </header>
        <div class="ai-slot-detail-grid">
          <button type="button" *ngFor="let slot of smartSlots(); trackBy: trackSmartSlot" (click)="openQuickBooking(slot.staff, slot.slot)">
            <strong>{{ slot.slot.label }}</strong>
            <span>{{ slot.staff.name }}</span>
            <small>{{ slot.reason }}</small>
          </button>
          <div class="empty-state" *ngIf="!smartSlots().length">No open safe slot in the visible window.</div>
        </div>
      </aside>

      <aside class="scheduler-drawer" *ngIf="drawer() === 'booking'">
        <header>
          <div>
            <span class="eyebrow">Front-desk quick booking</span>
            <h3>Create multi-service booking</h3>
          </div>
          <button type="button" (click)="closeDrawer()">×</button>
        </header>
        <form [formGroup]="bookingForm" (ngSubmit)="createBooking()" class="drawer-stack">
          <label class="search-select">
            <span>Client</span>
            <div class="picker-combo">
              <input
                class="picker-search"
                type="search"
                [value]="bookingClientSearch()"
                (input)="bookingClientSearch.set($any($event.target).value)"
                placeholder="Search client by name or phone"
                autocomplete="off"
              />
              <select formControlName="clientId">
                <option value="">Select client</option>
                <option *ngFor="let client of filteredClients(); trackBy: trackApiRecord" [value]="client.id">{{ client.name }} · {{ client.phone || client.mobile || '' }}</option>
              </select>
            </div>
            <small class="picker-meta" *ngIf="filteredClients().length">{{ filteredClients().length }} matching client(s)</small>
            <small class="picker-empty" *ngIf="!filteredClients().length">No client match found.</small>
          </label>
          <label><span>Status</span><select formControlName="status"><option *ngFor="let status of statusOptions" [value]="status">{{ label(status) }}</option></select></label>
          <label><span>Notes</span><textarea formControlName="notes" rows="2"></textarea></label>

          <div class="service-line-head">
            <strong>Services</strong>
            <button class="ghost-button mini" type="button" (click)="addServiceLine()">Add service</button>
          </div>
          <div class="service-line" *ngFor="let line of bookingLines(); trackBy: trackLine">
            <label class="search-select">
              <span>Service</span>
              <div class="picker-combo">
                <input
                  class="picker-search"
                  type="search"
                  [value]="lineSearch(serviceSearchByLine(), line.id)"
                  (input)="setLineSearch('service', line.id, $any($event.target).value)"
                  placeholder="Search service"
                  autocomplete="off"
                />
                <select [value]="line.serviceId" (change)="updateLine(line.id, 'serviceId', $any($event.target).value)">
                  <option value="">Select service</option>
                  <option *ngFor="let service of filteredServices(line); trackBy: trackApiRecord" [value]="service.id">{{ service.name }} · {{ service.durationMinutes || 30 }}m</option>
                </select>
              </div>
              <small class="picker-empty" *ngIf="!filteredServices(line).length">No service match.</small>
            </label>
            <label class="search-select">
              <span>Staff</span>
              <div class="picker-combo">
                <input
                  class="picker-search"
                  type="search"
                  [value]="lineSearch(staffSearchByLine(), line.id)"
                  (input)="setLineSearch('staff', line.id, $any($event.target).value)"
                  placeholder="Search staff"
                  autocomplete="off"
                />
                <select [value]="line.staffId" (change)="updateLine(line.id, 'staffId', $any($event.target).value)">
                  <option value="">Select staff</option>
                  <option *ngFor="let person of filteredStaff(line); trackBy: trackStaff" [value]="person.id">{{ person.name }}</option>
                </select>
              </div>
              <small class="picker-empty" *ngIf="!filteredStaff(line).length">No staff match.</small>
            </label>
            <label><span>Start</span><input type="datetime-local" [value]="line.startAt" (change)="updateLine(line.id, 'startAt', $any($event.target).value)" /></label>
            <label><span>Duration</span><input type="number" min="15" step="15" [value]="line.durationMinutes" (change)="updateLine(line.id, 'durationMinutes', $any($event.target).value)" /></label>
            <label><span>Chair / room</span><input [value]="line.chair" (input)="updateLine(line.id, 'chair', $any($event.target).value)" placeholder="Chair 1" /></label>
            <button class="ghost-button mini danger" type="button" (click)="removeServiceLine(line.id)" [disabled]="bookingLines().length === 1">Remove</button>
          </div>

          <fieldset class="notify-box">
            <legend>SMS hooks</legend>
            <label><input type="checkbox" formControlName="notifyClient" /> Client</label>
            <label><input type="checkbox" formControlName="notifyStaff" /> Staff</label>
            <label><input type="checkbox" formControlName="notifyOwner" /> Owner</label>
          </fieldset>

          <div class="drawer-actions">
            <button class="ghost-button" type="button" (click)="closeDrawer()">Cancel</button>
            <button class="primary-button" type="submit" [disabled]="saving() || bookingForm.invalid">{{ saving() ? 'Saving...' : 'Create booking' }}</button>
          </div>
        </form>
      </aside>

      <aside class="scheduler-drawer" *ngIf="drawer() === 'blocked-time'">
        <header>
          <div>
            <span class="eyebrow">Staff availability</span>
            <h3>{{ blockMode() === 'add' ? 'New blocked time' : 'Remove blocked time' }}</h3>
          </div>
          <button type="button" (click)="closeDrawer()">×</button>
        </header>
        <form *ngIf="blockMode() === 'add'" [formGroup]="blockForm" (ngSubmit)="saveBlockedTime()" class="drawer-stack">
          <label><span>Date</span><input type="date" formControlName="date" /></label>
          <label><span>Staff</span><select formControlName="staffId"><option *ngFor="let person of allStaffChoices(); trackBy: trackStaff" [value]="person.id">{{ person.name }}</option></select></label>
          <div class="two-col">
            <label><span>Start time</span><input type="time" formControlName="startTime" /></label>
            <label><span>End time</span><input type="time" formControlName="endTime" /></label>
          </div>
          <label><span>Reason</span><textarea rows="3" formControlName="reason"></textarea></label>
          <div class="drawer-actions">
            <button class="ghost-button" type="button" (click)="closeDrawer()">Cancel</button>
            <button class="primary-button" type="submit" [disabled]="saving() || blockForm.invalid">Save</button>
          </div>
        </form>
        <div *ngIf="blockMode() === 'remove'" class="drawer-stack">
          <div class="remove-row" *ngFor="let block of removableBlocks(); trackBy: trackApiRecord">
            <div>
              <strong>{{ block.startAt | date: 'shortTime' }} - {{ block.endAt | date: 'shortTime' }}</strong>
              <span>{{ block.reason || 'Blocked time' }}</span>
            </div>
            <button class="ghost-button mini danger" type="button" (click)="removeBlockedTime(block.id)">Remove</button>
          </div>
          <div class="empty-state" *ngIf="!removableBlocks().length">No blocked time for selected staff/date.</div>
        </div>
      </aside>

      <aside class="scheduler-drawer bill-drawer" *ngIf="drawer() === 'appointment' && selectedAppointment() as appointment">
        <header class="bill-header">
          <button class="bill-close" type="button" (click)="closeDrawer()">×</button>
          <div>
            <h3>View Bill</h3>
            <span>{{ appointment.startAt | date: 'shortTime' }} · {{ label(appointment.status || 'booked') }}</span>
          </div>
          <button class="ghost-button mini" type="button" (click)="printAppointmentBill()">Print</button>
        </header>

        <div class="bill-tabs">
          <button type="button" [class.active]="appointmentDetailTab() === 'booking'" (click)="appointmentDetailTab.set('booking')">Booking Details</button>
          <button type="button" [class.active]="appointmentDetailTab() === 'activity'" (click)="appointmentDetailTab.set('activity')">Activity Log</button>
        </div>

        <ng-container *ngIf="appointmentDetailTab() === 'booking'; else activityPanel">
          <div class="bill-layout">
            <section class="bill-side">
              <article class="client-bill-card">
                <span class="avatar large">{{ initials(clientName(appointment.clientId)) }}</span>
                <div>
                  <strong>{{ clientName(appointment.clientId) }}</strong>
                  <small>{{ clientPhone(appointment.clientId) || appointment.clientId }}</small>
                  <b>Ewallet Balance: {{ clientWalletBalance(appointment.clientId) | currency: 'INR':'symbol':'1.0-0' }}</b>
                </div>
                <button class="ghost-button mini" type="button" (click)="openClientHistory(appointment)">View History</button>
              </article>

              <article class="bill-panel">
                <h4>Payment Mode</h4>
                <strong>{{ appointmentPaymentMode(appointment) }}</strong>
              </article>
              <article class="bill-panel">
                <h4>Notes :</h4>
                <p>{{ appointment.notes || appointment.note || 'No notes added.' }}</p>
              </article>
              <article class="bill-panel">
                <h4>Staff Alert :</h4>
                <p>{{ appointment.staffAlert || appointment.staff_alert || 'No staff alert.' }}</p>
              </article>
              <article class="bill-panel appointment-date-panel">
                <h4>Appointment Date</h4>
                <div class="bill-status-row">
                  <strong>{{ appointment.startAt | date: 'dd-MM-yyyy' }}</strong>
                  <select [value]="appointment.status || 'booked'" (change)="handleAppointmentAction(appointment, $any($event.target).value)">
                    <option value="confirmed">Confirmed</option>
                    <option value="booked">Not Confirmed</option>
                    <option value="arrived">Arrived</option>
                    <option value="in-service">Start</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancel</option>
                    <option value="no-show">Not Came</option>
                    <option value="edit">Edit Booking</option>
                    <option value="reschedule">Reschedule Booking</option>
                    <option value="add-payment">Add Payment</option>
                    <option value="add-tip">Add Tip</option>
                  </select>
                </div>
              </article>
              <article class="bill-panel bill-lines">
                <div><span>Subtotal</span><strong>{{ appointmentSubtotal(appointment) | currency: 'INR':'symbol':'1.0-0' }}</strong></div>
                <div><span>Actual Price</span><strong>{{ appointmentSubtotal(appointment) | currency: 'INR':'symbol':'1.0-0' }}</strong></div>
                <div><span>Discount</span><strong>{{ appointmentDiscount(appointment) | currency: 'INR':'symbol':'1.0-0' }}</strong></div>
                <div><span>Taxable Amount</span><strong>{{ appointmentTaxable(appointment) | currency: 'INR':'symbol':'1.0-0' }}</strong></div>
                <div><span>GST</span><strong>{{ appointmentGst(appointment) | currency: 'INR':'symbol':'1.0-0' }}</strong></div>
              </article>
              <article class="bill-panel bill-lines total-box">
                <div><span>Total</span><strong>{{ appointmentTotal(appointment) | currency: 'INR':'symbol':'1.0-0' }}</strong></div>
                <div><span>Paid</span><strong>{{ appointmentPaid(appointment) | currency: 'INR':'symbol':'1.0-0' }}</strong></div>
                <div><span>Due</span><strong>{{ appointmentDue(appointment) | currency: 'INR':'symbol':'1.0-0' }}</strong></div>
              </article>
            </section>

            <section class="bill-main">
              <article class="service-bill-card" *ngFor="let line of appointmentBillLines(appointment); trackBy: trackBillLine">
                <h4>Service</h4>
                <p>{{ line.name }}, {{ appointment.startAt | date: 'shortTime' }}, {{ line.staffName }}</p>
                <div class="service-chip-row">
                  <span class="chip warm">Qty: {{ line.quantity }}</span>
                  <span class="chip cool">Price: {{ line.price | currency: 'INR':'symbol':'1.0-0' }}</span>
                  <span class="chip pink">Discount: {{ line.discount | currency: 'INR':'symbol':'1.0-0' }}</span>
                  <span class="chip teal">Total: {{ line.total | currency: 'INR':'symbol':'1.0-0' }}</span>
                </div>
              </article>
              <div class="drawer-actions wrap">
                <button class="ghost-button" type="button" (click)="openEditAppointment(appointment)">Edit Booking</button>
                <button class="ghost-button" type="button" (click)="queueSms(appointment, 'client')">SMS client</button>
                <button class="ghost-button" type="button" (click)="queueSms(appointment, 'staff')">SMS staff</button>
                <button class="ghost-button" type="button" (click)="queueSms(appointment, 'owner')">SMS owner</button>
                <button class="primary-button" type="button" (click)="convertToPos(appointment)">POS handoff</button>
              </div>
            </section>
          </div>
        </ng-container>

        <ng-template #activityPanel>
          <div class="activity-log-panel">
            <article *ngFor="let event of appointmentActivityLines(appointment); trackBy: trackActivityLine">
              <strong>{{ event.title }}</strong>
              <span>{{ event.time | date: 'short' }}</span>
              <p>{{ event.body }}</p>
            </article>
          </div>
        </ng-template>
      </aside>

      <div class="toast" *ngIf="notice()">{{ notice() }}</div>
    </section>
  `,
  styles: [`
    :host { display: block; }
    .enterprise-scheduler { display: grid; gap: 16px; }
    .month-strip-band, .summary-strip, .scheduler-grid-shell, .operations-grid, .scheduler-drawer {
      border: 1px solid #dbe8e4;
      background: rgba(255,255,255,.94);
      box-shadow: 0 18px 42px rgba(15, 23, 42, .08);
    }
    h2, h3 { margin: 0; color: #111827; }
    h2 { font-size: 34px; line-height: 1.05; }
    h3 { font-size: 22px; }
    p { margin: 8px 0 0; color: #64748b; max-width: 760px; }
    .eyebrow { color: #2563eb; font-size: 12px; font-weight: 900; letter-spacing: 0; text-transform: uppercase; }
    .calendar-actions, .drawer-actions, .staff-window-controls { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
    .primary-button, .ghost-button {
      border: 1px solid #cfe0dc;
      border-radius: 12px;
      padding: 12px 16px;
      font-weight: 900;
      color: #0f172a;
      background: white;
      text-decoration: none;
      cursor: pointer;
    }
    .primary-button { background: #0f8f7f; color: white; border-color: #0f8f7f; }
    .ghost-button.mini { padding: 8px 11px; font-size: 12px; }
    .danger { color: #b91c1c; }
    .month-strip-band { display: grid; grid-template-columns: auto auto auto 1fr; gap: 10px; align-items: center; padding: 16px; border-radius: 14px; }
    .month-strip-band > button { height: 44px; width: 44px; border-radius: 10px; border: 1px solid #cbd5e1; background: #fff; font-weight: 900; }
    .month-strip { display: flex; gap: 8px; overflow-x: auto; padding-bottom: 6px; }
    .month-strip button { min-width: 56px; border: 1px solid #d9e5e2; background: #f8fafc; border-radius: 10px; padding: 8px 6px; color: #334155; }
    .month-strip button.active { border-color: #0f8f7f; box-shadow: inset 0 -3px 0 #0f8f7f; background: #ecfdf5; }
    .month-strip button.today { color: #0f8f7f; }
    .month-strip span, .month-strip small { display: block; font-size: 11px; }
    label { display: grid; gap: 6px; color: #64748b; font-size: 12px; font-weight: 900; text-transform: uppercase; }
    input, select, textarea { width: 100%; min-height: 42px; border: 1px solid #d5e2df; border-radius: 10px; padding: 9px 11px; font: inherit; background: white; color: #172033; }
    .summary-strip { display: grid; grid-template-columns: repeat(6, minmax(120px, 1fr)); gap: 12px; padding: 12px; border-radius: 16px; }
    .summary-strip article, .pulse-grid div { border: 1px solid #d8e7e3; border-radius: 12px; padding: 12px; background: linear-gradient(135deg, #ffffff, #f5fbfa); }
    .summary-strip span, .pulse-grid span { color: #64748b; font-size: 12px; font-weight: 900; text-transform: uppercase; display: block; }
    .summary-strip strong { display: block; font-size: 24px; margin-top: 5px; }
    .summary-strip small, .pulse-grid small { color: #64748b; }
    .scheduler-grid-shell { padding: 16px; border-radius: 16px; overflow: hidden; }
    .scheduler-grid {
      --time-width: 86px;
      --staff-width: minmax(132px, 1fr);
      position: relative;
      display: grid;
      grid-template-columns: var(--time-width) repeat(var(--staff-count), var(--staff-width));
      overflow: auto;
      max-height: 720px;
      border: 1px solid #d7e4e1;
      border-radius: 14px;
      background: #f8fbfb;
    }
    .time-head, .staff-head { position: sticky; top: 0; z-index: 6; min-height: 76px; background: #f8fbfb; border-bottom: 1px solid #d7e4e1; }
    .time-head { left: 0; z-index: 8; display: grid; place-items: center; font-weight: 900; color: #475569; text-transform: uppercase; }
    .staff-head { display: flex; align-items: center; gap: 8px; padding: 10px; border-left: 1px solid #d7e4e1; }
    .staff-head strong { font-size: 12px; line-height: 1.1; display: block; }
    .staff-head small { font-size: 11px; color: #64748b; }
    .staff-menu-button { margin-left: auto; height: 28px; width: 28px; border: 1px solid #cbd5e1; border-radius: 50%; background: #fff; cursor: pointer; font-weight: 900; }
    .staff-menu-button:hover { border-color: #0f8f7f; color: #0f766e; background: #ecfdf5; }
    .avatar { height: 30px; width: 30px; border-radius: 50%; display: grid; place-items: center; background: #d9f99d; color: #115e59; font-size: 11px; font-weight: 900; flex: 0 0 auto; }
    .time-column { position: sticky; left: 0; z-index: 5; grid-column: 1; grid-row: 2; background: #f8fbfb; min-height: calc(var(--row-height) * 56); }
    .time-row { height: var(--row-height); border-bottom: 1px solid #e5ecea; display: flex; align-items: start; justify-content: flex-end; padding: 8px 10px 0 0; font-size: 12px; font-weight: 900; color: #64748b; }
    .staff-lane { position: relative; min-height: calc(var(--row-height) * 56); border-left: 1px solid #d7e4e1; grid-row: 2; }
    .lane-cell { display: block; width: 100%; height: var(--row-height); border: 0; border-bottom: 1px solid #edf2f1; background: white; cursor: crosshair; }
    .lane-cell:hover { background: #f0fdfa; outline: 1px solid #99f6e4; }
    .lane-block { position: absolute; left: 0; right: 0; z-index: 1; border: 1px solid rgba(15,23,42,.08); display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 12px; overflow: hidden; }
    .lane-block.shift { background: #fed7aa; color: #7c2d12; }
    .lane-block.blocked { background: repeating-linear-gradient(135deg, rgba(148,163,184,.25), rgba(148,163,184,.25) 8px, rgba(226,232,240,.7) 8px, rgba(226,232,240,.7) 16px); color: #334155; cursor: pointer; }
    .appointment-card { position: absolute; left: 8px; right: 8px; z-index: 4; border-radius: 8px; border: 1px solid #475569; padding: 8px 10px; text-align: left; color: #172033; overflow: hidden; cursor: grab; box-shadow: 0 10px 20px rgba(15,23,42,.12); }
    .appointment-card strong, .appointment-card b, .appointment-card span, .appointment-card small { display: block; line-height: 1.2; }
    .appointment-card strong { font-size: 12px; }
    .appointment-card b { font-size: 15px; margin-top: 4px; }
    .appointment-card span, .appointment-card small { font-size: 12px; }
    .appointment-card.blue { background: #bfdbfe; border-color: #2563eb; }
    .appointment-card.indigo { background: #c7d2fe; border-color: #4f46e5; }
    .appointment-card.teal { background: #99f6e4; border-color: #0f766e; }
    .appointment-card.amber { background: #fde68a; border-color: #d97706; }
    .appointment-card.violet { background: #ddd6fe; border-color: #7c3aed; }
    .appointment-card.green, .appointment-card.emerald { background: #bbf7d0; border-color: #16a34a; }
    .appointment-card.red { background: #fecaca; border-color: #dc2626; }
    .appointment-card.slate { background: #e2e8f0; border-color: #64748b; }
    .resize-handle { position: absolute; left: 0; right: 0; bottom: 0; height: 8px; cursor: ns-resize; background: rgba(15,23,42,.15); }
    .current-time-badge { position: absolute; left: 7px; z-index: 12; transform: translateY(-50%); border: 1px solid #ff2f2f; border-radius: 999px; background: #fff; color: #f02b2b; padding: 2px 7px; font-size: 11px; font-weight: 900; }
    .current-time-line { position: absolute; left: 0; right: 0; z-index: 3; height: 2px; background: #ff2f2f; box-shadow: 0 0 0 1px rgba(255,47,47,.1); pointer-events: none; }
    .current-time-line::before { content: ''; position: absolute; left: -4px; top: -4px; width: 10px; height: 10px; border-radius: 999px; background: #ff2f2f; }
    .staff-action-menu { position: absolute; left: 10px; z-index: 20; min-width: 178px; border: 1px solid #cbd5e1; border-radius: 10px; background: #fff; box-shadow: 0 18px 40px rgba(15,23,42,.2); overflow: hidden; }
    .staff-action-menu button { width: 100%; min-height: 38px; display: flex; align-items: center; justify-content: space-between; gap: 10px; border: 0; border-bottom: 1px solid #e2e8f0; background: #fff; padding: 9px 12px; color: #172033; font-size: 12px; font-weight: 900; text-align: left; cursor: pointer; }
    .staff-action-menu button:hover { background: #f0fdfa; color: #0f766e; }
    .staff-action-menu button:last-child { border-bottom: 0; }
    .staff-action-menu span { border-radius: 999px; background: #e2e8f0; padding: 2px 7px; font-size: 11px; }
    .slot-hover { position: absolute; left: 96px; z-index: 10; background: #fff7ed; border: 1px solid #fb923c; padding: 4px 8px; border-radius: 6px; font-size: 12px; box-shadow: 0 10px 24px rgba(15,23,42,.12); pointer-events: none; }
    .operations-grid { display: grid; grid-template-columns: 1fr 1fr 1.2fr; gap: 14px; }
    .ops-panel { border-radius: 14px; padding: 16px; display: grid; gap: 10px; align-content: start; }
    .ai-slot-launch { cursor: pointer; }
    .ai-slot-launch:focus-visible { outline: 3px solid rgba(15,143,127,.25); outline-offset: 3px; }
    .ai-slot-launch:hover { border-color: #0f8f7f; box-shadow: 0 18px 42px rgba(15,143,127,.13); }
    .panel-head { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #e2e8f0; padding-bottom: 10px; }
    .panel-head small { border: 1px solid #99f6e4; border-radius: 999px; color: #0f766e; background: #ecfdf5; padding: 4px 9px; font-weight: 900; }
    .ops-panel button, .waitlist-row { border: 1px solid #dbe7e4; border-radius: 10px; background: #fff; padding: 12px; text-align: left; display: grid; gap: 4px; }
    .pulse-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
    .empty-state { border: 1px dashed #cbd5e1; border-radius: 10px; padding: 18px; text-align: center; color: #64748b; background: #fff; }
    .drawer-backdrop { position: fixed; inset: 0; background: rgba(15,23,42,.42); z-index: 50; }
    .scheduler-drawer { position: fixed; top: 0; right: 0; bottom: 0; width: min(720px, 96vw); z-index: 60; border-radius: 0; padding: 22px; overflow-y: auto; }
    .scheduler-drawer header { display: flex; justify-content: space-between; align-items: start; gap: 12px; margin-bottom: 18px; }
    .scheduler-drawer header button { border: 0; background: transparent; font-size: 34px; cursor: pointer; }
    .ai-slot-drawer { width: min(560px, 96vw); }
    .ai-slot-detail-grid { display: grid; gap: 12px; }
    .ai-slot-detail-grid button { border: 1px solid #dbe7e4; border-radius: 12px; background: #fff; padding: 14px; text-align: left; display: grid; gap: 5px; cursor: pointer; }
    .ai-slot-detail-grid button:hover { border-color: #0f8f7f; background: #f0fdfa; }
    .ai-slot-detail-grid strong { font-size: 18px; }
    .ai-slot-detail-grid small { color: #64748b; }
    .bill-drawer { width: min(980px, 98vw); background: #fff; padding: 0; }
    .bill-header { position: sticky; top: 0; z-index: 2; display: grid !important; grid-template-columns: auto 1fr auto; align-items: center !important; padding: 22px 28px 14px; background: #fff; border-bottom: 1px solid #eef2f7; }
    .bill-header h3 { font-size: 28px; }
    .bill-header span { color: #64748b; font-size: 13px; }
    .bill-close { font-size: 34px !important; line-height: 1; color: #0f172a; }
    .bill-header .ghost-button { border: 1px solid #cfe0dc; background: #fff; font-size: 12px; }
    .bill-tabs { display: flex; gap: 10px; padding: 0 28px 14px; background: #fff; }
    .bill-tabs button { border: 0; border-radius: 10px; padding: 12px 16px; background: #f4f4f5; color: #172033; font-weight: 900; cursor: pointer; }
    .bill-tabs button.active { background: #171b28; color: #fff; }
    .bill-layout { display: grid; grid-template-columns: 330px 1fr; gap: 18px; padding: 0 22px 28px; }
    .bill-side { display: grid; gap: 14px; align-content: start; }
    .client-bill-card, .bill-panel, .service-bill-card, .activity-log-panel article {
      border: 1px solid #e3e8ef;
      border-radius: 10px;
      background: #fff;
      padding: 16px;
      box-shadow: 0 8px 20px rgba(15,23,42,.04);
    }
    .client-bill-card { display: grid; grid-template-columns: 42px 1fr; gap: 12px; align-items: start; }
    .client-bill-card .ghost-button { grid-column: 2; justify-self: start; background: #171b28; color: #fff; border-color: #171b28; }
    .client-bill-card strong { display: block; text-transform: uppercase; color: #070044; }
    .client-bill-card small { display: block; color: #64748b; margin-top: 2px; }
    .client-bill-card b { display: inline-block; margin-top: 8px; border-radius: 6px; background: #fee2e2; color: #ef4444; padding: 3px 8px; font-size: 11px; }
    .avatar.large { width: 42px; height: 42px; font-size: 18px; background: #ede9fe; color: #4c1d95; }
    .bill-panel h4, .service-bill-card h4 { margin: 0 0 10px; color: #070044; font-size: 18px; }
    .bill-panel p { margin: 0; color: #334155; }
    .bill-status-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
    .bill-status-row select { min-height: 40px; max-width: 160px; background: #9bd8c5; border-color: #0f766e; }
    .bill-lines { display: grid; gap: 10px; }
    .bill-lines div { display: flex; justify-content: space-between; gap: 16px; color: #64748b; }
    .bill-lines strong { color: #0f172a; }
    .total-box strong { font-size: 18px; }
    .bill-main { display: grid; gap: 14px; align-content: start; }
    .service-bill-card { background: #f6f0ff; border-color: #eadcff; }
    .service-bill-card p { margin: 0 0 10px; color: #64748b; }
    .service-chip-row { display: flex; flex-wrap: wrap; gap: 10px; }
    .chip { border-radius: 6px; padding: 6px 10px; font-size: 13px; font-weight: 900; }
    .chip.warm { background: #fed7aa; color: #9a3412; }
    .chip.cool { background: #dbeafe; color: #1d4ed8; }
    .chip.pink { background: #f5d0fe; color: #86198f; }
    .chip.teal { background: #99f6e4; color: #115e59; }
    .activity-log-panel { display: grid; gap: 12px; padding: 0 22px 28px; }
    .activity-log-panel strong, .activity-log-panel span { display: block; }
    .activity-log-panel span { margin-top: 4px; color: #64748b; font-size: 12px; }
    .drawer-stack { display: grid; gap: 14px; }
    .service-line { display: grid; grid-template-columns: 1.2fr 1fr 1.1fr .7fr .8fr auto; gap: 10px; align-items: end; border: 1px solid #dbe7e4; border-radius: 12px; padding: 12px; }
    .service-line-head, .remove-row { display: flex; justify-content: space-between; align-items: center; gap: 10px; }
    .search-select { display: grid; gap: 6px; align-content: start; }
    .picker-combo { display: grid; grid-template-columns: minmax(0, 1fr) minmax(148px, .72fr); gap: 8px; align-items: center; }
    .picker-search { min-height: 38px; border-radius: 10px; border: 1px solid #cfe0dc; background: #f8fffd; padding: 9px 10px; font-weight: 800; color: #172033; }
    .picker-search:focus { border-color: #0f8f7f; outline: 3px solid rgba(15,143,127,.14); background: #fff; }
    .picker-meta, .picker-empty { font-size: 11px; font-weight: 800; text-transform: none; color: #64748b; }
    .picker-empty { color: #b45309; }
    .two-col, .status-grid, .notify-box, .pulse-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
    .notify-box { border: 1px solid #dbe7e4; border-radius: 12px; padding: 12px; }
    .notify-box label { display: flex; align-items: center; gap: 8px; text-transform: none; font-size: 14px; color: #172033; }
    .notify-box input { width: auto; min-height: auto; }
    .detail-card { border: 1px solid #dbe7e4; border-radius: 12px; padding: 14px; display: grid; gap: 4px; background: #f8fafc; }
    .status-grid button { min-height: 40px; border: 1px solid #dbe7e4; border-radius: 10px; background: white; font-weight: 800; }
    .wrap { flex-wrap: wrap; }
    .toast { position: fixed; right: 24px; bottom: 24px; z-index: 70; background: #0f8f7f; color: white; padding: 14px 18px; border-radius: 12px; box-shadow: 0 18px 36px rgba(15,23,42,.22); font-weight: 900; }
    @media (max-width: 1100px) {
      .summary-strip, .operations-grid, .service-line, .bill-layout { grid-template-columns: 1fr 1fr; }
      .picker-combo { grid-template-columns: 1fr; }
    }
    @media (max-width: 720px) {
      .month-strip-band { grid-template-columns: 1fr; }
      .summary-strip, .operations-grid, .service-line, .two-col, .pulse-grid, .bill-layout { grid-template-columns: 1fr; }
    }
  `]
})
export class AppointmentsEnterpriseComponent implements OnInit, OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly resizeState = signal<{ appointment: ApiRecord; startY: number; originalEnd: string } | null>(null);
  private timer = 0;
  readonly api = inject(ApiService);
  readonly state = inject(AppStateService);
  private readonly router = inject(Router);
  readonly rowHeight = ROW_HEIGHT;
  readonly statusOptions = STATUS_OPTIONS;
  readonly context = signal<SchedulerContext | null>(null);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly notice = signal('');
  readonly selectedDate = signal(new Date().toISOString().slice(0, 10));
  readonly staffOffset = signal(0);
  readonly slotMinutes = signal(15);
  readonly statusFilter = signal('');
  readonly staffSearch = signal('');
  readonly drawer = signal<SchedulerDrawer>('');
  readonly blockMode = signal<BlockMode>('add');
  readonly selectedStaff = signal<StaffLane | null>(null);
  readonly selectedAppointment = signal<ApiRecord | null>(null);
  readonly draggingAppointment = signal<ApiRecord | null>(null);
  readonly schedulerActionMenu = signal<SchedulerActionMenu | null>(null);
  readonly now = signal(new Date());
  readonly hoverSlot = signal<{ staffName: string; label: string; top: number } | null>(null);
  readonly bookingLines = signal<BookingLineDraft[]>([]);
  readonly bookingClientSearch = signal('');
  readonly serviceSearchByLine = signal<Record<string, string>>({});
  readonly staffSearchByLine = signal<Record<string, string>>({});
  readonly editingAppointmentId = signal('');
  readonly appointmentDetailTab = signal<'booking' | 'activity'>('booking');

  readonly bookingForm = this.fb.group({
    clientId: ['', Validators.required],
    status: ['booked', Validators.required],
    notes: [''],
    notifyClient: [true],
    notifyStaff: [true],
    notifyOwner: [false]
  });

  readonly blockForm = this.fb.group({
    date: [this.selectedDate(), Validators.required],
    staffId: ['', Validators.required],
    startTime: ['10:00', Validators.required],
    endTime: ['10:30', Validators.required],
    reason: ['Blocked time']
  });

  readonly monthRange = computed(() => {
    const date = new Date(`${this.selectedDate()}T00:00:00`);
    const first = new Date(date.getFullYear(), date.getMonth(), 1);
    const last = new Date(date.getFullYear(), date.getMonth() + 1, 0);
    return { from: this.dateInput(first), to: this.dateInput(last) };
  });

  readonly monthDays = computed<CalendarDay[]>(() => {
    const range = this.monthRange();
    const days: CalendarDay[] = [];
    const cursor = new Date(`${range.from}T00:00:00`);
    const end = new Date(`${range.to}T00:00:00`);
    while (cursor <= end) {
      const date = this.dateInput(cursor);
      days.push({
        date,
        day: cursor.toLocaleDateString('en-IN', { day: '2-digit' }),
        weekday: cursor.toLocaleDateString('en-IN', { weekday: 'short' }),
        selected: date === this.selectedDate(),
        today: date === new Date().toISOString().slice(0, 10)
      });
      cursor.setDate(cursor.getDate() + 1);
    }
    return days;
  });

  readonly timeSlots = computed<TimeSlot[]>(() => {
    const rows: TimeSlot[] = [];
    for (let minute = DAY_START_MINUTES; minute < DAY_END_MINUTES; minute += this.slotMinutes()) {
      rows.push({ minute, label: this.timeLabel(minute), input: this.localDateTime(minute) });
    }
    return rows;
  });

  readonly visibleStaff = computed(() => this.context()?.staff || []);
  readonly clients = computed(() => this.context()?.clients || []);
  readonly services = computed(() => this.context()?.services || []);
  readonly waitlist = computed(() => this.context()?.waitlist || []);
  readonly allStaffChoices = computed(() => this.visibleStaff());
  readonly filteredClients = computed(() => this.filterApiRecords(this.clients(), this.bookingClientSearch(), (client) => [
    client.name,
    client.phone,
    client.mobile,
    client.email,
    client.clientCode,
    client.id
  ]));
  readonly clientById = computed(() => new Map(this.clients().map((client) => [client.id, client])));
  readonly serviceById = computed(() => new Map(this.services().map((service) => [service.id, service])));
  readonly staffById = computed(() => new Map(this.visibleStaff().map((person) => [person.id, person])));

  readonly appointmentCardsByStaff = computed(() => {
    const map = new Map<string, AppointmentCard[]>();
    for (const appointment of this.context()?.appointments || []) {
      const staffId = appointment.staffId || '';
      const card = this.appointmentCard(appointment);
      if (!map.has(staffId)) map.set(staffId, []);
      map.get(staffId)?.push(card);
    }
    for (const cards of map.values()) cards.sort((a, b) => a.top - b.top);
    return map;
  });

  readonly shiftBlocksByStaff = computed(() => this.groupBlocks((this.context()?.schedules || []).map((row) => this.shiftBlock(row))));
  readonly blockedBlocksByStaff = computed(() => this.groupBlocks((this.context()?.blockedTimes || []).map((row) => this.blockedBlock(row))));

  readonly smartSlots = computed(() => {
    const slots: { staff: StaffLane; slot: TimeSlot; reason: string }[] = [];
    for (const staff of this.visibleStaff()) {
      for (const slot of this.timeSlots()) {
        if (slot.minute < 10 * 60) continue;
        const keyCount = this.cellCount(staff.id, slot.minute);
        const inBlocked = (this.blockedBlocksByStaff().get(staff.id) || []).some((block) => slot.minute >= this.topToMinute(block.top) && slot.minute < this.topToMinute(block.top + block.height));
        if (!keyCount && !inBlocked) {
          slots.push({ staff, slot, reason: 'Open slot with no visible conflict' });
          break;
        }
      }
      if (slots.length >= 5) break;
    }
    return slots;
  });

  ngOnInit(): void {
    this.load();
    this.timer = window.setInterval(() => this.now.set(new Date()), 60000);
    window.addEventListener('pointermove', this.onResizeMove);
    window.addEventListener('pointerup', this.onResizeEnd);
  }

  ngOnDestroy(): void {
    window.clearInterval(this.timer);
    window.removeEventListener('pointermove', this.onResizeMove);
    window.removeEventListener('pointerup', this.onResizeEnd);
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    try {
      const branchId = this.state.selectedBranchId();
      const context = await firstValueFrom(this.api.list<SchedulerContext>('enterprise-scheduler/context', {
        branchId,
        date: this.selectedDate(),
        from: this.selectedDate(),
        to: this.nextDate(this.selectedDate()),
        staffLimit: STAFF_LIMIT,
        staffOffset: this.staffOffset(),
        staffSearch: this.staffSearch(),
        status: this.statusFilter(),
        clientLimit: 120,
        serviceLimit: 300
      }));
      this.context.set(context);
    } catch (error) {
      this.error.set(this.api.errorText(error, 'Unable to load enterprise scheduler'));
    } finally {
      this.loading.set(false);
    }
  }

  selectDate(date: string): void {
    this.selectedDate.set(date);
    this.staffOffset.set(0);
    this.load();
  }

  shiftMonth(direction: number): void {
    const date = new Date(`${this.selectedDate()}T00:00:00`);
    date.setMonth(date.getMonth() + direction);
    this.selectDate(this.dateInput(date));
  }

  reloadFromStart(): void {
    this.staffOffset.set(0);
    this.load();
  }

  setSlotMinutes(value: string): void {
    this.slotMinutes.set(Number(value) === 30 ? 30 : 15);
  }

  moveStaffWindow(direction: number): void {
    const next = Math.max(0, this.staffOffset() + direction * STAFF_LIMIT);
    this.staffOffset.set(next);
    this.load();
  }

  canMoveNextStaff(): boolean {
    const window = this.context()?.staffWindow;
    return Boolean(window && window.showingTo < window.total);
  }

  staffWindowLabel(): string {
    const window = this.context()?.staffWindow;
    if (!window || !window.total) return 'No staff';
    return `Showing ${window.showingFrom}-${window.showingTo} of ${window.total}`;
  }

  openBlankBooking(): void {
    const staff = this.visibleStaff()[0];
    const slot = this.timeSlots()[0];
    if (staff && slot) this.openQuickBooking(staff, slot);
  }

  openQuickBooking(staff: StaffLane, slot: TimeSlot): void {
    this.selectedStaff.set(staff);
    this.selectedAppointment.set(null);
    this.editingAppointmentId.set('');
    this.bookingForm.reset({ clientId: '', status: 'booked', notes: '', notifyClient: true, notifyStaff: true, notifyOwner: false });
    this.bookingClientSearch.set('');
    this.serviceSearchByLine.set({});
    this.staffSearchByLine.set({});
    this.bookingLines.set([this.blankLine(staff.id, slot.input)]);
    this.drawer.set('booking');
  }

  openEditAppointment(appointment: ApiRecord): void {
    const staffId = String(appointment.staffId || this.visibleStaff()[0]?.id || '');
    const serviceIds = this.appointmentServiceIds(appointment);
    const startAt = this.localInputFromIso(appointment.startAt || appointment.createdAt || new Date().toISOString());
    this.selectedAppointment.set(appointment);
    this.editingAppointmentId.set(String(appointment.id || ''));
    this.bookingClientSearch.set(this.clientName(appointment.clientId));
    this.serviceSearchByLine.set({});
    this.staffSearchByLine.set({});
    this.bookingForm.reset({
      clientId: appointment.clientId || '',
      status: appointment.status || 'booked',
      notes: appointment.notes || '',
      notifyClient: true,
      notifyStaff: true,
      notifyOwner: false
    });
    const baseLine = this.blankLine(staffId, startAt);
    this.bookingLines.set([
      {
        ...baseLine,
        serviceId: serviceIds[0] || '',
        staffId,
        startAt,
        durationMinutes: this.appointmentDuration(appointment),
        chair: appointment.chair || '',
        room: appointment.room || ''
      }
    ]);
    this.drawer.set('booking');
  }

  addServiceLine(): void {
    const lines = this.bookingLines();
    const last = lines.at(-1);
    const nextStart = last ? this.addLocalMinutes(last.startAt, Number(last.durationMinutes || 30)) : this.localDateTime(10 * 60);
    this.bookingLines.set([...lines, this.blankLine(last?.staffId || this.visibleStaff()[0]?.id || '', nextStart)]);
  }

  removeServiceLine(idValue: string): void {
    this.bookingLines.set(this.bookingLines().filter((line) => line.id !== idValue));
    this.dropLineSearch(idValue);
  }

  updateLine(idValue: string, key: keyof BookingLineDraft, value: string): void {
    this.bookingLines.set(this.bookingLines().map((line) => {
      if (line.id !== idValue) return line;
      const next = { ...line, [key]: key === 'durationMinutes' ? Number(value || 30) : value };
      if (key === 'serviceId') {
        next.durationMinutes = Number(this.serviceById().get(value)?.durationMinutes || next.durationMinutes || 30);
      }
      return next;
    }));
  }

  filteredServices(line: BookingLineDraft): ApiRecord[] {
    return this.includeSelected(
      this.filterApiRecords(this.services(), this.lineSearch(this.serviceSearchByLine(), line.id), (service) => [
        service.name,
        service.category,
        service.serviceCode,
        service.price,
        service.durationMinutes,
        service.id
      ]),
      this.services(),
      line.serviceId
    );
  }

  filteredStaff(line: BookingLineDraft): StaffLane[] {
    return this.includeSelected(
      this.filterStaff(this.allStaffChoices(), this.lineSearch(this.staffSearchByLine(), line.id)),
      this.allStaffChoices(),
      line.staffId
    );
  }

  lineSearch(source: Record<string, string>, lineId: string): string {
    return source[lineId] || '';
  }

  setLineSearch(kind: 'service' | 'staff', lineId: string, value: string): void {
    const target = kind === 'service' ? this.serviceSearchByLine : this.staffSearchByLine;
    target.update((current) => ({ ...current, [lineId]: value }));
  }

  private dropLineSearch(lineId: string): void {
    this.serviceSearchByLine.update((current) => {
      const next = { ...current };
      delete next[lineId];
      return next;
    });
    this.staffSearchByLine.update((current) => {
      const next = { ...current };
      delete next[lineId];
      return next;
    });
  }

  private filterApiRecords(records: ApiRecord[], query: string, fields: (record: ApiRecord) => unknown[]): ApiRecord[] {
    const needle = this.normalizeSearch(query);
    if (!needle) return records;
    return records.filter((record) => fields(record).some((field) => this.normalizeSearch(field).includes(needle)));
  }

  private filterStaff(records: StaffLane[], query: string): StaffLane[] {
    const needle = this.normalizeSearch(query);
    if (!needle) return records;
    return records.filter((person) => [person.name, person.shortName, person.role, person.status, person.phone, person.id]
      .some((field) => this.normalizeSearch(field).includes(needle)));
  }

  private includeSelected<T extends { id?: string }>(filtered: T[], all: T[], selectedId: string): T[] {
    if (!selectedId || filtered.some((item) => item.id === selectedId)) return filtered;
    const selected = all.find((item) => item.id === selectedId);
    return selected ? [selected, ...filtered] : filtered;
  }

  private normalizeSearch(value: unknown): string {
    return String(value || '').toLowerCase().trim();
  }

  async createBooking(): Promise<void> {
    if (this.bookingForm.invalid) return;
    const lines = this.bookingLines();
    if (lines.some((line) => !line.serviceId || !line.staffId || !line.startAt)) {
      this.error.set('Every service line needs service, staff and start time.');
      return;
    }
    const notifyTargets = [
      this.bookingForm.value.notifyClient ? 'client' : '',
      this.bookingForm.value.notifyStaff ? 'staff' : '',
      this.bookingForm.value.notifyOwner ? 'owner' : ''
    ].filter(Boolean);
    this.saving.set(true);
    try {
      const payload = {
        branchId: this.context()?.branchId || this.state.selectedBranchId(),
        clientId: this.bookingForm.value.clientId,
        status: this.bookingForm.value.status || 'booked',
        notes: this.bookingForm.value.notes || '',
        notifyTargets,
        lines: lines.map((line) => ({
          serviceId: line.serviceId,
          staffId: line.staffId,
          startAt: this.isoFromLocal(line.startAt),
          durationMinutes: Number(line.durationMinutes || 30),
          chair: line.chair,
          room: line.room
        }))
      };
      if (this.editingAppointmentId()) {
        const line = lines[0];
        await firstValueFrom(this.api.update<ApiRecord>('appointments', this.editingAppointmentId(), {
          branchId: payload.branchId,
          clientId: payload.clientId,
          status: payload.status,
          notes: payload.notes,
          serviceIds: [line.serviceId],
          staffId: line.staffId,
          startAt: this.isoFromLocal(line.startAt),
          endAt: this.isoFromLocal(this.addLocalMinutes(line.startAt, Number(line.durationMinutes || 30))),
          durationMinutes: Number(line.durationMinutes || 30),
          chair: line.chair,
          room: line.room
        }));
        this.notice.set('Appointment updated');
      } else {
        const result = await firstValueFrom(this.api.post<ApiRecord>('enterprise-scheduler/multi-service-bookings', payload));
        this.notice.set(`${result.appointments?.length || lines.length} appointment service line(s) created`);
      }
      this.closeDrawer();
      await this.load();
    } catch (error) {
      this.error.set(this.api.errorText(error, 'Unable to create booking'));
    } finally {
      this.saving.set(false);
    }
  }

  openAddBlockedTime(staff: StaffLane, slot: TimeSlot, event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.selectedStaff.set(staff);
    this.blockMode.set('add');
    this.blockForm.reset({
      date: this.selectedDate(),
      staffId: staff.id,
      startTime: this.hhmm(slot.minute),
      endTime: this.hhmm(slot.minute + this.slotMinutes()),
      reason: 'Blocked time'
    });
    this.drawer.set('blocked-time');
  }

  openRemoveBlockedTime(staff: StaffLane, event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.selectedStaff.set(staff);
    this.blockMode.set('remove');
    this.drawer.set('blocked-time');
  }

  openSchedulerActionMenu(person: StaffLane, event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    const lane = (event.currentTarget as HTMLElement).closest('.staff-lane') as HTMLElement | null;
    const rect = lane?.getBoundingClientRect();
    const rawY = rect ? event.clientY - rect.top : 0;
    const minute = rawY > 0
      ? this.snapMinute(DAY_START_MINUTES + (rawY / ROW_HEIGHT) * this.slotMinutes())
      : DAY_START_MINUTES;
    this.schedulerActionMenu.set({
      staffId: person.id,
      minute,
      top: rawY > 0 ? Math.max(10, this.minuteTop(minute) - 4) : 10
    });
  }

  closeSchedulerActionMenu(): void {
    this.schedulerActionMenu.set(null);
  }

  openAddBlockedTimeFromMenu(staff: StaffLane, minute: number): void {
    this.closeSchedulerActionMenu();
    this.openAddBlockedTime(staff, { minute, label: this.timeLabel(minute), input: this.localDateTime(minute) }, new Event('click'));
  }

  openRemoveBlockedTimeFromMenu(staff: StaffLane, minute: number): void {
    this.closeSchedulerActionMenu();
    this.selectedStaff.set(staff);
    this.blockMode.set('remove');
    this.blockForm.patchValue({
      date: this.selectedDate(),
      staffId: staff.id,
      startTime: this.hhmm(this.snapMinute(minute))
    });
    this.drawer.set('blocked-time');
  }

  async saveBlockedTime(): Promise<void> {
    if (this.blockForm.invalid) return;
    this.saving.set(true);
    try {
      await firstValueFrom(this.api.post('enterprise-scheduler/blocked-times', {
        branchId: this.context()?.branchId || this.state.selectedBranchId(),
        ...this.blockForm.value
      }));
      this.notice.set('Blocked time saved');
      this.closeDrawer();
      await this.load();
    } catch (error) {
      this.error.set(this.api.errorText(error, 'Unable to save blocked time'));
    } finally {
      this.saving.set(false);
    }
  }

  removableBlocks(): ApiRecord[] {
    const staffId = this.selectedStaff()?.id || '';
    return (this.context()?.blockedTimes || []).filter((block) => block.staffId === staffId);
  }

  async removeBlockedTime(idValue: string): Promise<void> {
    this.saving.set(true);
    try {
      await firstValueFrom(this.api.delete(`enterprise-scheduler/blocked-times`, idValue));
      this.notice.set('Blocked time removed');
      await this.load();
    } catch (error) {
      this.error.set(this.api.errorText(error, 'Unable to remove blocked time'));
    } finally {
      this.saving.set(false);
    }
  }

  openAppointment(appointment: ApiRecord): void {
    this.selectedAppointment.set(appointment);
    this.appointmentDetailTab.set('booking');
    this.drawer.set('appointment');
  }

  async setStatus(appointment: ApiRecord, status: string): Promise<void> {
    try {
      await firstValueFrom(this.api.post(`appointments/${appointment.id}/status`, { status }));
      this.notice.set(`Appointment marked ${this.label(status)}`);
      if (status === 'completed') {
        this.goToPos(appointment);
        return;
      }
      await this.load();
    } catch (error) {
      this.error.set(this.api.errorText(error, 'Unable to update appointment status'));
    }
  }

  async queueSms(appointment: ApiRecord, target: 'client' | 'staff' | 'owner'): Promise<void> {
    try {
      await firstValueFrom(this.api.post(`appointment-sms/appointments/${appointment.id}/queue`, { target }));
      this.notice.set(`SMS queued for ${target}`);
    } catch (error) {
      this.error.set(this.api.errorText(error, 'Unable to queue SMS'));
    }
  }

  async convertToPos(appointment: ApiRecord): Promise<void> {
    this.goToPos(appointment);
  }

  printAppointmentBill(): void {
    window.print();
  }

  openClientHistory(appointment: ApiRecord): void {
    const client = this.clientById().get(appointment.clientId);
    this.router.navigate(['/clients'], {
      queryParams: {
        clientId: appointment.clientId || undefined,
        q: client?.phone || client?.mobile || client?.name || this.clientName(appointment.clientId)
      }
    });
  }

  async handleAppointmentAction(appointment: ApiRecord, action: string): Promise<void> {
    if (!action) return;
    if (action === 'edit' || action === 'reschedule') {
      this.openEditAppointment(appointment);
      return;
    }
    if (action === 'add-payment' || action === 'add-tip') {
      this.goToPos(appointment);
      return;
    }
    await this.setStatus(appointment, action);
  }

  beginDrag(appointment: ApiRecord): void {
    this.draggingAppointment.set(appointment);
  }

  clearDrag(): void {
    this.draggingAppointment.set(null);
  }

  async dropAppointment(staff: StaffLane, event: DragEvent): Promise<void> {
    event.preventDefault();
    const appointment = this.draggingAppointment();
    if (!appointment || !event.currentTarget) return;
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const minute = this.snapMinute(DAY_START_MINUTES + ((event.clientY - rect.top) / ROW_HEIGHT) * this.slotMinutes());
    const duration = Math.max(15, this.appointmentDuration(appointment));
    await this.moveAppointment(appointment, staff.id, this.isoAtMinute(minute), this.isoAtMinute(minute + duration), 'Drag-drop scheduler move');
    this.clearDrag();
  }

  beginResize(appointment: ApiRecord, event: PointerEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.resizeState.set({ appointment, startY: event.clientY, originalEnd: appointment.endAt || this.isoAtMinute(this.minuteOf(appointment.startAt) + 30) });
  }

  private readonly onResizeMove = (event: PointerEvent): void => {
    const state = this.resizeState();
    if (!state) return;
    event.preventDefault();
  };

  private readonly onResizeEnd = async (event: PointerEvent): Promise<void> => {
    const state = this.resizeState();
    if (!state) return;
    const deltaRows = Math.round((event.clientY - state.startY) / ROW_HEIGHT);
    const deltaMinutes = deltaRows * this.slotMinutes();
    const startMinute = this.minuteOf(state.appointment.startAt);
    const originalEndMinute = this.minuteOf(state.originalEnd);
    const nextEndMinute = Math.max(startMinute + this.slotMinutes(), this.snapMinute(originalEndMinute + deltaMinutes));
    this.resizeState.set(null);
    await this.moveAppointment(state.appointment, state.appointment.staffId || '', state.appointment.startAt, this.isoAtMinute(nextEndMinute), 'Resize appointment duration');
  };

  private async moveAppointment(appointment: ApiRecord, staffId: string, startAt: string, endAt: string, reason: string): Promise<void> {
    try {
      await firstValueFrom(this.api.patch(`enterprise-scheduler/appointments/${appointment.id}/move`, { staffId, startAt, endAt, reason }));
      this.notice.set('Appointment updated');
      await this.load();
    } catch (error) {
      this.error.set(this.api.errorText(error, 'Unable to move appointment'));
    }
  }

  closeDrawer(): void {
    this.drawer.set('');
    this.selectedAppointment.set(null);
    this.editingAppointmentId.set('');
    this.appointmentDetailTab.set('booking');
    this.closeSchedulerActionMenu();
  }

  summaryValue(key: string): number {
    return Number(this.context()?.summary?.[key] || 0);
  }

  cellCount(staffId: string, minute: number): number {
    return (this.appointmentCardsByStaff().get(staffId) || []).filter((card) => {
      const start = this.topToMinute(card.top);
      const end = this.topToMinute(card.top + card.height);
      return minute >= start && minute < end;
    }).length;
  }

  blockedCountForStaff(staffId: string): number {
    return (this.context()?.blockedTimes || []).filter((block) => block.staffId === staffId).length;
  }

  hoverSummary(): string {
    const hover = this.hoverSlot();
    if (!hover) return '0 - 0 - 0';
    return `${this.context()?.appointmentTotal || 0} - ${this.summaryValue('conflicts')} - ${this.summaryValue('waitlist')}`;
  }

  currentTimeTop(): number {
    if (this.selectedDate() !== new Date().toISOString().slice(0, 10)) return -1;
    const date = this.now();
    const minute = date.getHours() * 60 + date.getMinutes();
    if (minute < DAY_START_MINUTES || minute > DAY_END_MINUTES) return -1;
    return this.minuteTop(minute) + 76;
  }

  currentTimeBodyTop(): number {
    if (this.selectedDate() !== new Date().toISOString().slice(0, 10)) return -1;
    const date = this.now();
    const minute = date.getHours() * 60 + date.getMinutes();
    if (minute < DAY_START_MINUTES || minute > DAY_END_MINUTES) return -1;
    return this.minuteTop(minute);
  }

  currentTimeLabel(): string {
    return this.now().toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
  }

  minuteTop(minute: number): number {
    return ((minute - DAY_START_MINUTES) / this.slotMinutes()) * ROW_HEIGHT;
  }

  topToMinute(top: number): number {
    return DAY_START_MINUTES + Math.round(top / ROW_HEIGHT) * this.slotMinutes();
  }

  appointmentCard(appointment: ApiRecord): AppointmentCard {
    const top = this.minuteTop(this.minuteOf(appointment.startAt));
    const height = Math.max(36, (this.appointmentDuration(appointment) / this.slotMinutes()) * ROW_HEIGHT - 4);
    const status = String(appointment.status || 'booked').toLowerCase();
    return {
      appointment,
      top,
      height,
      status,
      clientName: this.clientName(appointment.clientId),
      serviceLabel: this.serviceNames(appointment.serviceIds),
      timeLabel: `${this.shortTime(appointment.startAt)} - ${this.shortTime(appointment.endAt || this.isoAtMinute(this.minuteOf(appointment.startAt) + 30))}`
    };
  }

  shiftBlock(row: ApiRecord): LaneBlock {
    const date = row.scheduleDate || this.selectedDate();
    const start = this.minuteFromTime(row.startTime || '10:00');
    const end = this.minuteFromTime(row.endTime || '18:00');
    return {
      id: row.id,
      staffId: row.staffId,
      top: this.minuteTop(start),
      height: Math.max(ROW_HEIGHT, ((end - start) / this.slotMinutes()) * ROW_HEIGHT),
      label: `${row.startTime || ''} TO ${row.endTime || ''}`,
      kind: 'shift',
      reason: `${date} ${row.shiftType || 'regular'}`
    };
  }

  blockedBlock(row: ApiRecord): LaneBlock {
    const start = this.minuteOf(row.startAt);
    const end = this.minuteOf(row.endAt);
    return {
      id: row.id,
      staffId: row.staffId,
      top: this.minuteTop(start),
      height: Math.max(ROW_HEIGHT, ((end - start) / this.slotMinutes()) * ROW_HEIGHT),
      label: row.reason || 'Blocked',
      kind: 'blocked',
      reason: row.reason || 'Blocked'
    };
  }

  groupBlocks(blocks: LaneBlock[]): Map<string, LaneBlock[]> {
    const map = new Map<string, LaneBlock[]>();
    for (const block of blocks) {
      if (!map.has(block.staffId)) map.set(block.staffId, []);
      map.get(block.staffId)?.push(block);
    }
    return map;
  }

  serviceNames(value: unknown): string {
    const ids = Array.isArray(value) ? value : this.parseJsonArray(value);
    return ids.map((id) => this.serviceById().get(id)?.name || id).filter(Boolean).join(', ') || 'Service';
  }

  clientPhone(idValue: string): string {
    const client = this.clientById().get(idValue);
    return String(client?.phone || client?.mobile || client?.whatsapp || '');
  }

  clientWalletBalance(idValue: string): number {
    const client = this.clientById().get(idValue);
    return this.numberValue(client?.walletBalance, client?.wallet_balance, client?.ewalletBalance, client?.wallet, 0);
  }

  appointmentPaymentMode(appointment: ApiRecord): string {
    return String(appointment.paymentMode || appointment.payment_mode || appointment.paymentType || appointment.mode || 'Not selected');
  }

  appointmentBillLines(appointment: ApiRecord): AppointmentBillLine[] {
    const serviceIds = this.appointmentServiceIds(appointment);
    const fallbackName = this.serviceNames(serviceIds);
    const discountTotal = this.appointmentDiscount(appointment);
    const subtotal = Math.max(1, serviceIds.reduce((sum, id) => sum + this.serviceBasePrice(id, appointment), 0));
    const ids = serviceIds.length ? serviceIds : [''];

    return ids.map((id, index) => {
      const service = this.serviceById().get(id);
      const price = this.serviceBasePrice(id, appointment);
      const discount = Math.max(0, Math.min(price, index === ids.length - 1
        ? discountTotal - ids.slice(0, -1).reduce((sum, previousId) => sum + Math.round((this.serviceBasePrice(previousId, appointment) / subtotal) * discountTotal), 0)
        : Math.round((price / subtotal) * discountTotal)));
      const taxable = Math.max(0, price - discount);
      const gstRate = this.numberValue(service?.gstRate, service?.gst, service?.taxRate, appointment.gstRate, appointment.gst, 0);
      const gstAmount = Math.round(taxable * gstRate / 100);
      return {
        id: id || `${appointment.id || 'appointment'}-${index}`,
        name: service?.name || fallbackName || 'Service',
        staffName: this.staffName(appointment.staffId || service?.staffId || ''),
        quantity: 1,
        price,
        discount,
        taxable,
        gstRate,
        gstAmount,
        total: taxable + gstAmount
      };
    });
  }

  appointmentSubtotal(appointment: ApiRecord): number {
    return this.appointmentBillLines(appointment).reduce((sum, line) => sum + line.price, 0);
  }

  appointmentDiscount(appointment: ApiRecord): number {
    return Math.max(0, this.numberValue(appointment.discountAmount, appointment.discount_amount, appointment.discount, appointment.manualDiscount, 0));
  }

  appointmentTaxable(appointment: ApiRecord): number {
    return this.appointmentBillLines(appointment).reduce((sum, line) => sum + line.taxable, 0);
  }

  appointmentGst(appointment: ApiRecord): number {
    return this.appointmentBillLines(appointment).reduce((sum, line) => sum + line.gstAmount, 0);
  }

  appointmentTotal(appointment: ApiRecord): number {
    const explicitTotal = this.numberValue(appointment.total, appointment.totalAmount, appointment.amount, 0);
    return explicitTotal || this.appointmentBillLines(appointment).reduce((sum, line) => sum + line.total, 0);
  }

  appointmentPaid(appointment: ApiRecord): number {
    return this.numberValue(appointment.paid, appointment.paidAmount, appointment.paid_amount, appointment.collectedAmount, 0);
  }

  appointmentDue(appointment: ApiRecord): number {
    return Math.max(0, this.appointmentTotal(appointment) - this.appointmentPaid(appointment));
  }

  appointmentActivityLines(appointment: ApiRecord): AppointmentActivityLine[] {
    const raw = Array.isArray(appointment.activityLog) ? appointment.activityLog : Array.isArray(appointment.history) ? appointment.history : [];
    const mapped = raw.map((event: ApiRecord, index: number) => ({
      id: String(event.id || `${appointment.id}-activity-${index}`),
      title: String(event.title || event.action || 'Activity'),
      time: String(event.time || event.createdAt || event.created_at || appointment.updatedAt || appointment.startAt || new Date().toISOString()),
      body: String(event.body || event.notes || event.description || `Status ${this.label(appointment.status || 'booked')}`)
    }));
    if (mapped.length) return mapped;
    return [
      {
        id: `${appointment.id}-created`,
        title: 'Booking created',
        time: String(appointment.createdAt || appointment.startAt || new Date().toISOString()),
        body: `${this.clientName(appointment.clientId)} booked ${this.serviceNames(this.appointmentServiceIds(appointment))}.`
      },
      {
        id: `${appointment.id}-status`,
        title: 'Current status',
        time: String(appointment.updatedAt || appointment.startAt || new Date().toISOString()),
        body: `Appointment is ${this.label(appointment.status || 'booked')}.`
      }
    ];
  }

  clientName(idValue: string): string {
    return this.clientById().get(idValue)?.name || idValue || 'Client';
  }

  staffName(idValue: string): string {
    return this.staffById().get(idValue)?.name || idValue || 'Staff';
  }

  label(value: string): string {
    return String(value || '').replace(/[-_]/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
  }

  statusClass(status: string): string {
    return `appointment-card ${STATUS_TONES[status] || 'blue'}`;
  }

  money(value: number): string {
    return `₹${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
  }

  initials(value: string): string {
    return String(value || '').split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase() || 'ST';
  }

  trackDate(_: number, day: CalendarDay): string { return day.date; }
  trackStaff(_: number, staff: StaffLane): string { return staff.id; }
  trackSlot(_: number, slot: TimeSlot): number { return slot.minute; }
  trackValue(_: number, value: string): string { return value; }
  trackApiRecord(_: number, record: ApiRecord): string { return record.id; }
  trackLine(_: number, line: BookingLineDraft): string { return line.id; }
  trackBlock(_: number, block: LaneBlock): string { return block.id; }
  trackCard(_: number, card: AppointmentCard): string { return card.appointment.id; }
  trackSmartSlot(_: number, slot: { staff: StaffLane; slot: TimeSlot }): string { return `${slot.staff.id}-${slot.slot.minute}`; }
  trackBillLine(_: number, line: AppointmentBillLine): string { return line.id; }
  trackActivityLine(_: number, line: AppointmentActivityLine): string { return line.id; }

  private blankLine(staffId: string, startAt: string): BookingLineDraft {
    return { id: `line_${Math.random().toString(16).slice(2)}`, serviceId: '', staffId, startAt, durationMinutes: 30, chair: 'Chair 1', room: '' };
  }

  private dateInput(date: Date): string {
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    return `${date.getFullYear()}-${month}-${day}`;
  }

  private nextDate(date: string): string {
    const next = new Date(`${date}T00:00:00`);
    next.setDate(next.getDate() + 1);
    return this.dateInput(next);
  }

  private hhmm(minute: number): string {
    return `${Math.floor(minute / 60)}`.padStart(2, '0') + ':' + `${minute % 60}`.padStart(2, '0');
  }

  private timeLabel(minute: number): string {
    const date = new Date(`${this.selectedDate()}T${this.hhmm(minute)}:00`);
    return date.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
  }

  private localDateTime(minute: number): string {
    return `${this.selectedDate()}T${this.hhmm(minute)}`;
  }

  private addLocalMinutes(value: string, minutes: number): string {
    const date = new Date(value);
    date.setMinutes(date.getMinutes() + minutes);
    return `${this.dateInput(date)}T${this.hhmm(date.getHours() * 60 + date.getMinutes())}`;
  }

  private localInputFromIso(value: string): string {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return this.localDateTime(10 * 60);
    return `${this.dateInput(date)}T${this.hhmm(date.getHours() * 60 + date.getMinutes())}`;
  }

  private isoFromLocal(value: string): string {
    return new Date(value).toISOString();
  }

  private isoAtMinute(minute: number): string {
    return this.isoFromLocal(this.localDateTime(minute));
  }

  private minuteOf(value: string): number {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return DAY_START_MINUTES;
    return date.getHours() * 60 + date.getMinutes();
  }

  private minuteFromTime(value: string): number {
    const [hour, minute] = String(value || '').split(':').map(Number);
    if (!Number.isFinite(hour) || !Number.isFinite(minute)) return DAY_START_MINUTES;
    return hour * 60 + minute;
  }

  private snapMinute(minute: number): number {
    const snapped = Math.round(minute / this.slotMinutes()) * this.slotMinutes();
    return Math.min(DAY_END_MINUTES - this.slotMinutes(), Math.max(DAY_START_MINUTES, snapped));
  }

  private appointmentDuration(appointment: ApiRecord): number {
    const start = new Date(appointment.startAt).getTime();
    const end = new Date(appointment.endAt || '').getTime();
    return Number.isFinite(start) && Number.isFinite(end) && end > start ? Math.round((end - start) / 60000) : 30;
  }

  private shortTime(value: string): string {
    return new Date(value).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
  }

  private numberValue(...values: unknown[]): number {
    for (const value of values) {
      if (value === null || value === undefined || value === '') continue;
      const next = Number(String(value).replace(/[₹,\s]/g, ''));
      if (Number.isFinite(next)) return next;
    }
    return 0;
  }

  private appointmentServiceIds(appointment: ApiRecord): string[] {
    return this.idList(
      appointment.serviceIds ??
      appointment.service_ids ??
      appointment.serviceId ??
      appointment.service_id ??
      ''
    );
  }

  private serviceBasePrice(serviceId: string, appointment: ApiRecord): number {
    const service = this.serviceById().get(serviceId);
    const servicePrice = this.numberValue(service?.price, service?.sellingPrice, service?.rate, service?.amount, service?.defaultPrice, 0);
    if (servicePrice) return servicePrice;
    const serviceCount = Math.max(1, this.appointmentServiceIds(appointment).length);
    const appointmentPrice = this.numberValue(appointment.rate, appointment.price, appointment.subtotal, appointment.subTotal, appointment.totalAmount, appointment.total, appointment.amount, 0);
    return serviceCount > 1 ? Math.round(appointmentPrice / serviceCount) : appointmentPrice;
  }

  private parseJsonArray(value: unknown): string[] {
    if (Array.isArray(value)) return value.map(String);
    if (typeof value !== 'string' || !value.trim()) return [];
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      return value.split(',').map((item) => item.trim()).filter(Boolean);
    }
  }

  private idList(value: unknown): string[] {
    return this.parseJsonArray(value).filter(Boolean);
  }

  private goToPos(appointment: ApiRecord): void {
    this.router.navigate(['/pos'], {
      queryParams: {
        appointmentId: appointment.id || undefined,
        clientId: appointment.clientId || undefined,
        q: this.clientById().get(appointment.clientId)?.phone || this.clientName(appointment.clientId) || undefined
      }
    });
  }
}
