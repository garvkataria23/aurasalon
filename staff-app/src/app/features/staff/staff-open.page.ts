import { HttpClient } from "@angular/common/http";
import { Component, OnInit } from "@angular/core";
import { Router } from "@angular/router";
import { firstValueFrom } from "rxjs";
import { environment } from "../../../environments/environment";
import { StaffAppService, StaffUser } from "../../core/staff-app.service";

type DemoStaffSession = {
  success?: boolean;
  data?: { accessToken: string; refreshToken?: string; user: StaffUser };
  accessToken?: string;
  refreshToken?: string;
  user?: StaffUser;
};

@Component({
  standalone: true,
  template: `<main class="staff-open-state"><div class="staff-open-mark">AS</div><p class="eyebrow">Aura Shine Staff</p><h1>Opening your workspace</h1><p>Connecting your branch, permissions and live staff data…</p></main>`, styles: [` .staff-open-state { min-height: 100dvh; display: grid; place-content: center; justify-items: center; gap: 10px; padding: 24px; color: #fff8ef; text-align: center; background: radial-gradient(circle at 18% 8%, rgba(246,200,189,.55), transparent 27%), linear-gradient(135deg, #241625, #563346 52%, #dcae83); } .staff-open-state p, .staff-open-state h1 { margin: 0; } .staff-open-state .eyebrow { color: #f6c8bd; font-size: .72rem; font-weight: 900; letter-spacing: .16em; text-transform: uppercase; } .staff-open-state h1 { font-size: clamp(2rem, 7vw, 3.8rem); line-height: .95; } .staff-open-state p:last-child { color: rgba(255,248,239,.76); font-weight: 700; } .staff-open-mark { display: grid; place-items: center; width: 64px; height: 64px; border-radius: 22px; color: #321827; background: linear-gradient(135deg, #f6c8bd, #e2ab67); font-weight: 950; box-shadow: 0 16px 34px rgba(50,25,44,.2); } `]
})
export class StaffOpenPage implements OnInit {
  constructor(private readonly http: HttpClient, private readonly staff: StaffAppService, private readonly router: Router) {}

  async ngOnInit() {
    if (environment.production) {
      await this.router.navigateByUrl("/staff/login");
      return;
    }
    try {
      const baseUrl = environment.apiBaseUrl.replace(/\/$/, "");
      const response = await firstValueFrom(this.http.get<DemoStaffSession>(`${baseUrl}/auth/demo-staff-session`));
      const session = response.data || response;
      if (!session.accessToken || !session.user) throw new Error("Demo staff session was not issued.");
      this.staff.openSession({ accessToken: session.accessToken, refreshToken: session.refreshToken || "", user: session.user });
      await this.router.navigateByUrl("/staff/dashboard");
    } catch {
      await this.router.navigateByUrl("/staff/login");
    }
  }
}
