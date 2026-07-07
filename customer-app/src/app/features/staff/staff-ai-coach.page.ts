import { Component, OnInit, signal } from "@angular/core";
import { IonSpinner } from "@ionic/angular/standalone";
import { StaffAppService, StaffEnterpriseOs } from "../../core/staff-app.service";

@Component({ standalone: true, imports: [IonSpinner], template: `
  <section class="page"><header class="page-head"><div><p class="eyebrow">AI Coach</p><h1>AI staff coach</h1><p>Actionable coaching cards generated from connected staff records.</p></div></header>
  @if (loading()) { <section class="state"><ion-spinner name="crescent" /> Loading AI coach...</section> } @if (staff.error()) { <section class="notice">{{ staff.error() }}</section> }
  @if (os(); as data) { <section class="grid two">@for (card of data.aiCoach; track card.title) { <article class="panel"><div class="panel-title"><h2>{{ card.title }}</h2><span>{{ card.priority }}</span></div><p class="insight">{{ card.body }}</p><p class="muted">{{ card.action }}</p></article> } @empty { <article class="panel"><p class="empty">No AI coaching cards yet.</p></article> }</section> }
  </section>`, styleUrls: ["./staff-app.styles.css"] })
export class StaffAiCoachPage implements OnInit { readonly os = signal<StaffEnterpriseOs | null>(null); readonly loading = signal(false); constructor(readonly staff: StaffAppService) {} ngOnInit() { void this.load(); } async load() { this.loading.set(true); try { this.os.set(await this.staff.enterpriseOs()); } finally { this.loading.set(false); } } }
