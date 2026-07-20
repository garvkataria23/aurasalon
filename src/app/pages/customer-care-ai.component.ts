import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiRecord, ApiService } from '../core/api.service';
import { StateComponent } from '../shared/ui/state/state.component';

type CareShortcut = { label: string; route: string };
type CareCitation = { source: string; route: string; note: string };
type CareCallSlot = { id: string; label: string; date: string; start: string; end: string; window: string; mode: string };
type CareMessage = {
  role: 'customer' | 'assistant';
  text: string;
  at: string;
  relatedModules?: string[];
  nextSteps?: string[];
  escalation?: string;
  provider?: string;
  shortcuts?: CareShortcut[];
  citations?: CareCitation[];
  ticketDraft?: ApiRecord;
};

type CareContext = {
  provider: string;
  model: string;
  configured: boolean;
  knowledge: Array<{ area: string; details: string[]; route?: string }>;
  moduleShortcuts: CareShortcut[];
  quickActions: string[];
  capabilities: string[];
  guardrails: string[];
};

@Component({
  selector: 'app-customer-care-ai',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, StateComponent],
  template: `
    <section class="care-shell">
      <header class="care-hero">
        <div>
          <span class="eyebrow">Aura Shine support brain</span>
          <h1>Customer Care AI</h1>
          <p>Live customer lookup, AI answers, module shortcuts, citations, ticket creation, escalation, voice input and saved conversation history.</p>
        </div>
        <div class="hero-status">
          <span>{{ context()?.configured ? 'OpenAI connected' : 'Local support mode' }}</span>
          <strong>{{ context()?.model || 'checking model' }}</strong>
          <small>{{ context()?.provider || 'provider pending' }}</small>
        </div>
      </header>

      <app-state [loading]="loading()" [error]="error()"></app-state>

      <div class="care-grid" *ngIf="!loading()" [class.booking-mode]="bookingMessage() || escalationMessage()">
        <aside class="care-panel context-panel">
          <div class="panel-head">
            <h2>Software Knowledge</h2>
            <button type="button" (click)="load()">Refresh</button>
          </div>
          <div class="knowledge-list">
            <a class="knowledge-card" *ngFor="let item of context()?.knowledge || []" [routerLink]="item.route || '/customer-care-ai'">
              <strong>{{ item.area }}</strong>
              <p>{{ item.details[0] }}</p>
            </a>
          </div>
          <div class="guardrail-box">
            <strong>Escalation guardrails</strong>
            <span *ngFor="let guardrail of context()?.guardrails || []">{{ guardrail }}</span>
          </div>
        </aside>

        <main class="care-panel chat-panel">
          <div class="panel-head">
            <div>
              <h2>Live Customer Chat</h2>
              <span>{{ messages().length }} messages - {{ selectedTopic() }} <ng-container *ngIf="sessionId()">- saved</ng-container></span>
            </div>
            <select [ngModel]="selectedTopic()" (ngModelChange)="selectedTopic.set($event)" aria-label="Support topic">
              <option *ngFor="let topic of topics" [value]="topic">{{ topic }}</option>
            </select>
          </div>

          <div class="quick-row" *ngIf="!bookingMessage() && !escalationMessage()" aria-label="Quick questions">
            <button type="button" *ngFor="let question of topicQuickActions()" (click)="askQuick(question)">{{ question }}</button>
          </div>

          <section class="ticket-booking-page escalation-page" *ngIf="escalationMessage() as escalation; else ticketOrChatBody">
            <div class="booking-head">
              <div>
                <span class="eyebrow">Manager handoff</span>
                <h2>Escalate this support case</h2>
                <p>Use escalation when manager approval, protected data, payment/refund review, security review or urgent human decision is required.</p>
              </div>
              <button type="button" (click)="closeEscalation()">Back to chat</button>
            </div>

            <div class="booking-grid">
              <section class="booking-card">
                <strong>Customer and case</strong>
                <label><span>Name</span><input [(ngModel)]="customerName" name="escalationCustomerName" placeholder="Customer name" /></label>
                <label><span>Phone / booking reference</span><input [(ngModel)]="customerPhone" name="escalationCustomerPhone" placeholder="Phone or booking ref" /></label>
                <label><span>Case summary</span><textarea [(ngModel)]="escalationSummary" name="escalationSummary" rows="4" placeholder="Summarise what happened and what the manager must decide"></textarea></label>
              </section>

              <section class="booking-card">
                <strong>Escalation details</strong>
                <div class="auto-stage-panel">
                  <span>Escalation stage</span>
                  <strong>In process</strong>
                  <small>Manager queue receives this as high-priority handoff.</small>
                </div>
                <label><span>Urgency</span><select [(ngModel)]="escalationUrgency" name="escalationUrgency"><option *ngFor="let urgency of escalationUrgencies" [value]="urgency.value">{{ urgency.label }}</option></select></label>
                <label><span>Reason</span><select [(ngModel)]="escalationReason" name="escalationReason"><option *ngFor="let reason of escalationReasons" [value]="reason">{{ reason }}</option></select></label>
                <label><span>Manager instruction</span><textarea [(ngModel)]="managerInstruction" name="managerInstruction" rows="3" placeholder="What should manager check or approve?"></textarea></label>
              </section>
            </div>

            <section class="booking-card history-card">
              <div class="booking-section-title"><strong>Related support history</strong><small>{{ userSupportHistory().length }} record(s)</small></div>
              <article *ngFor="let ticket of userSupportHistory().slice(0, 4)">
                <div><strong>{{ ticket.title || ticket.topic || 'Support ticket' }}</strong><small>{{ ticket.createdAt || ticket.updatedAt }}</small></div>
                <span>{{ ticketStage(ticket) }}</span>
                <p>{{ ticket.summary || ticket.escalationReason || 'No summary available.' }}</p>
              </article>
              <small *ngIf="!userSupportHistory().length">No previous support history found for this customer.</small>
            </section>

            <div class="booking-actions">
              <button type="button" (click)="closeEscalation()">Cancel</button>
              <button class="primary-booking-button" type="button" (click)="submitEscalation(escalation)">Escalate to manager</button>
            </div>
          </section>

          <ng-template #ticketOrChatBody>
          <section class="ticket-booking-page" *ngIf="bookingMessage() as booking; else liveChatBody">
            <div class="booking-head">
              <div>
                <span class="eyebrow">Support call booking</span>
                <h2>Create ticket and reserve a one-hour screen-share slot</h2>
                <p>Customers can book one support call in a 7-day period. Slots are available from 12 PM to 7 PM for the next two weeks.</p>
              </div>
              <button type="button" (click)="closeTicketBooking()">Back to chat</button>
            </div>

            <div class="booking-grid">
              <section class="booking-card">
                <strong>Customer details</strong>
                <label><span>Name</span><input [(ngModel)]="customerName" name="bookingCustomerName" placeholder="Customer name" /></label>
                <label><span>Phone / booking reference</span><input [(ngModel)]="customerPhone" name="bookingCustomerPhone" placeholder="Phone or booking ref" /></label>
                <button type="button" (click)="lookupCustomer()">Lookup customer history</button>
              </section>

              <section class="booking-card">
                <strong>Issue details</strong>
                <div class="auto-stage-panel">
                  <span>Current stage</span>
                  <strong>{{ supportStage }}</strong>
                  <small>Stage is managed automatically by the support workflow.</small>
                </div>
                <div class="stage-flow" aria-label="Ticket lifecycle">
                  <span *ngFor="let stage of supportStages" [class.active]="stage === supportStage">{{ stage }}</span>
                </div>
                <label><span>Issue summary</span><input [(ngModel)]="issueTitle" name="issueTitle" placeholder="Short issue title" /></label>
                <label><span>Problem notes</span><textarea [(ngModel)]="issueDetails" name="issueDetails" rows="4" placeholder="What is happening, where the customer is stuck, and what needs to be checked on call"></textarea></label>
              </section>
            </div>

            <section class="booking-card slot-booking-card">
              <div class="booking-section-title">
                <div><strong>Choose date and time</strong><small>One-hour slots only. Already reserved slots are blocked.</small></div>
                <span *ngIf="weeklyBookingBlock()">Already booked this week</span>
              </div>
              <div class="date-strip">
                <button type="button" *ngFor="let date of supportDates()" [class.active]="selectedCallDate() === date.value" (click)="selectCallDate(date.value)">
                  <b>{{ date.day }}</b><small>{{ date.label }}</small>
                </button>
              </div>
              <p class="booking-empty" *ngIf="!supportDates().length">No support dates are available right now.</p>
              <div class="slot-grid">
                <button type="button" *ngFor="let slot of supportSlotsForSelectedDate()" [class.active]="selectedCallSlot() === slot.id" [class.booked]="isSlotBooked(slot)" [disabled]="isSlotBooked(slot) || weeklyBookingBlock()" (click)="selectCallSlot(slot)">
                  <strong>{{ slot.window }}</strong>
                  <small>{{ isSlotBooked(slot) ? 'Booked' : 'Available' }}</small>
                </button>
              </div>
              <p class="booking-empty" *ngIf="!supportSlotsForSelectedDate().length">No time slots are available for this date.</p>
              <p class="booking-warning" *ngIf="weeklyBookingBlock()">{{ weeklyBookingMessage() }}</p>
              <p class="booking-warning" *ngIf="!weeklyBookingBlock() && !selectedCallSlot()">Please choose an available one-hour slot.</p>
            </section>

            <section class="booking-card history-card">
              <div class="booking-section-title"><strong>Previous support history</strong><small>{{ userSupportHistory().length }} record(s)</small></div>
              <article *ngFor="let ticket of userSupportHistory().slice(0, 6)">
                <div><strong>{{ ticket.title || ticket.topic || 'Support ticket' }}</strong><small>{{ ticket.createdAt || ticket.updatedAt }}</small></div>
                <span>{{ ticketStage(ticket) }}</span>
                <p>{{ ticket.summary || ticket.escalationReason || 'No summary available.' }}</p>
              </article>
              <small *ngIf="!userSupportHistory().length">No previous ticket or call booking found for this customer.</small>
            </section>

            <div class="booking-actions">
              <button type="button" (click)="closeTicketBooking()">Cancel</button>
              <button class="primary-booking-button" type="button" [disabled]="weeklyBookingBlock() || !selectedCallSlot()" (click)="createTicket(booking)">Confirm ticket and call slot</button>
            </div>
          </section>

          <ng-template #liveChatBody>
            <section class="message-list" aria-live="polite">
              <article class="message" *ngFor="let message of messages()" [class.customer]="message.role === 'customer'">
                <div class="avatar">{{ message.role === 'customer' ? 'C' : 'AI' }}</div>
                <div class="bubble">
                  <small>{{ message.role === 'customer' ? 'Customer' : 'Aura Care AI' }} - {{ message.at }}</small>
                  <p>{{ message.text }}</p>
                  <div class="chips" *ngIf="message.relatedModules?.length">
                    <span *ngFor="let module of message.relatedModules">{{ module }}</span>
                  </div>
                  <div class="shortcut-row" *ngIf="message.shortcuts?.length">
                    <a *ngFor="let shortcut of message.shortcuts" [routerLink]="shortcut.route">Open {{ shortcut.label }}</a>
                  </div>
                  <ol *ngIf="message.nextSteps?.length">
                    <li *ngFor="let step of message.nextSteps">{{ step }}</li>
                  </ol>
                  <details class="citation-box" *ngIf="message.citations?.length">
                    <summary>Sources used</summary>
                    <a *ngFor="let citation of message.citations" [routerLink]="citation.route">
                      <strong>{{ citation.source }}</strong>
                      <span>{{ citation.note }}</span>
                    </a>
                  </details>
                  <em *ngIf="message.escalation">{{ message.escalation }}</em>
                  <div class="answer-actions" *ngIf="message.role === 'assistant'">
                    <button type="button" (click)="openTicketBooking(message)">Create ticket</button>
                    <button type="button" (click)="openEscalation(message)">Escalate</button>
                    <button type="button" (click)="speak(message.text)">Speak</button>
                  </div>
                </div>
              </article>
            </section>

            <form class="composer" (ngSubmit)="send()">
              <input [(ngModel)]="customerName" name="customerName" placeholder="Customer name" />
              <input [(ngModel)]="customerPhone" name="customerPhone" placeholder="Phone or booking ref" />
              <div class="composer-tools">
                <button type="button" (click)="lookupCustomer()">Lookup</button>
                <button type="button" (click)="startVoice()">{{ listening() ? 'Listening...' : 'Voice' }}</button>
              </div>
              <textarea [(ngModel)]="draft" name="draft" rows="3" placeholder="Ask anything about AuraSalon customer service..." required></textarea>
              <button class="send-button" type="submit" [disabled]="sending() || !draft.trim()">{{ sending() ? 'Thinking...' : 'Send' }}</button>
            </form>
          </ng-template>
          </ng-template>
        </main>

        <aside class="care-panel insight-panel" *ngIf="!bookingMessage() && !escalationMessage()">
          <div class="panel-head"><h2>Answer Controls</h2></div>
          <div class="metric-card"><span>Provider</span><strong>{{ lastProvider() }}</strong><small>{{ context()?.configured ? 'Server OpenAI key active' : 'Set OPENAI_API_KEY on server' }}</small></div>
          <div class="metric-card"><span>Coverage</span><strong>{{ moduleCount() }}</strong><small>knowledge areas loaded</small></div>

          <section class="call-slot-panel">
            <strong>Call with support</strong>
            <small>Use Create ticket in the chat answer to open the full booking page.</small>
            <p>{{ ticketNotice() || 'The booking page collects customer details, issue stage, support history, date and a one-hour screen-share slot.' }}</p>
          </section>

          <section class="customer-box" *ngIf="selectedCustomer() as customer">
            <strong>{{ customer.name }}</strong>
            <span>{{ customer.phone || 'No phone' }} - {{ customer.membershipStatus || 'none' }}</span>
            <small>{{ customer.visitCount || 0 }} visits - {{ customer.loyaltyPoints || 0 }} points</small>
            <a [routerLink]="customer.route || '/clients'">Open customer</a>
          </section>

          <div class="playbook">
            <strong>Support playbook</strong>
            <button type="button" *ngFor="let item of playbook" (click)="askQuick(item.prompt)"><span>{{ item.title }}</span><small>{{ item.detail }}</small></button>
          </div>

          <section class="side-list">
            <strong>Open tickets</strong>
            <article *ngFor="let ticket of tickets().slice(0, 5)">
              <span>{{ ticket.title }}</span>
              <small>{{ ticket.priority }} - {{ ticket.status }}</small>
            </article>
            <small *ngIf="!tickets().length">No tickets yet.</small>
          </section>

          <section class="side-list">
            <strong>Recent history</strong>
            <article *ngFor="let item of history().slice(0, 5)">
              <span>{{ item.topic }}</span>
              <small>{{ item.customerName || item.customerPhone || 'General' }}</small>
            </article>
            <small *ngIf="!history().length">No saved chats yet.</small>
          </section>
        </aside>
      </div>
    </section>
  `,
  styles: [`
    :host { display: block; height: calc(100vh - 44px); min-height: 0; overflow: hidden; }
    .care-shell { display: grid; grid-template-rows: auto auto minmax(0, 1fr); gap: 10px; height: 100%; min-height: 0; padding-top: 6px; color: #172033; min-width: 0; overflow: hidden; }
    .care-hero { display: flex; justify-content: space-between; gap: 18px; align-items: stretch; padding: 14px 18px; border: 1px solid #dfe7ef; border-radius: 8px; background: linear-gradient(135deg, #ffffff, #faf8f6); box-shadow: 0 10px 24px rgba(15, 23, 42, .07); }
    .eyebrow { display: block; color: #4B1238; font-weight: 800; text-transform: uppercase; font-size: 12px; letter-spacing: .08em; }
    h1, h2, p { margin: 0; } h1 { font-size: 28px; letter-spacing: 0; } h2 { font-size: 18px; letter-spacing: 0; }
    .care-hero p { max-width: 860px; margin-top: 4px; color: #5f6f83; line-height: 1.4; }
    .hero-status { min-width: 230px; display: grid; align-content: center; gap: 3px; padding: 10px 14px; border: 1px solid #dbe5ee; border-radius: 8px; background: #fff; }
    .hero-status span, .hero-status small, .panel-head span, .metric-card span, .metric-card small { color: #64748b; }
    .hero-status strong { font-size: 18px; }
    .care-grid { display: grid; grid-template-columns: minmax(240px, 280px) minmax(0, 1fr) minmax(230px, 270px); gap: 12px; align-items: stretch; min-width: 0; min-height: 0; }
    .care-grid.booking-mode { grid-template-columns: minmax(240px, 280px) minmax(0, 1fr); }
    .care-panel { min-width: 0; min-height: 0; border: 1px solid #dfe7ef; border-radius: 8px; background: #fff; box-shadow: 0 8px 22px rgba(15, 23, 42, .06); }
    .panel-head { display: flex; justify-content: space-between; gap: 12px; align-items: center; padding: 14px; border-bottom: 1px solid #edf2f7; min-width: 0; }
    button, select, input, textarea { font: inherit; } button { cursor: pointer; }
    .panel-head button, .quick-row button, .playbook button, .answer-actions button, .composer-tools button { border: 1px solid #dbe5ee; background: #f8fafc; color: #172033; border-radius: 8px; padding: 8px 10px; font-weight: 700; }
    select, input, textarea { width: 100%; min-width: 0; border: 1px solid #dbe5ee; border-radius: 8px; padding: 10px 12px; color: #172033; background: #fff; }
    select { max-width: 360px; }
    .context-panel, .insight-panel { height: 100%; overflow-y: auto; overflow-x: hidden; }
    .knowledge-list, .guardrail-box, .insight-panel, .playbook, .side-list, .call-slot-panel { display: grid; gap: 10px; padding: 14px; }
    .knowledge-card, .side-list article, .customer-box, .call-slot-panel label { display: grid; gap: 5px; padding: 12px; border: 1px solid #edf2f7; border-radius: 8px; background: #fbfdff; color: inherit; text-decoration: none; }
    .knowledge-card p, .side-list small, .customer-box small, .customer-box span, .call-slot-panel small, .call-slot-panel p { color: #64748b; font-size: 13px; line-height: 1.45; }
    .guardrail-box { margin: 0 14px 14px; border: 1px solid #fde2b8; background: #fffbeb; border-radius: 8px; }
    .guardrail-box span { color: #92400e; font-size: 13px; }
    .chat-panel { height: 100%; min-height: 0; display: grid; grid-template-rows: auto auto minmax(0, 1fr); overflow: hidden; }
    .quick-row { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; padding: 10px 14px; border-bottom: 1px solid #edf2f7; }
    .quick-row button { min-height: 36px; text-align: left; white-space: normal; line-height: 1.2; font-size: 13px; }
    .message-list { display: grid; gap: 12px; align-content: start; min-height: 0; overflow-y: auto; overflow-x: hidden; padding: 16px 16px 22px; background: #f8fafc; }
    .message { display: grid; grid-template-columns: 38px minmax(0, 1fr); gap: 10px; min-width: 0; }
    .message.customer { grid-template-columns: minmax(0, 1fr) 38px; }
    .message.customer .avatar { grid-column: 2; grid-row: 1; background: #4B1238; box-shadow: 0 8px 18px rgba(75, 18, 56, .18); }
    .message.customer .bubble { grid-column: 1; grid-row: 1; justify-self: end; border-color: #D4C0CF; background: linear-gradient(135deg, #F8EEF4, #FFFFFF); color: #2B1730; box-shadow: 0 10px 24px rgba(75, 18, 56, .09); }
    .message.customer .bubble small { color: #8B5E7C; }
    .avatar { width: 38px; height: 38px; border-radius: 50%; display: grid; place-items: center; background: #4B1238; color: #fff; font-weight: 900; font-size: 12px; }
    .bubble { width: min(860px, 100%); max-width: 100%; display: grid; gap: 9px; padding: 13px; border: 1px solid #dfe7ef; border-radius: 8px; background: #fff; overflow-wrap: anywhere; }
    .bubble p { white-space: pre-wrap; line-height: 1.55; } .bubble small, .bubble em { color: #64748b; }
    .chips, .shortcut-row, .answer-actions { display: flex; flex-wrap: wrap; gap: 7px; }
    .chips span, .shortcut-row a { padding: 5px 8px; border-radius: 999px; background: #F8EEF4; color: #4B1238; font-size: 12px; font-weight: 800; text-decoration: none; }
    .citation-box { display: grid; gap: 8px; padding: 8px; border-radius: 8px; background: #f8fafc; }
    .citation-box a { display: grid; gap: 2px; padding: 6px; color: inherit; text-decoration: none; }
    ol { margin: 0; padding-left: 18px; color: #334155; }
    .composer { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) 150px 118px; gap: 10px; padding: 12px 14px 14px; border-top: 1px solid #edf2f7; background: #fff; }
    .composer-tools { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
    .composer textarea { grid-column: 1 / 4; min-height: 76px; max-height: 120px; resize: vertical; }
    .send-button { grid-column: 4; grid-row: 1 / 3; min-width: 118px; border: 0; border-radius: 8px; background: #4B1238; color: #fff; font-weight: 900; cursor: pointer; }
    .send-button:disabled { opacity: .55; cursor: not-allowed; }
    .metric-card { display: grid; gap: 5px; padding: 14px; border: 1px solid #edf2f7; border-radius: 8px; background: #fbfdff; }
    .metric-card strong { font-size: 22px; }
    .ticket-booking-page { display: block; min-height: 0; overflow-y: auto; overflow-x: hidden; padding: 16px; background: #f8fafc; }
    .ticket-booking-page > * + * { margin-top: 14px; }
    .booking-head, .booking-section-title, .booking-actions { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
    .booking-head p, .booking-section-title small, .booking-warning, .history-card p { color: #64748b; line-height: 1.45; }
    .booking-head button, .booking-card button, .booking-actions button { border: 1px solid #dbe5ee; border-radius: 8px; background: #fff; color: #172033; padding: 9px 12px; font-weight: 800; }
    .booking-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
    .booking-card { display: grid; gap: 10px; padding: 14px; border: 1px solid #dfe7ef; border-radius: 10px; background: #fff; box-shadow: 0 8px 22px rgba(15, 23, 42, .05); }
    .slot-booking-card, .history-card { min-height: 160px; align-content: start; }
    .booking-card label { display: grid; gap: 5px; }
    .booking-card label span { color: #64748b; font-size: 12px; font-weight: 900; text-transform: uppercase; }
    .auto-stage-panel { display: grid; gap: 4px; padding: 12px; border: 1px solid #edf2f7; border-radius: 8px; background: #fbfdff; }
    .auto-stage-panel span { color: #64748b; font-size: 12px; font-weight: 900; text-transform: uppercase; }
    .auto-stage-panel strong { color: #4B1238; }
    .auto-stage-panel small { color: #64748b; }
    .stage-flow { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 6px; }
    .stage-flow span { min-height: 30px; display: grid; place-items: center; border: 1px solid #edf2f7; border-radius: 999px; background: #fbfdff; color: #64748b; font-size: 11px; font-weight: 900; text-align: center; }
    .stage-flow span.active { border-color: #4B1238; background: #F8EEF4; color: #4B1238; }
    .date-strip { min-height: 58px; display: grid; grid-auto-flow: column; grid-auto-columns: minmax(104px, 1fr); gap: 8px; overflow-x: auto; padding-bottom: 2px; }
    .date-strip button, .slot-grid button { display: grid; gap: 3px; text-align: left; }
    .date-strip button.active, .slot-grid button.active { border-color: #4B1238; background: #F8EEF4; color: #4B1238; }
    .slot-grid { min-height: 96px; display: grid; grid-template-columns: repeat(auto-fit, minmax(132px, 1fr)); gap: 8px; }
    .date-strip button, .slot-grid button { min-height: 48px; }
    .slot-grid button.booked { opacity: .56; cursor: not-allowed; text-decoration: line-through; }
    .booking-warning, .booking-empty { margin: 0; padding: 10px 12px; border: 1px solid #fde2b8; border-radius: 8px; background: #fffbeb; color: #92400e; }
    .history-card article { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 6px 10px; padding: 10px; border: 1px solid #edf2f7; border-radius: 8px; background: #fbfdff; }
    .history-card article p { grid-column: 1 / -1; margin: 0; }
    .history-card article span { align-self: start; border-radius: 999px; background: #F8EEF4; color: #4B1238; padding: 4px 8px; font-size: 12px; font-weight: 900; text-transform: capitalize; }
    .booking-actions { margin-top: 16px; padding: 14px; border: 1px solid #edf2f7; border-radius: 10px; background: #fff; }
    .primary-booking-button { border-color: #4B1238 !important; background: #4B1238 !important; color: #fff !important; }
    .primary-booking-button:disabled { opacity: .52; cursor: not-allowed; }
    .call-slot-panel { margin: 0 14px; border: 1px solid #edf2f7; border-radius: 8px; background: #fff; }
    .call-slot-panel label { grid-template-columns: auto minmax(0, 1fr); align-items: center; cursor: pointer; }
    .call-slot-panel label.active { border-color: #4B1238; background: #F8EEF4; }
    .call-slot-panel input { width: auto; }
    .call-slot-panel b, .call-slot-panel small { display: block; }
    .call-slot-panel p { margin: 0; }
    .playbook button { display: grid; gap: 3px; text-align: left; }
    .playbook small { color: #64748b; }
    @media (max-width: 1280px) { .care-grid { grid-template-columns: minmax(220px, 260px) minmax(0, 1fr); } .insight-panel { display: none; } .quick-row { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
    @media (max-width: 980px) { :host { height: auto; overflow: visible; } .care-shell { overflow: visible; } .care-grid { grid-template-columns: 1fr; } .context-panel, .insight-panel, .chat-panel { height: auto; max-height: none; } .chat-panel { min-height: 640px; } .quick-row { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
    @media (max-width: 720px) { .care-hero, .booking-head, .booking-actions { flex-direction: column; align-items: stretch; } h1 { font-size: 28px; } .quick-row, .booking-grid { grid-template-columns: 1fr; } .composer { grid-template-columns: 1fr; } .composer textarea, .send-button { grid-column: auto; grid-row: auto; } }
  `]
})
export class CustomerCareAiComponent implements OnInit {
  readonly loading = signal(true);
  readonly sending = signal(false);
  readonly listening = signal(false);
  readonly error = signal('');
  readonly context = signal<CareContext | null>(null);
  readonly messages = signal<CareMessage[]>([]);
  readonly selectedTopic = signal('General support');
  readonly lastProvider = signal('checking');
  readonly selectedCustomer = signal<ApiRecord | null>(null);
  readonly tickets = signal<ApiRecord[]>([]);
  readonly history = signal<ApiRecord[]>([]);
  readonly sessionId = signal('');
  readonly bookingMessage = signal<CareMessage | null>(null);
  readonly escalationMessage = signal<CareMessage | null>(null);
  readonly selectedCallDate = signal(this.dateValue(new Date()));
  readonly selectedCallSlot = signal('');
  readonly ticketNotice = signal('');
  readonly moduleCount = computed(() => this.context()?.knowledge?.length || 0);
  readonly supportDates = computed(() => this.nextSupportDates());
  readonly supportSlotsForSelectedDate = computed(() => this.slotsForDate(this.selectedCallDate()));

