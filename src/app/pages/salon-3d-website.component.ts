import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-salon-3d-website',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <main class="salon-site">
      <section class="hero">
        <div class="scene" aria-label="AuraShine salon preview">
          <div class="wall"></div>
          <div class="mirror"></div>
          <div class="chair chair-one"></div>
          <div class="chair chair-two"></div>
          <div class="counter"></div>
        </div>
        <div class="copy">
          <span class="eyebrow">AuraShine Luxe Salon</span>
          <h1>Aurashine 3D Salon Website</h1>
          <p>Premium salon experience, service discovery and online booking entry for customers.</p>
          <div class="actions">
            <a class="primary" routerLink="/book/wizard">Book appointment</a>
            <a class="secondary" routerLink="/appointments">Open calendar</a>
          </div>
        </div>
      </section>

      <section class="quick-grid">
        <article *ngFor="let item of highlights">
          <span>{{ item.label }}</span>
          <strong>{{ item.value }}</strong>
          <small>{{ item.detail }}</small>
        </article>
      </section>
    </main>
  `,
  styles: [`
    :host { display: block; }
    .salon-site { display: grid; gap: 18px; color: #172033; }
    .hero { min-height: 520px; display: grid; grid-template-columns: minmax(0, 1.25fr) minmax(320px, .75fr); gap: 24px; align-items: center; padding: 28px; border: 1px solid #d7e6e2; border-radius: 8px; background: #f8fffd; overflow: hidden; }
    .scene { position: relative; min-height: 430px; border-radius: 8px; background: linear-gradient(160deg, #eef7f4 0%, #ffffff 45%, #e8f1ff 100%); border: 1px solid #cfe0dc; box-shadow: inset 0 -80px 0 #d9eee8; overflow: hidden; }
    .wall { position: absolute; inset: 0; background: linear-gradient(90deg, transparent, rgba(15, 143, 127, .08), transparent); }
    .mirror { position: absolute; width: 34%; height: 58%; left: 18%; top: 12%; border: 10px solid #d8b451; border-radius: 8px; background: linear-gradient(140deg, rgba(255,255,255,.9), rgba(191,219,254,.5)); box-shadow: 0 22px 50px rgba(15,23,42,.16); }
    .chair { position: absolute; width: 120px; height: 118px; bottom: 64px; border-radius: 28px 28px 10px 10px; background: #0f766e; box-shadow: 0 22px 0 #134e4a; }
    .chair::after { content: ""; position: absolute; left: 26px; right: 26px; bottom: -54px; height: 54px; background: #334155; border-radius: 999px; }
    .chair-one { left: 22%; }
    .chair-two { left: 52%; background: #1d4ed8; box-shadow: 0 22px 0 #1e3a8a; }
    .counter { position: absolute; right: 8%; bottom: 86px; width: 180px; height: 92px; border-radius: 8px; background: #ffffff; border: 1px solid #cfe0dc; box-shadow: 0 18px 40px rgba(15,23,42,.12); }
    .copy { display: grid; gap: 14px; }
    .eyebrow { color: #0f766e; font-size: 12px; font-weight: 900; letter-spacing: .04em; text-transform: uppercase; }
    h1 { margin: 0; font-size: 42px; line-height: 1.05; letter-spacing: 0; }
    p { margin: 0; color: #64748b; font-size: 16px; line-height: 1.55; }
    .actions { display: flex; flex-wrap: wrap; gap: 10px; }
    a { min-height: 42px; display: inline-flex; align-items: center; justify-content: center; padding: 0 16px; border-radius: 8px; border: 1px solid #cfe0dc; color: #172033; text-decoration: none; font-weight: 900; }
    .primary { background: #0f8f7f; border-color: #0f8f7f; color: #ffffff; }
    .secondary { background: #ffffff; }
    .quick-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
    article { padding: 14px; border: 1px solid #d7e6e2; border-radius: 8px; background: #ffffff; display: grid; gap: 5px; }
    article span { color: #64748b; font-size: 12px; font-weight: 900; text-transform: uppercase; }
    article strong { font-size: 22px; }
    article small { color: #64748b; }
    @media (max-width: 900px) {
      .hero, .quick-grid { grid-template-columns: 1fr; }
      h1 { font-size: 32px; }
    }
  `]
})
export class Salon3dWebsiteComponent {
  readonly highlights = [
    { label: 'Booking', value: 'Live', detail: 'Connects to public booking flow' },
    { label: 'Experience', value: '3D', detail: 'Visual salon preview' },
    { label: 'Services', value: 'Premium', detail: 'Customer-facing discovery' },
    { label: 'Ops link', value: 'Ready', detail: 'Admin calendar shortcut' }
  ];
}
