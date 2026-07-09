import { Component, OnInit, signal } from "@angular/core";
import { RouterLink } from "@angular/router";
import { IonSpinner } from "@ionic/angular/standalone";
import { StaffAppService, StaffEnterpriseOs } from "../../core/staff-app.service";

const STAFF_AI_COACH_DISMISS_KEY = "auraStaffAiCoachDismissed";

@Component({
  standalone: true,
  imports: [RouterLink, IonSpinner],
  template: `
    <section class="page">
      <header class="page-head"><div><p class="eyebrow">AI Coach</p><h1>AI staff coach</h1><p>Actionable coaching cards generated from connected staff records.</p></div></header>
      @if (!canReadCoach()) { <section class="notice">You do not have permission to read AI coach.</section> }
      @if (loading()) { <section class="state"><ion-spinner name="crescent" /> Loading AI coach...</section> }
      @if (message()) { <section class="notice success">{{ message() }}</section> }
      @if (staff.error()) { <section class="notice">{{ staff.error() }}</section> }

      @if (canReadCoach() && visibleCards(); as cards) {
        <section class="grid two">
          @for (card of cards; track card.title) {
            <article class="panel">
              <div class="panel-title"><h2>{{ card.title }}</h2><span>{{ card.priority }}</span></div>
              <p class="insight">{{ card.body }}</p>
              <p class="muted">{{ card.action }}</p>
              <div class="row-actions">
                @if (actionRoute(card); as route) {
                  <a class="button" [routerLink]="route">Open</a>
                }
                <button class="link-button" type="button" (click)="dismiss(card)">Mark as reviewed</button>
              </div>
            </article>
          } @empty { <article class="panel"><p class="empty">No AI coaching cards yet.</p></article> }
        </section>
      }
    </section>`,
  styleUrls: ["./staff-app.styles.css"]
})
export class StaffAiCoachPage implements OnInit {
  readonly os = signal<StaffEnterpriseOs | null>(null);
  readonly loading = signal(false);
  readonly message = signal("");
  readonly dismissed = signal<Set<string>>(new Set());

  constructor(readonly staff: StaffAppService) {}

  ngOnInit() { if (this.canReadCoach()) void this.load(); }

  async load() {
    this.loading.set(true);
    this.message.set("");
    this.loadDismissed();
    try {
      this.os.set(await this.staff.enterpriseOs());
    } finally {
      this.loading.set(false);
    }
  }

  canReadCoach(): boolean {
    return this.staff.hasPermission("read:staff");
  }

  visibleCards() {
    const dismissed = this.dismissed();
    const cards = (this.os()?.aiCoach || []);
    return cards.filter((card) => !dismissed.has(this.cardKey(card)));
  }

  dismiss(card: { title: string; body: string }) {
    const next = new Set(this.dismissed());
    next.add(this.cardKey(card));
    this.dismissed.set(next);
    localStorage.setItem(this.dismissKey(), JSON.stringify([...next]));
    this.message.set("Card marked as reviewed.");
  }

  actionRoute(card: { title: string; body: string; action: string }) {
    const needle = `${card.title} ${card.body} ${card.action}`.toLowerCase();
    if (needle.includes("queue") || needle.includes("service timer") || needle.includes("service in progress")) return "/staff/queue";
    if (needle.includes("appointment") || needle.includes("booking") || needle.includes("client visit")) return "/staff/appointments";
    if (needle.includes("task")) return "/staff/tasks";
    if (needle.includes("roster") || needle.includes("shift") || needle.includes("schedule")) return "/staff/roster";
    if (needle.includes("calendar")) return "/staff/calendar";
    if (needle.includes("client")) return "/staff/clients";
    if (needle.includes("attendance")) return "/staff/attendance";
    if (needle.includes("payroll") || needle.includes("salary") || needle.includes("payout")) return "/staff/payroll";
    if (needle.includes("learning") || needle.includes("training")) return "/staff/learning";
    return null;
  }

  private loadDismissed() {
    const stored = localStorage.getItem(this.dismissKey()) || "[]";
    try {
      const values = JSON.parse(stored);
      this.dismissed.set(new Set(Array.isArray(values) ? values : []));
    } catch {
      this.dismissed.set(new Set());
    }
  }

  private cardKey(card: { title: string; body: string }) {
    return `${card.title}|${card.body}`;
  }

  private dismissKey(): string {
    const staffId = this.staff.user()?.staffId || "global";
    return `${STAFF_AI_COACH_DISMISS_KEY}:${staffId}`;
  }
}