  draft = '';
  customerName = '';
  customerPhone = '';
  issueTitle = '';
  issueDetails = '';
  supportStage = 'Open';
  escalationSummary = '';
  escalationReason = 'Manager approval required';
  escalationUrgency = 'high';
  managerInstruction = '';

  readonly topics = ['General support', 'Booking', 'Billing', 'Data Migration', 'Membership', 'POS', 'Inventory', 'Reports', 'Marketing', 'Security'];
  readonly quickActionsByTopic: Record<string, string[]> = {
    'General support': [
      'How do I find the right module for a customer issue?',
      'What details should support collect before creating a ticket?',
      'When should I book a support call instead of answering in chat?',
      'How do I guide a customer step by step inside AuraSalon?',
      'What issues must be escalated to owner or manager?',
      'How do I check customer history before replying?'
    ],
    Booking: [
      'How do I book or reschedule an appointment?',
      'What should I check when a slot is not available?',
      'How do deposits and no-show rules work for bookings?',
      'How do I change staff or service on an appointment?',
      'Where can I see appointment history and activity?',
      'How do I handle a customer who missed their appointment?'
    ],
    Billing: [
      'How do invoices, payments, refunds and dues work?',
      'What should I check when payment is showing wrong?',
      'How do I find an invoice by customer phone or booking?',
      'How do partial payments and pending dues work?',
      'When should a refund request be escalated?',
      'How do I explain tax, discount and final bill difference?'
    ],
    'Data Migration': [
      'How do I do data migration from old salon software?',
      'Which file details are needed before migration?',
      'How do I fix mapping or validation errors?',
      'What should be checked before go-live approval?',
      'How do I review imported clients, services and invoices?',
      'When should migration be escalated to admin?'
    ],
    Membership: [
      'How do memberships, packages and loyalty benefits work?',
      'How do I check package balance for a customer?',
      'Why is a benefit not applying at POS?',
      'How do membership expiry and renewal work?',
      'How do gift cards and loyalty points work?',
      'What should I verify before promising a benefit?'
    ],
    POS: [
      'How do I create a POS bill from services or products?',
      'Why is a service price different by branch or staff?',
      'How do I apply discount, tax and membership benefit?',
      'What should I check before closing a POS invoice?',
      'How do I handle unpaid or partially paid bills?',
      'How do product sales connect to inventory stock?'
    ],
    Inventory: [
      'What should I check when inventory and POS stock do not match?',
      'How do purchase orders and bill drafts affect stock?',
      'How do barcode, batch and FIFO stock work?',
      'How do I receive approved PO stock?',
      'How do service recipes consume product stock?',
      'What should I check for low stock or reorder alerts?'
    ],
    Reports: [
      'Which reports should owners check after daily closing?',
      'How do I read appointment, sales and due reports?',
      'Where can I check staff-wise performance?',
      'How do I verify daily cash, card and UPI totals?',
      'Which report helps with pending payments?',
      'What should be escalated to finance or owner?'
    ],
    Marketing: [
      'How do WhatsApp campaigns and offers work?',
      'What consent should be checked before messaging customers?',
      'How do coupons and happy-hour offers apply?',
      'How do reviews and reputation follow-ups work?',
      'How do I choose campaign audience filters?',
      'When should marketing approval be required?'
    ],
    Security: [
      'How do roles and permissions work?',
      'What should I do if a user cannot access a module?',
      'Which security issues must be escalated immediately?',
      'How do branch and tenant access restrictions work?',
      'What should I verify before changing permissions?',
      'How do audit logs help investigate activity?'
    ]
  };
  readonly supportStages = ['Open', 'Under review', 'In process', 'Resolved', 'Closed'];
  readonly escalationReasons = ['Manager approval required', 'Refund or payment dispute', 'Permission or access issue', 'Security or account risk', 'Data migration/go-live decision', 'Customer complaint or urgent callback', 'AI answer is not enough'];
  readonly escalationUrgencies = [
    { value: 'high', label: 'High - manager should review today' },
    { value: 'urgent', label: 'Urgent - immediate manager attention' },
    { value: 'medium', label: 'Medium - review in normal queue' }
  ];
  readonly playbook = [
    { title: 'Booking issue', detail: 'Slots, staff, deposits', prompt: 'A customer wants to reschedule an appointment. What should support check?' },
    { title: 'Billing help', detail: 'Invoices, dues, refunds', prompt: 'A customer says their invoice payment is wrong. What is the support workflow?' },
    { title: 'Migration help', detail: 'Imports, mapping, validation', prompt: 'How do I do data migration from old salon software?' },
    { title: 'Membership help', detail: 'Benefits and balances', prompt: 'How should support explain membership benefits and package balance?' },
    { title: 'Branch question', detail: 'Multi-location handling', prompt: 'How does branch-specific pricing and availability work for customers?' },
    { title: 'Screen-share call', detail: 'Book a live support slot', prompt: 'Create a support ticket and guide the customer to choose a call slot with screen sharing.' },
    { title: 'Navigate me', detail: 'Step-by-step software help', prompt: 'Act as an advanced AuraSalon product guide. Tell me exactly where to click and what to check inside the software.' }
  ];

