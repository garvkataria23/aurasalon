import { DatePipe } from "@angular/common";
import { Component, OnInit, signal } from "@angular/core";
import { IonSpinner } from "@ionic/angular/standalone";
import { StaffAppService, StaffEnterpriseOs } from "../../core/staff-app.service";

@Component({ standalone: true, imports: [DatePipe, IonSpinner], template: `
  <section class="page"><header class="page-head"><div><p class="eyebrow">Notifications</p><h1>Notifications</h1><p>Staff alerts and connected system notices.</p></div></header>
  @if (loading()) { <section class="state"><ion-spinner name="crescent" /> Loading notifications...</section> } @if (staff.error()) { <section class="notice">{{ staff.error() }}</section> }
  @if (message()) { <section class="notice success">{{ message() }}</section> }
  @if (os(); as data) { <section class="panel"><div class="panel-title"><h2>Inbox</h2><span>{{ data.notifications.length }}</span></div><div class="list">@for (note of data.notifications; track note.id) { <div class="row"><div class="row-main"><strong>{{ note.title }}</strong><small>{{ note.body || 'No details' }} · {{ note.createdAt ? (note.createdAt | date:'short') : '' }}</small></div><div class="row-actions"><span class="badge">{{ note.status }}</span><button class="link-button" type="button" (click)="mark(note.id, note.status === 'read' ? 'unread' : 'read')">{{ note.status === 'read' ? 'Unread' : 'Read' }}</button><button class="link-button" type="button" (click)="mark(note.id, 'archived')">Archive</button></div></div> } @empty { <p class="empty">No staff notifications yet.</p> }</div></section> }
  </section>`, styleUrls: ["./staff-app.styles.css"] })
export class StaffNotificationsPage implements OnInit { readonly os = signal<StaffEnterpriseOs | null>(null); readonly loading = signal(false); readonly message = signal(""); constructor(readonly staff: StaffAppService) {} ngOnInit() { void this.load(); } async load() { this.loading.set(true); try { this.os.set(await this.staff.enterpriseOs()); } finally { this.loading.set(false); } } async mark(id: string, status: "read" | "unread" | "archived") { await this.staff.updateNotification(id, status); this.message.set(`Notification marked ${status}.`); await this.load(); } }
