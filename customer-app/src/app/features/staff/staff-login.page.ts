import { Component } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { RouterLink } from "@angular/router";
import { IonContent, IonSpinner } from "@ionic/angular/standalone";
import { StaffAppService } from "../../core/staff-app.service";

@Component({
  standalone: true,
  imports: [FormsModule, RouterLink, IonContent, IonSpinner],
  template: `
    <ion-content class="staff-login-shell">
      <main class="staff-card">
        <p class="eyebrow">Aura Staff App</p>
        <h1>Login to your work desk</h1>
        <p class="subcopy">Only your appointments, work report, sales and profile details are shown.</p>

        @if (staff.error()) {
          <div class="notice">{{ staff.error() }}</div>
        }

        <form class="staff-form">
          <label>Tenant ID</label>
          <input [(ngModel)]="tenantId" name="tenantId" placeholder="tenant_aura" autocomplete="organization" />

          <label>Staff login ID</label>
          <input [(ngModel)]="loginId" name="loginId" placeholder="email, mobile or login ID" autocomplete="username" />

          <label>Password</label>
          <input [(ngModel)]="password" name="password" type="password" placeholder="Password" autocomplete="current-password" />

          <button type="button" class="login-button" [disabled]="staff.loading()" (click)="login()">
            @if (staff.loading()) { <ion-spinner name="crescent"></ion-spinner> } @else { Login }
          </button>
        </form>

        <a routerLink="/" class="customer-link">Open customer app</a>
      </main>
    </ion-content>
  `,
  styles: [`
    .staff-login-shell { --background: linear-gradient(145deg, #fff8ea, #f2dfbc); }
    .staff-card { width: min(560px, calc(100% - 28px)); margin: 8vh auto; padding: 32px; border: 1px solid rgba(178, 127, 39, .25); border-radius: 30px; background: rgba(255,255,255,.82); box-shadow: 0 24px 80px rgba(92, 65, 28, .16); }
    .eyebrow { margin: 0 0 8px; color: #8b5d15; font-size: .75rem; font-weight: 900; letter-spacing: .16em; text-transform: uppercase; }
    h1 { margin: 0; color: #1d1307; font-size: clamp(2rem, 6vw, 3.2rem); line-height: .95; }
    .subcopy { color: #74522b; font-weight: 700; line-height: 1.5; }
    .notice { margin: 18px 0; padding: 14px 16px; border: 1px solid #eac36f; border-radius: 16px; color: #6b4a18; background: #fff4d8; font-weight: 800; }
    .staff-form { display: grid; gap: 10px; margin-top: 20px; }
    label { color: #3a2713; font-size: .85rem; font-weight: 900; }
    input { min-height: 52px; border: 1px solid #ead5aa; border-radius: 16px; padding: 0 14px; color: #1d1307; background: #fff; font: inherit; font-weight: 800; }
    .login-button { margin-top: 14px; min-height: 52px; border: 0; border-radius: 16px; background: linear-gradient(135deg, #f4d58d, #d6a94a); color: #1b1207; font-weight: 950; cursor: pointer; }
    .login-button:disabled { cursor: progress; opacity: .72; }
    .customer-link { display: block; margin-top: 18px; color: #815712; font-weight: 900; text-align: center; text-decoration: none; }
  `]
})
export class StaffLoginPage {
  tenantId = "tenant_aura";
  loginId = "";
  password = "";

  constructor(readonly staff: StaffAppService) {}

  async login() {
    this.staff.logout();
    await this.staff.login({ tenantId: this.tenantId, loginId: this.loginId, password: this.password })
      .then(() => window.location.assign("/staff/dashboard"))
      .catch(() => undefined);
  }
}
