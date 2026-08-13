import { Component, EventEmitter, Input, Output } from "@angular/core";
import { IonIcon } from "@ionic/angular/standalone";
import { addIcons } from "ionicons";
import { chevronBackOutline, chevronDownOutline, closeOutline, exitOutline, menuOutline } from "ionicons/icons";

@Component({
  selector: "app-my-salon-header",
  standalone: true,
  imports: [IonIcon],
  template: `
    <header class="my-salon-header" role="navigation" aria-label="My Salon controls">
      @if (showBack) {
        <button type="button" class="header-back" aria-label="Back" (click)="back.emit()">
          <ion-icon name="chevron-back-outline" aria-hidden="true"></ion-icon>
        </button>
      }

      <button type="button" class="header-brand" (click)="openSwitcher($event)" [attr.aria-expanded]="switcherOpen" aria-label="Switch salon">
        <span class="header-logo" aria-hidden="true">
          @if (logoImage) {
            <img [src]="logoImage" [alt]="salonName" />
          } @else {
            <span>{{ initials }}</span>
          }
        </span>
        <span class="header-copy">
          <strong>{{ salonName }}</strong>
          <small>My Salon</small>
        </span>
        <ion-icon class="header-dropdown" name="chevron-down-outline" aria-hidden="true"></ion-icon>
      </button>

      <div class="header-actions">
        @if (showMenuButton) {
          <button type="button" class="header-menu" [attr.aria-label]="menuOpen ? 'Close salon menu' : 'Open salon menu'" (click)="menu.emit()">
            <ion-icon [name]="menuOpen ? 'close-outline' : 'menu-outline'" aria-hidden="true"></ion-icon>
          </button>
        }
        @if (showAction) {
          <button type="button" class="header-action" [attr.aria-label]="actionAriaLabel" (click)="action.emit()">
            <ion-icon [name]="actionIcon" aria-hidden="true"></ion-icon>
            <span>{{ actionLabel }}</span>
          </button>
        }
      </div>
    </header>
  `,
  styles: [`
    :host { display: block; }
    .my-salon-header {
      position: fixed;
      z-index: 1000;
      top: calc(10px + env(safe-area-inset-top));
      left: 50%;
      width: min(640px, calc(100% - 24px));
      height: 48px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      padding: 7px 8px 7px 10px;
      border: 1px solid var(--border);
      border-radius: 999px;
      background: color-mix(in srgb, var(--ms-shell-accent-soft, #e1d6fb) 28%, var(--glass));
      box-shadow: 0 18px 46px rgba(28, 28, 28, 0.18);
      backdrop-filter: blur(18px);
      contain: layout paint;
      transform: translateX(-50%);
      will-change: transform;
    }
    .header-back, .header-brand, .header-action, .header-menu { display: inline-flex; align-items: center; }
    .header-actions { display: inline-flex; align-items: center; gap: 6px; flex: 0 0 auto; }
    .header-back {
      flex: 0 0 auto;
      width: 34px;
      height: 34px;
      justify-content: center;
      padding: 0;
      border: 1px solid rgba(225, 214, 251, 0.72);
      border-radius: 999px;
      color: var(--ms-shell-accent, #7c63df);
      background: var(--glass);
      font-size: 1rem;
    }
    .header-brand {
      flex: 1 1 auto;
      min-width: 0;
      gap: 8px;
      color: #fff;
      border: 0;
      background: transparent;
      cursor: pointer;
      text-decoration: none;
      text-align: left;
    }
    .header-logo {
      width: 32px;
      height: 32px;
      display: grid;
      flex: 0 0 auto;
      place-items: center;
      overflow: hidden;
      border-radius: 999px;
      color: var(--text, #1C1C1C);
      background: var(--ms-shell-accent, #7c63df);
      box-shadow: 0 10px 22px color-mix(in srgb, var(--ms-shell-accent, #7c63df) 30%, transparent);
      font-size: 0.72rem;
      font-weight: 900;
      letter-spacing: -0.03em;
    }
    .header-logo img { width: 100%; height: 100%; object-fit: cover; }
    .header-copy { display: grid; min-width: 0; line-height: 1.08; }
    .header-copy strong { max-width: none; overflow: visible; white-space: normal; font-size: 0.82rem; line-height: 1.08; letter-spacing: -0.015em; }
    .header-copy small { color: var(--muted, #696969); font-size: 0.7rem; font-weight: 800; letter-spacing: 0.01em; }
    .header-dropdown { flex: 0 0 auto; margin-left: 2px; color: var(--ms-shell-accent, #7c63df); font-size: 0.9rem; }
    .header-action {
      gap: 5px;
      min-height: 34px;
      padding: 0 10px;
      border: 1px solid var(--ms-exit-border, rgba(159, 18, 57, 0.2));
      border-radius: 999px;
      color: var(--ms-exit, #9F1239);
      background: var(--glass);
      font-size: 0.76rem;
      font-weight: 950;
    }
    .header-menu {
      width: 34px;
      height: 34px;
      justify-content: center;
      margin-right: -7px;
      padding: 0;
      border: 1px solid rgba(225, 214, 251, 0.78);
      border-radius: 999px;
      color: var(--ms-shell-accent, #7c63df);
      background: rgba(255, 255, 255, 0.76);
      font-size: 1.08rem;
      box-shadow: inset 0 1px 0 rgba(255,255,255,0.72);
    }
    .header-back, .header-brand, .header-action, .header-menu {
      transition: transform 180ms ease, border-color 180ms ease, background-color 180ms ease, color 180ms ease;
      touch-action: manipulation;
    }
    .header-back:focus-visible, .header-brand:focus-visible, .header-action:focus-visible, .header-menu:focus-visible {
      outline: 2px solid color-mix(in srgb, var(--ms-shell-accent, #7c63df) 72%, white);
      outline-offset: 3px;
    }
    .header-back:active, .header-brand:active, .header-action:active, .header-menu:active { transform: scale(0.98); }
    @media (prefers-reduced-motion: reduce) {
      .header-back, .header-brand, .header-action, .header-menu { transition: none; }
    }
    @media (max-width: 430px) {
      .header-copy strong { font-size: 0.78rem; }
      .header-action span { display: none; }
      .header-action { width: 34px; justify-content: center; padding: 0; }
    }
  `]
})
export class MySalonHeaderComponent {
  @Input() salonName = "Selected salon";
  @Input() initials = "MS";
  @Input() logoImage = "";
  @Input() homeHref = "#";
  @Input() showBack = true;
  @Input() showMenuButton = false;
  @Input() menuOpen = false;
  @Input() switcherOpen = false;
  @Input() showAction = true;
  @Input() actionLabel = "Exit";
  @Input() actionIcon = "exit-outline";
  @Input() actionAriaLabel = "Exit My Salon";
  @Output() readonly back = new EventEmitter<void>();
  @Output() readonly home = new EventEmitter<Event>();
  @Output() readonly switcher = new EventEmitter<void>();
  @Output() readonly menu = new EventEmitter<void>();
  @Output() readonly action = new EventEmitter<void>();

  constructor() {
    addIcons({ chevronBackOutline, chevronDownOutline, closeOutline, exitOutline, menuOutline });
  }

  openSwitcher(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.switcher.emit();
  }
}
