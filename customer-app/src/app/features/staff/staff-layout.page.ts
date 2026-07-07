import { Component, HostListener, OnInit, computed, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from "@angular/router";
import { StaffAppService, StaffEnterpriseOs } from "../../core/staff-app.service";

type StaffNavItem = { label: string; path: string; icon: string; group: string; permission?: string };
type StaffRecentItem = { label: string; path: string };

@Component({
  standalone: true,
  imports: [FormsModule, RouterLink, RouterLinkActive, RouterOutlet],
  template: `
    <section class="staff-app-shell">
      <button type="button" class="drawer-backdrop" [class.open]="menuOpen()" (click)="closeMenu()" aria-label="Close menu"></button>
      <aside class="staff-sidebar" [class.open]="menuOpen()">
        <button type="button" class="drawer-close" (click)="closeMenu()" aria-label="Close menu">Close</button>
        <div class="brand-card">
          <span>Aura</span>
          <strong>Staff OS</strong>
          <small>{{ staff.user()?.role || 'staff' }} workspace</small>
        </div>
        <div class="user-card">
          <b>{{ initials() }}</b>
          <div><strong>{{ staff.user()?.name || 'Aura Staff' }}</strong><small>{{ staff.user()?.branchId || 'branch scoped' }}</small></div>
        </div>
        @if (recent().length) {
          <section class="recent-card">
            <span>Recent</span>
            @for (item of recent(); track item.path) { <a [routerLink]="item.path" (click)="activateRecent(item)">{{ item.label }}</a> }
          </section>
        }
        <nav>
          @for (group of navGroups(); track group) {
            <p class="nav-group">{{ group }}</p>
            @for (item of navByGroup(group); track item.path) {
              <a [routerLink]="item.path" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: item.path === '/staff/dashboard' }" (click)="activateNav(item)"><span>{{ item.icon }}</span>{{ item.label }}</a>
            }
          }
        </nav>
        <button type="button" class="nav-logout" (click)="logout()">Logout</button>
      </aside>

      <div class="staff-main-shell">
        <header class="staff-topbar">
          <button type="button" class="menu-button" (click)="openMenu()" aria-label="Open menu"><span></span><span></span><span></span></button>
          <div>
            <p>Connected staff portal</p>
            <strong>{{ staff.user()?.name || 'Aura Staff' }}</strong>
          </div>
          <div class="topbar-actions">
            <button type="button" class="search-button" (click)="openCommand()">Search <small>Ctrl K</small></button>
            <button type="button" class="bell-button" (click)="toggleNotifications()" aria-label="Notifications">N<span>{{ unreadCount() }}</span></button>
            <span class="net-status" [class.offline]="!online()">{{ online() ? 'Online' : 'Offline' }}</span>
            <span>{{ staff.user()?.branchId || 'branch scoped' }}</span>
          </div>
        </header>
        <main class="staff-content"><router-outlet /></main>
      </div>

      @if (commandOpen()) {
        <section class="command-backdrop" (click)="closeCommand()">
          <div class="command-palette" (click)="$event.stopPropagation()">
            <div class="command-head"><strong>Command palette</strong><button type="button" (click)="closeCommand()">Close</button></div>
            <input [(ngModel)]="query" placeholder="Search pages, appointments, AI notes..." autofocus />
            <div class="command-list">
              @for (item of commandResults(); track item.path + item.label) {
                <button type="button" (click)="go(item)"><span>{{ item.icon }}</span><div><strong>{{ item.label }}</strong><small>{{ item.group }}</small></div></button>
              } @empty {
                <p>No matching staff command.</p>
              }
            </div>
          </div>
        </section>
      }

      <button type="button" class="drawer-backdrop" [class.open]="notificationsOpen()" (click)="closeNotifications()" aria-label="Close notifications"></button>
      <aside class="notification-drawer" [class.open]="notificationsOpen()">
        <div class="drawer-title"><strong>Notifications</strong><button type="button" (click)="closeNotifications()">Close</button></div>
        @if (os()?.aiCoach?.[0]; as card) { <p class="ai-brief"><b>{{ card.title }}</b><br />{{ card.body }}</p> }
        <div class="notice-list">
          @for (note of os()?.notifications || []; track note.id) {
            <article><strong>{{ note.title }}</strong><small>{{ note.body || note.status }}</small><span>{{ note.status }}</span></article>
          } @empty {
            <p>No notifications yet.</p>
          }
        </div>
      </aside>
    </section>
  `,
  styles: [`
    .staff-app-shell { min-height: 100vh; display: grid; grid-template-columns: 272px minmax(0, 1fr); background: radial-gradient(circle at 18% 0, #ffe09a 0, transparent 26%), radial-gradient(circle at 88% 10%, #7a4510 0, transparent 28%), linear-gradient(135deg, #1b1008, #fff2d1 58%, #fff8ea); }
    .staff-sidebar { position: sticky; top: 0; height: 100vh; overflow: auto; padding: 16px; border-right: 1px solid rgba(234,210,162,.5); background: linear-gradient(180deg, rgba(34,19,5,.96), rgba(103,63,13,.92)); box-shadow: 18px 0 60px rgba(63,39,7,.24); }
    .brand-card { padding: 18px; border: 1px solid rgba(255,255,255,.16); border-radius: 24px; color: #fff8e8; background: rgba(255,255,255,.09); }
    .brand-card span { display: block; color: #f7d98c; font-size: .74rem; font-weight: 950; letter-spacing: .16em; text-transform: uppercase; }
    .brand-card strong { display: block; margin-top: 5px; font-size: 1.45rem; }
    .brand-card small { display: block; margin-top: 4px; color: #f8dfaa; font-weight: 850; text-transform: capitalize; }
    .drawer-backdrop, .menu-button, .drawer-close { display: none; }
    .menu-button span { display: block; width: 18px; height: 2px; border-radius: 999px; background: #5d3607; }
    .user-card { display: grid; grid-template-columns: 42px 1fr; gap: 10px; align-items: center; margin-top: 12px; padding: 10px; border: 1px solid rgba(255,255,255,.14); border-radius: 18px; background: rgba(255,255,255,.08); color: #fff8e8; }
    .user-card b { display: grid; place-items: center; width: 42px; height: 42px; border-radius: 15px; background: #fff8ea; color: #5d3607; }
    .user-card strong, .user-card small { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .user-card small { color: #f8dfaa; font-weight: 800; }
    .recent-card { display: grid; gap: 6px; margin-top: 12px; padding: 10px; border-radius: 18px; background: rgba(255,255,255,.07); }
    .recent-card span, .nav-group { margin: 12px 2px 4px; color: #f7d98c; font-size: .68rem; font-weight: 950; letter-spacing: .12em; text-transform: uppercase; }
    .recent-card a { color: #ffefd0; font-size: .82rem; font-weight: 850; text-decoration: none; }
    nav { display: grid; gap: 5px; margin-top: 14px; }
    nav a { display: grid; grid-template-columns: 34px 1fr; gap: 10px; align-items: center; padding: 10px 12px; border: 1px solid transparent; border-radius: 16px; color: #ffefd0; font-weight: 900; text-decoration: none; }
    nav a span { display: grid; place-items: center; width: 32px; height: 32px; border-radius: 12px; background: rgba(255,255,255,.1); color: #f7d98c; font-size: .7rem; font-weight: 950; }
    nav a.active, nav a:hover { border-color: rgba(255,255,255,.18); background: rgba(255,255,255,.13); color: #fff; }
    nav a.active span { background: #fff8ea; color: #5d3607; }
    .nav-logout { width: 100%; margin-top: 12px; padding: 11px 13px; border: 1px solid rgba(255,255,255,.2); border-radius: 16px; background: rgba(255,248,234,.12); color: #fff8e8; font-weight: 950; text-align: left; }
    .staff-main-shell { min-width: 0; display: grid; grid-template-rows: auto minmax(0, 1fr); height: 100vh; overflow: hidden; }
    .staff-topbar { display: flex; justify-content: space-between; align-items: center; gap: 14px; padding: 14px 20px; border-bottom: 1px solid rgba(234,210,162,.72); background: rgba(255,255,255,.78); backdrop-filter: blur(16px); }
    .staff-topbar p { margin: 0; color: #8a611e; font-size: .74rem; font-weight: 950; letter-spacing: .12em; text-transform: uppercase; }
    .staff-topbar strong { color: #1d1307; }
    .topbar-actions { display: flex; align-items: center; gap: 10px; }
    .topbar-actions span { color: #75552b; font-weight: 900; }
    .search-button, .bell-button { border: 1px solid #d6aa55; border-radius: 999px; background: #fff8ea; color: #6e4810; font-weight: 950; padding: 8px 12px; }
    .search-button small { margin-left: 6px; opacity: .72; }
    .bell-button { position: relative; min-width: 42px; }
    .bell-button span { position: absolute; right: -5px; top: -7px; display: grid; place-items: center; min-width: 20px; height: 20px; padding: 0 5px; border-radius: 999px; background: #7a4510; color: #fff8e8; font-size: .68rem; }
    .net-status { padding: 7px 10px; border-radius: 999px; background: #effbea; color: #1f6b2d !important; }
    .net-status.offline { background: #fff1ec; color: #9c2f21 !important; }
    .staff-content { min-width: 0; overflow: auto; padding: 20px; }
    .command-backdrop { position: fixed; inset: 0; z-index: 50; display: grid; place-items: start center; padding-top: 8vh; background: rgba(20,12,5,.5); backdrop-filter: blur(3px); }
    .command-palette { width: min(720px, calc(100vw - 24px)); max-height: 78vh; overflow: auto; border: 1px solid rgba(234,210,162,.9); border-radius: 24px; background: #fff8ea; box-shadow: 0 30px 90px rgba(34,19,5,.35); }
    .command-head, .drawer-title { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 14px; border-bottom: 1px solid #ead5aa; }
    .command-head strong, .drawer-title strong { color: #1d1307; }
    .command-head button, .drawer-title button { border: 1px solid #d6aa55; border-radius: 999px; background: #fff; color: #6e4810; font-weight: 950; padding: 7px 10px; }
    .command-palette input { width: calc(100% - 28px); margin: 14px; min-height: 46px; border: 1px solid #d6aa55; border-radius: 16px; padding: 0 13px; color: #1d1307; }
    .command-list { display: grid; gap: 6px; padding: 0 14px 14px; }
    .command-list button { display: grid; grid-template-columns: 36px 1fr; gap: 10px; align-items: center; border: 1px solid #ead5aa; border-radius: 16px; padding: 10px; background: #fff; text-align: left; }
    .command-list button span { display: grid; place-items: center; width: 34px; height: 34px; border-radius: 12px; background: #fff1cc; color: #7b4d0d; font-size: .72rem; font-weight: 950; }
    .command-list strong, .command-list small { display: block; color: #1d1307; }
    .command-list small { color: #75552b; }
    .notification-drawer { position: fixed; top: 0; right: 0; bottom: 0; z-index: 31; width: min(420px, 92vw); overflow: auto; padding: 14px; transform: translateX(105%); transition: transform .2s ease; background: #fff8ea; box-shadow: -24px 0 60px rgba(34,19,5,.28); }
    .notification-drawer.open { transform: translateX(0); }
    .ai-brief { margin: 12px 0; padding: 12px; border: 1px solid #ead5aa; border-radius: 16px; color: #5d3607; background: #fff; font-weight: 800; }
    .notice-list { display: grid; gap: 8px; }
    .notice-list article { padding: 12px; border: 1px solid #ead5aa; border-radius: 16px; background: #fff; }
    .notice-list strong, .notice-list small, .notice-list span { display: block; }
    .notice-list strong { color: #1d1307; }
    .notice-list small { margin-top: 4px; color: #75552b; font-weight: 800; }
    .notice-list span { margin-top: 6px; color: #8a611e; font-size: .76rem; font-weight: 950; text-transform: capitalize; }
    @media (max-width: 900px) {
      .staff-app-shell { display: block; min-height: 100dvh; padding-bottom: env(safe-area-inset-bottom); }
      .staff-main-shell { display: block; min-height: 100dvh; height: auto; overflow: visible; }
      .staff-topbar { position: sticky; top: 0; z-index: 20; padding: 11px 13px; box-shadow: 0 10px 28px rgba(92,65,28,.12); }
      .menu-button { display: inline-flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; flex: 0 0 auto; width: 40px; height: 40px; border: 1px solid #d6aa55; border-radius: 14px; background: #fff8ea; color: #5d3607; font-size: .78rem; font-weight: 950; }
      .staff-topbar p { font-size: .66rem; }
      .topbar-actions { gap: 7px; }
      .search-button small, .topbar-actions > span:not(.net-status) { display: none; }
      .search-button { padding: 8px 10px; }
      .topbar-actions span { max-width: 132px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: .82rem; }
      .topbar-actions button { padding: 7px 10px; }
      .staff-content { overflow: visible; padding: 14px 12px 18px; }
      .drawer-backdrop { display: block; position: fixed; inset: 0; z-index: 29; border: 0; opacity: 0; pointer-events: none; background: rgba(20,12,5,.48); backdrop-filter: blur(2px); transition: opacity .18s ease; }
      .drawer-backdrop.open { opacity: 1; pointer-events: auto; }
      .staff-sidebar { position: fixed; left: 0; top: 0; bottom: 0; z-index: 30; width: min(84vw, 318px); height: 100dvh; overflow: auto; padding: 14px; border-right: 1px solid rgba(255,255,255,.18); transform: translateX(-104%); transition: transform .2s ease; box-shadow: 24px 0 60px rgba(34,19,5,.34); }
      .staff-sidebar.open { transform: translateX(0); }
      .drawer-close { display: block; width: 100%; margin-bottom: 10px; padding: 9px 12px; border: 1px solid rgba(255,255,255,.2); border-radius: 16px; background: rgba(255,255,255,.1); color: #fff8e8; font-weight: 950; text-align: left; }
      .brand-card { display: block; }
      nav { display: grid; gap: 6px; margin-top: 14px; overflow: visible; }
      nav a { min-width: 0; padding: 12px 13px; border-radius: 16px; text-align: left; font-size: .92rem; white-space: normal; background: transparent; }
      nav a.active { background: #fff8ea; color: #5d3607; border-color: rgba(255,255,255,.4); }
    }
    @media (max-width: 560px) {
      .staff-topbar { align-items: center; display: flex; }
      .staff-topbar strong { display: block; max-width: 170px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .net-status { display: none; }
      nav a { padding: 12px 13px; }
    }
  `]
})
export class StaffLayoutPage implements OnInit {
  readonly menuOpen = signal(false);
  readonly commandOpen = signal(false);
  readonly notificationsOpen = signal(false);
  readonly online = signal(typeof navigator === "undefined" ? true : navigator.onLine);
  readonly os = signal<StaffEnterpriseOs | null>(null);
  readonly recent = signal<StaffRecentItem[]>(this.readRecent());
  query = "";

  private readonly nav: StaffNavItem[] = [
    { label: "Dashboard", path: "/staff/dashboard", icon: "DB", group: "Home" },
    { label: "Appointments", path: "/staff/appointments", icon: "AP", group: "Work" },
    { label: "Today's Queue", path: "/staff/queue", icon: "Q", group: "Work" },
    { label: "Tasks", path: "/staff/tasks", icon: "TK", group: "Work", permission: "read:staff" },
    { label: "Attendance", path: "/staff/attendance", icon: "AT", group: "Work" },
    { label: "Roster", path: "/staff/roster", icon: "RS", group: "Work", permission: "read:staff" },
    { label: "Calendar", path: "/staff/calendar", icon: "CL", group: "Work" },
    { label: "Clients", path: "/staff/clients", icon: "CU", group: "Clients" },
    { label: "Client 360", path: "/staff/client-360", icon: "360", group: "Clients" },
    { label: "AI Coach", path: "/staff/ai-coach", icon: "AI", group: "Intelligence" },
    { label: "Performance", path: "/staff/performance", icon: "PF", group: "Intelligence" },
    { label: "Leaderboard", path: "/staff/leaderboard", icon: "LB", group: "Intelligence" },
    { label: "Reports", path: "/staff/reports", icon: "RP", group: "Intelligence" },
    { label: "Notifications", path: "/staff/notifications", icon: "NT", group: "Comms" },
    { label: "Chat", path: "/staff/chat", icon: "CH", group: "Comms" },
    { label: "Learning", path: "/staff/learning", icon: "LR", group: "Growth" },
    { label: "Payroll", path: "/staff/payroll", icon: "PY", group: "Account", permission: "read:payroll" },
    { label: "Leaves", path: "/staff/leaves", icon: "LV", group: "Account", permission: "read:staff" },
    { label: "Profile", path: "/staff/profile", icon: "ME", group: "Account" },
    { label: "Settings", path: "/staff/settings", icon: "ST", group: "Account" }
  ];

  readonly commandResults = computed(() => {
    const text = this.query.trim().toLowerCase();
    const navItems = this.visibleNav().map((item) => ({ ...item }));
    const notices = (this.os()?.notifications || []).map((note) => ({ label: note.title, path: "/staff/notifications", icon: "NT", group: note.body || "Notification" }));
    const coach = (this.os()?.aiCoach || []).map((card) => ({ label: card.title, path: "/staff/ai-coach", icon: "AI", group: card.body }));
    const queue = (this.os()?.timeline || []).map((item) => ({ label: item.clientName, path: "/staff/queue", icon: "Q", group: item.serviceNames?.join(", ") || "Appointment" }));
    const all = [...navItems, ...notices, ...coach, ...queue];
    return (text ? all.filter((item) => `${item.label} ${item.group}`.toLowerCase().includes(text)) : all).slice(0, 12);
  });

  constructor(readonly staff: StaffAppService, private readonly router: Router) {}

  ngOnInit() {
    void this.loadShellData();
  }

  @HostListener("window:online") onOnline() { this.online.set(true); }
  @HostListener("window:offline") onOffline() { this.online.set(false); }
  @HostListener("window:keydown", ["$event"])
  onKeydown(event: KeyboardEvent) {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      this.openCommand();
    }
    if (event.key === "Escape") {
      this.closeCommand();
      this.closeMenu();
      this.closeNotifications();
    }
  }

  visibleNav(): StaffNavItem[] {
    return this.nav.filter((item) => !item.permission || this.staff.hasPermission(item.permission) || item.permission === "read:payroll" && this.staff.hasPermission("read:finance"));
  }

  navGroups(): string[] {
    return [...new Set(this.visibleNav().map((item) => item.group))];
  }

  navByGroup(group: string): StaffNavItem[] {
    return this.visibleNav().filter((item) => item.group === group);
  }

  initials(): string {
    return String(this.staff.user()?.name || "Staff").split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "S";
  }

  unreadCount(): number {
    return (this.os()?.notifications || []).filter((note) => String(note.status || "unread") !== "read").length;
  }

  activateNav(item: StaffNavItem) {
    this.remember(item);
    this.closeMenu();
  }

  activateRecent(item: StaffRecentItem) {
    this.remember(item);
    this.closeMenu();
  }

  openMenu() {
    this.menuOpen.set(true);
  }

  closeMenu() {
    this.menuOpen.set(false);
  }

  openCommand() {
    this.commandOpen.set(true);
  }

  closeCommand() {
    this.commandOpen.set(false);
    this.query = "";
  }

  toggleNotifications() {
    this.notificationsOpen.update((open) => !open);
  }

  closeNotifications() {
    this.notificationsOpen.set(false);
  }

  go(item: StaffRecentItem) {
    this.remember(item);
    this.closeCommand();
    void this.router.navigateByUrl(item.path);
  }

  logout() {
    this.closeMenu();
    this.staff.logout();
    void this.router.navigateByUrl("/staff/login");
  }

  private async loadShellData() {
    try {
      this.os.set(await this.staff.enterpriseOs());
    } catch {
      this.os.set(null);
    }
  }

  private remember(item: StaffRecentItem) {
    const next = [{ label: item.label, path: item.path }, ...this.recent().filter((entry) => entry.path !== item.path)].slice(0, 4);
    this.recent.set(next);
    localStorage.setItem("auraStaffRecent", JSON.stringify(next));
  }

  private readRecent(): StaffRecentItem[] {
    try {
      const parsed = JSON.parse(localStorage.getItem("auraStaffRecent") || "[]");
      return Array.isArray(parsed) ? parsed.slice(0, 4) : [];
    } catch {
      return [];
    }
  }
}