  constructor(private readonly api: ApiService) {}

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading.set(true);
    this.error.set('');
    this.api.list<CareContext>('customer-care-ai/context', { includeAllBranches: true }).subscribe({
      next: (context) => {
        this.context.set(context);
        this.lastProvider.set(context.provider);
        if (!this.messages().length) this.seedWelcome(context.provider);
        this.loading.set(false);
        this.loadSideData();
      },
      error: (error) => { this.error.set(this.api.errorText(error, 'Customer Care AI context could not be loaded.')); this.loading.set(false); }
    });
  }

  askQuick(question: string): void { this.draft = question; this.send(); }

  topicQuickActions(): string[] {
    return this.quickActionsByTopic[this.selectedTopic()] || this.context()?.quickActions || [];
  }

  openTicketBooking(message: CareMessage): void {
    this.bookingMessage.set(message);
    this.issueTitle = this.issueTitle || `${this.selectedTopic()} support request`;
    this.issueDetails = this.issueDetails || message.text;
    this.selectFirstAvailableSlot();
  }

  closeTicketBooking(): void {
    this.bookingMessage.set(null);
  }

  openEscalation(message: CareMessage): void {
    this.escalationMessage.set(message);
    this.bookingMessage.set(null);
    this.escalationSummary = this.escalationSummary || message.text;
    this.managerInstruction = this.managerInstruction || message.escalation || 'Please review this customer case and advise the correct next action.';
  }

  closeEscalation(): void {
    this.escalationMessage.set(null);
  }

  selectCallDate(value: string): void {
    this.selectedCallDate.set(value);
    this.selectedCallSlot.set('');
    this.selectFirstAvailableSlot();
  }

  selectCallSlot(slot: CareCallSlot): void {
    if (this.isSlotBooked(slot) || this.weeklyBookingBlock()) return;
    this.selectedCallSlot.set(slot.id);
  }

  isSlotBooked(slot: CareCallSlot): boolean {
    return this.tickets().some((ticket) => {
      const booked = this.ticketCallSlot(ticket);
      return Boolean(booked?.id && booked.id === slot.id);
    });
  }

  userSupportHistory(): ApiRecord[] {
    return this.tickets().filter((ticket) => this.ticketMatchesCurrentUser(ticket));
  }

  weeklyBookingBlock(): boolean {
    return this.userSupportHistory().some((ticket) => this.ticketHasRecentSupportCall(ticket));
  }

  weeklyBookingMessage(): string {
    return 'A support call is already booked for this customer. To keep support fair for everyone, one call can be booked within a 7-day period. Please use the existing ticket status or book a new call next week.';
  }

  ticketStage(ticket: ApiRecord): string {
    const status = String(ticket['status'] || '').toLowerCase();
    if (status === 'closed') return 'Closed';
    if (status === 'resolved' || status === 'completed') return 'Resolved';
    if (status === 'escalated' || status === 'in_process' || status === 'in-progress') return 'In process';
    if (this.ticketCallSlot(ticket)) return 'Under review';
    return 'Open';
  }

  lookupCustomer(): void {
    const phone = this.customerPhone.trim();
    const name = this.customerName.trim();
    if (!phone && !name) { this.error.set('Enter customer phone or name before lookup.'); return; }
    this.api.list<ApiRecord>('customer-care-ai/customers/lookup', { phone, name, includeAllBranches: true }).subscribe({
      next: (result) => {
        const selected = Array.isArray(result['matches']) ? result['matches'][0] : null;
        this.selectedCustomer.set(selected || null);
        if (selected) {
          this.customerName = String(selected.name || this.customerName);
          this.customerPhone = String(selected.phone || this.customerPhone);
        }
      },
      error: (error) => this.error.set(this.api.errorText(error, 'Customer lookup failed.'))
    });
  }

  send(): void {
    const text = this.draft.trim();
    if (!text || this.sending()) return;
    const customerMessage: CareMessage = { role: 'customer', text, at: this.timeLabel() };
    const history = [...this.messages(), customerMessage].slice(-12).map((message) => ({ role: message.role, text: message.text }));
    this.messages.update((items) => [...items, customerMessage]);
    this.draft = '';
    this.sending.set(true);
    this.error.set('');
    this.api.post<ApiRecord>('customer-care-ai/chat', { sessionId: this.sessionId(), message: text, topic: this.selectedTopic(), customerName: this.customerName, customerPhone: this.customerPhone, history, includeAllBranches: true, supportMode: this.advancedSupportMode() }).subscribe({
      next: (answer) => {
        this.sessionId.set(String(answer['sessionId'] || this.sessionId()));
        this.lastProvider.set(String(answer['provider'] || 'customer-care-ai'));
        const customerContext = answer['customerContext'] as ApiRecord | undefined;
        const selected = customerContext && Array.isArray(customerContext['matches']) ? customerContext['matches'][0] : null;
        if (selected) this.selectedCustomer.set(selected);
        this.messages.update((items) => [...items, this.answerMessage(answer)]);
        this.sending.set(false);
        this.loadSideData();
      },
      error: (error) => { this.error.set(this.api.errorText(error, 'Customer Care AI could not answer right now.')); this.sending.set(false); }
    });
  }

  createTicket(message: CareMessage): void {
    if (!this.customerName.trim() && !this.customerPhone.trim()) { this.error.set('Please enter the customer name or phone number before booking a support call.'); return; }
    if (this.weeklyBookingBlock()) { this.error.set(this.weeklyBookingMessage()); return; }
    if (!this.selectedCallSlot()) { this.error.set('Please choose an available support call slot.'); return; }
    const draft = message.ticketDraft || {};
    const callSlot = this.selectedSupportCallSlot();
    const summary = [this.issueTitle || message.text, `Stage: ${this.supportStage}`, this.issueDetails || message.text].filter(Boolean).join(' | ');
    this.api.post<ApiRecord>('customer-care-ai/tickets', { ...draft, sessionId: this.sessionId(), customerName: this.customerName, customerPhone: this.customerPhone, topic: this.selectedTopic(), title: this.issueTitle || draft['title'], summary, relatedModules: message.relatedModules || [], supportCallSlot: callSlot, callMode: 'screen-share-guided-support', supportStage: this.supportStage, requestedOutcome: 'Customer and support team join the selected one-hour slot, share screen if needed, understand the issue, and solve it live.' }).subscribe({
      next: () => {
        this.ticketNotice.set(`Ticket created with ${callSlot.label}, ${callSlot.window}. The customer and support specialist should join at the scheduled time.`);
        this.bookingMessage.set(null);
        this.loadSideData();
      },
      error: (error) => this.error.set(this.api.errorText(error, 'Ticket could not be created.'))
    });
  }

  submitEscalation(message: CareMessage): void {
    if (!this.escalationSummary.trim()) { this.error.set('Please add the escalation summary before sending to manager.'); return; }
    const callSlot = this.selectedSupportCallSlot();
    const escalationReason = [this.escalationReason, this.managerInstruction].filter(Boolean).join(' | ');
    this.api.post<ApiRecord>('customer-care-ai/escalations', { sessionId: this.sessionId(), customerName: this.customerName, customerPhone: this.customerPhone, topic: this.selectedTopic(), summary: this.escalationSummary || message.text, priority: this.escalationUrgency, escalationReason, relatedModules: message.relatedModules || [], supportCallSlot: callSlot, callMode: 'screen-share-guided-support' }).subscribe({
      next: () => {
        this.ticketNotice.set('Escalated to manager. A high-priority handoff ticket has been created and added to the manager queue.');
        this.escalationMessage.set(null);
        this.loadSideData();
      },
      error: (error) => this.error.set(this.api.errorText(error, 'Escalation could not be created.'))
    });
  }

  startVoice(): void {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) { this.error.set('Voice input is not supported in this browser.'); return; }
    const recognition = new SpeechRecognition();
    recognition.lang = 'en-IN';
    recognition.interimResults = false;
    recognition.onstart = () => this.listening.set(true);
    recognition.onend = () => this.listening.set(false);
    recognition.onerror = () => this.listening.set(false);
    recognition.onresult = (event: any) => { this.draft = String(event.results?.[0]?.[0]?.transcript || this.draft); };
    recognition.start();
  }

  speak(text: string): void {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(new SpeechSynthesisUtterance(text.slice(0, 1200)));
  }

  private loadSideData(): void {
    this.api.list<ApiRecord[]>('customer-care-ai/tickets', { limit: 100 }).subscribe({ next: (rows) => this.tickets.set(rows || []), error: () => undefined });
    this.api.list<ApiRecord[]>('customer-care-ai/history', { limit: 20 }).subscribe({ next: (rows) => this.history.set(rows || []), error: () => undefined });
  }

  private seedWelcome(provider: string): void {
    this.messages.set([{ role: 'assistant', text: 'Hi, I am Aura Customer Care AI. I can answer software questions, explain workflows, guide navigation step by step, create tickets, and reserve a call + screen-share slot when a human support person should join.', at: this.timeLabel(), relatedModules: ['Home', 'Bookings', 'Clients CRM', 'POS', 'Reports', 'Inventory'], nextSteps: ['Lookup a customer by phone/name when available.', 'Ask the issue in plain language; I will map it to the right module and steps.', 'Choose a call slot before creating a ticket when live screen-share support is needed.'], provider, shortcuts: [{ label: 'Home', route: '/home' }, { label: 'Bookings', route: '/appointments' }, { label: 'Clients CRM', route: '/clients' }, { label: 'POS', route: '/pos' }, { label: 'Inventory', route: '/inventory' }, { label: 'Reports', route: '/reports' }] }]);
  }

  private selectFirstAvailableSlot(): void {
    const available = this.supportSlotsForSelectedDate().find((slot) => !this.isSlotBooked(slot));
    this.selectedCallSlot.set(available?.id || '');
  }

  private nextSupportDates(): Array<{ value: string; day: string; label: string }> {
    return Array.from({ length: 14 }, (_, index) => {
      const date = new Date();
      date.setDate(date.getDate() + index);
      return {
        value: this.dateValue(date),
        day: date.toLocaleDateString('en-IN', { weekday: 'short' }),
        label: date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
      };
    });
  }

  private slotsForDate(date: string): CareCallSlot[] {
    return Array.from({ length: 7 }, (_, index) => {
      const startHour = 12 + index;
      const endHour = startHour + 1;
      const start = `${String(startHour).padStart(2, '0')}:00`;
      const end = `${String(endHour).padStart(2, '0')}:00`;
      return {
        id: `${date}-${start}-${end}`,
        label: this.dateLabel(date),
        date,
        start,
        end,
        window: `${this.hourLabel(startHour)} - ${this.hourLabel(endHour)}`,
        mode: 'Call + screen share'
      };
    });
  }

  private ticketMatchesCurrentUser(ticket: ApiRecord): boolean {
    const phone = this.customerPhone.replace(/[^0-9]/g, '').slice(-10);
    const name = this.customerName.trim().toLowerCase();
    const ticketPhone = String(ticket['customerPhone'] || '').replace(/[^0-9]/g, '').slice(-10);
    const ticketName = String(ticket['customerName'] || '').trim().toLowerCase();
    return Boolean((phone && ticketPhone === phone) || (name && ticketName === name));
  }

  private ticketHasRecentSupportCall(ticket: ApiRecord): boolean {
    if (!this.ticketCallSlot(ticket)) return false;
    const createdAt = new Date(String(ticket['createdAt'] || ticket['updatedAt'] || ''));
    if (Number.isNaN(createdAt.getTime())) return false;
    return Date.now() - createdAt.getTime() < 7 * 24 * 60 * 60 * 1000;
  }

  private ticketCallSlot(ticket: ApiRecord): CareCallSlot | null {
    const audit = Array.isArray(ticket['audit']) ? ticket['audit'] as ApiRecord[] : [];
    const booking = audit.find((item) => item['action'] === 'support_call_slot_reserved' && item['callSlot']);
    return booking ? booking['callSlot'] as CareCallSlot : null;
  }

  private dateValue(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private dateLabel(value: string): string {
    const date = new Date(`${value}T00:00:00`);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short' });
  }

  private hourLabel(hour: number): string {
    const suffix = hour >= 12 ? 'PM' : 'AM';
    const normalized = hour > 12 ? hour - 12 : hour;
    return `${normalized}:00 ${suffix}`;
  }

  private selectedSupportCallSlot(): CareCallSlot {
    return this.supportSlotsForSelectedDate().find((slot) => slot.id === this.selectedCallSlot()) || this.supportSlotsForSelectedDate()[0]!;
  }

  private advancedSupportMode(): ApiRecord {
    return {
      role: 'advanced-aura-product-support',
      behavior: 'Answer like a senior AuraSalon software support expert. Understand the full salon CRM/POS workflow, give exact navigation paths, explain what to click/check, cite related modules, and suggest ticket/call-slot handoff only when needed.',
      callSlot: this.selectedSupportCallSlot(),
      screenShare: true
    };
  }

  private answerMessage(answer: ApiRecord): CareMessage {
    return { role: 'assistant', text: String(answer['answer'] || 'I could not generate an answer. Please try again with more details.'), at: this.timeLabel(), relatedModules: this.asTextArray(answer['relatedModules']), nextSteps: this.asTextArray(answer['nextSteps']), escalation: String(answer['escalation'] || ''), provider: String(answer['provider'] || ''), shortcuts: this.asShortcutArray(answer['shortcuts']), citations: this.asCitationArray(answer['citations']), ticketDraft: (answer['ticketDraft'] || {}) as ApiRecord };
  }

  private asTextArray(value: unknown): string[] { return Array.isArray(value) ? value.map((item) => String(item)).filter(Boolean) : []; }
  private asShortcutArray(value: unknown): CareShortcut[] { return Array.isArray(value) ? value.map((item: any) => ({ label: String(item.label || item.module || ''), route: String(item.route || '/home') })).filter((item) => item.label) : []; }
  private asCitationArray(value: unknown): CareCitation[] { return Array.isArray(value) ? value.map((item: any) => ({ source: String(item.source || ''), route: String(item.route || '/customer-care-ai'), note: String(item.note || '') })).filter((item) => item.source) : []; }
  private timeLabel(): string { return new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }); }
}
