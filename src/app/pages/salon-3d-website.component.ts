import { CommonModule } from '@angular/common';
import { AfterViewInit, ChangeDetectionStrategy, Component, ElementRef, OnDestroy, ViewChild, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import * as THREE from 'three';
import { SalonSceneMode, SalonSceneModeId, SalonWebsiteContentService } from '../core/salon-website-content.service';

type Vec3 = readonly [number, number, number];

interface VisitPlan {
  name: string;
  phone: string;
  service: string;
  branch: string;
  preferredDate: string;
}

@Component({
  selector: 'app-salon-3d-website',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="salon-website">
      <section class="salon-hero" aria-labelledby="salonHeroTitle">
        <div class="salon-3d-stage" (pointermove)="trackPointer($event)" (pointerleave)="resetPointer()">
          <canvas #sceneCanvas aria-label="Interactive 3D salon interior"></canvas>
        </div>
        <div class="hero-shade" aria-hidden="true"></div>

        <nav class="salon-nav" aria-label="Salon website navigation">
          <a class="salon-brand" routerLink="/salon-3d" aria-label="AuraShine Luxe Salon home">
            <span>A</span>
            <strong>{{ content.hero.brandName }}</strong>
          </a>
          <div class="salon-nav-links">
            <a href="#services">Services</a>
            <a href="#experience">Experience</a>
            <a href="#booking">Booking</a>
          </div>
          <a class="nav-action" [href]="content.hero.whatsappLink" target="_blank" rel="noreferrer">WhatsApp</a>
        </nav>

        <div class="hero-body">
          <div class="hero-copy">
            <span class="hero-eyebrow">{{ content.hero.eyebrow }}</span>
            <h1 id="salonHeroTitle">{{ content.hero.brandName }}</h1>
            <p>{{ content.hero.summary }}</p>
            <div class="hero-actions">
              <a class="primary-cta" routerLink="/book/wizard">Book appointment</a>
              <a class="secondary-cta" href="#services">View services</a>
            </div>
            <div class="hero-open-row">
              <span>{{ content.hero.bookingWindow }}</span>
              <span>{{ content.hero.phone }}</span>
            </div>
          </div>

          <div class="scene-switcher" role="tablist" aria-label="3D salon area">
            <button
              type="button"
              *ngFor="let mode of content.sceneModes"
              [class.active]="activeMode() === mode.id"
              (click)="selectSceneMode(mode)"
              [attr.aria-selected]="activeMode() === mode.id"
              role="tab"
            >
              {{ mode.label }}
            </button>
          </div>
        </div>

        <div class="hero-bottom">
          <article class="metric-tile" *ngFor="let metric of content.metrics">
            <span>{{ metric.label }}</span>
            <strong>{{ metric.value }}</strong>
            <small>{{ metric.detail }}</small>
          </article>
        </div>
      </section>

      <section class="availability-strip" aria-label="Salon availability">
        <strong>Premium booking live</strong>
        <span *ngFor="let branch of content.branches">{{ branch }}</span>
        <a routerLink="/book/wizard">Start booking</a>
      </section>

      <section class="salon-section" id="services">
        <div class="section-heading">
          <span>Signature menu</span>
          <h2>High-value services built for appointment conversion</h2>
          <p>Each service block is ready for pricing, timing, staff matching and future POS inventory deduction.</p>
        </div>
        <div class="service-grid">
          <article class="service-card" *ngFor="let service of content.services">
            <div>
              <span>{{ service.duration }}</span>
              <h3>{{ service.name }}</h3>
              <p>{{ service.detail }}</p>
            </div>
            <strong>{{ service.price }}</strong>
          </article>
        </div>
      </section>

      <section class="salon-section experience-section" id="experience">
        <div class="section-heading">
          <span>Salon operating zones</span>
          <h2>Designed like a premium customer journey, not a plain brochure</h2>
        </div>
        <div class="experience-grid">
          <article class="zone-card" *ngFor="let zone of content.zones">
            <span>{{ zone.signal }}</span>
            <h3>{{ zone.title }}</h3>
            <p>{{ zone.detail }}</p>
          </article>
        </div>
      </section>

      <section class="booking-band" id="booking">
        <div class="booking-copy">
          <span>Appointment request</span>
          <h2>Plan a visit from the 3D website</h2>
          <p>Use this website as the premium front door, then hand off confirmed bookings into the existing AuraShine booking engine.</p>
          <a class="secondary-cta dark" routerLink="/book/wizard">Open booking engine</a>
        </div>

        <form [formGroup]="visitForm" (ngSubmit)="createVisitPlan()" class="visit-form">
          <label>
            <span>Name</span>
            <input formControlName="name" autocomplete="name" />
          </label>
          <label>
            <span>Phone</span>
            <input formControlName="phone" autocomplete="tel" />
          </label>
          <label>
            <span>Service</span>
            <select formControlName="service">
              <option *ngFor="let service of content.services" [value]="service.name">{{ service.name }}</option>
            </select>
          </label>
          <label>
            <span>Branch</span>
            <select formControlName="branch">
              <option *ngFor="let branch of content.branches" [value]="branch">{{ branch }}</option>
            </select>
          </label>
          <label>
            <span>Preferred date</span>
            <input type="date" formControlName="preferredDate" [min]="minDate" />
          </label>
          <button type="submit">Create visit plan</button>
        </form>

        <article class="visit-plan" *ngIf="visitPlan() as plan">
          <span>Visit plan ready</span>
          <strong>{{ plan.service }}</strong>
          <p>{{ plan.name }} at {{ plan.branch }} on {{ plan.preferredDate }}. Callback: {{ plan.phone }}</p>
          <a [href]="content.hero.whatsappLink" target="_blank" rel="noreferrer">Send on WhatsApp</a>
        </article>
      </section>
    </main>
  `,
  styles: [`
    :host {
      display: block;
      min-height: 100vh;
      background: #f4efe8;
      color: #16191f;
    }

    .salon-website {
      min-width: 320px;
      overflow: hidden;
      background:
        linear-gradient(180deg, #f4efe8 0%, #f8f6f0 46%, #eef5f2 100%);
    }

    .salon-hero {
      position: relative;
      isolation: isolate;
      min-height: 86vh;
      display: grid;
      grid-template-rows: auto minmax(0, 1fr) auto;
      gap: 24px;
      padding: 18px 24px 22px;
      overflow: hidden;
      background: #111918;
    }

    .salon-3d-stage,
    .hero-shade {
      position: absolute;
      inset: 0;
    }

    .salon-3d-stage {
      z-index: -2;
    }

    .salon-3d-stage canvas {
      width: 100%;
      height: 100%;
      display: block;
      touch-action: none;
    }

    .hero-shade {
      z-index: -1;
      background:
        linear-gradient(90deg, rgba(9, 14, 15, 0.86) 0%, rgba(9, 14, 15, 0.56) 42%, rgba(9, 14, 15, 0.2) 100%),
        linear-gradient(180deg, rgba(9, 14, 15, 0.4) 0%, rgba(9, 14, 15, 0.1) 42%, rgba(9, 14, 15, 0.76) 100%);
    }

    .salon-nav,
    .hero-body,
    .hero-bottom {
      position: relative;
      z-index: 1;
    }

    .salon-nav {
      min-height: 52px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 18px;
      color: #f8fbf9;
    }

    .salon-brand,
    .salon-nav-links,
    .hero-actions,
    .hero-open-row,
    .hero-bottom,
    .availability-strip {
      display: flex;
      align-items: center;
    }

    .salon-brand {
      min-width: 0;
      gap: 10px;
      text-decoration: none;
    }

    .salon-brand span {
      width: 38px;
      height: 38px;
      display: grid;
      place-items: center;
      border: 1px solid rgba(255, 255, 255, 0.28);
      border-radius: 8px;
      background: rgba(255, 255, 255, 0.12);
      color: #f5c46b;
      font-weight: 900;
    }

    .salon-brand strong {
      overflow: hidden;
      font-size: 1rem;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .salon-nav-links {
      gap: 10px;
    }

    .salon-nav-links a,
    .nav-action {
      min-height: 38px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0 13px;
      border: 1px solid rgba(255, 255, 255, 0.18);
      border-radius: 8px;
      color: #eef8f5;
      background: rgba(255, 255, 255, 0.08);
      font-weight: 800;
      text-decoration: none;
    }

    .nav-action {
      border-color: rgba(245, 196, 107, 0.52);
      color: #fff8df;
      background: rgba(245, 196, 107, 0.15);
    }

    .hero-body {
      min-height: 0;
      display: grid;
      grid-template-columns: minmax(320px, 650px) minmax(180px, 260px);
      align-items: center;
      gap: 24px;
    }

    .hero-copy {
      max-width: 650px;
      color: #f8fbf9;
    }

    .hero-eyebrow,
    .section-heading span,
    .booking-copy span,
    .service-card span,
    .zone-card span,
    .visit-plan span {
      display: block;
      color: #bd8a2d;
      font-size: 0.78rem;
      font-weight: 900;
      letter-spacing: 0;
      text-transform: uppercase;
    }

    .hero-copy h1 {
      max-width: 720px;
      margin: 10px 0 14px;
      font-size: 4.1rem;
      line-height: 1.02;
      letter-spacing: 0;
    }

    .hero-copy p {
      max-width: 590px;
      margin: 0;
      color: #dce9e3;
      font-size: 1.08rem;
      line-height: 1.65;
    }

    .hero-actions {
      flex-wrap: wrap;
      gap: 11px;
      margin-top: 24px;
    }

    .primary-cta,
    .secondary-cta,
    .visit-form button,
    .visit-plan a,
    .availability-strip a {
      min-height: 46px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0 18px;
      border: 1px solid transparent;
      border-radius: 8px;
      font-weight: 900;
      text-decoration: none;
      white-space: nowrap;
    }

    .primary-cta,
    .visit-form button,
    .visit-plan a,
    .availability-strip a {
      color: #101817;
      background: #f5c46b;
      box-shadow: 0 14px 34px rgba(0, 0, 0, 0.18);
    }

    .secondary-cta {
      border-color: rgba(255, 255, 255, 0.24);
      color: #f8fbf9;
      background: rgba(255, 255, 255, 0.1);
    }

    .secondary-cta.dark {
      border-color: rgba(19, 28, 27, 0.18);
      color: #15201f;
      background: rgba(255, 255, 255, 0.76);
    }

    .hero-open-row {
      flex-wrap: wrap;
      gap: 10px;
      margin-top: 16px;
      color: #dce9e3;
      font-size: 0.9rem;
      font-weight: 800;
    }

    .hero-open-row span,
    .metric-tile,
    .scene-switcher,
    .service-card,
    .zone-card,
    .visit-form,
    .visit-plan {
      border: 1px solid rgba(255, 255, 255, 0.16);
      border-radius: 8px;
      background: rgba(255, 255, 255, 0.1);
      backdrop-filter: blur(18px);
    }

    .hero-open-row span {
      min-height: 34px;
      display: inline-flex;
      align-items: center;
      padding: 0 11px;
    }

    .scene-switcher {
      justify-self: end;
      width: min(230px, 100%);
      display: grid;
      gap: 8px;
      padding: 8px;
    }

    .scene-switcher button {
      min-height: 42px;
      border: 0;
      border-radius: 6px;
      color: #dce9e3;
      background: transparent;
      font-weight: 900;
      text-align: left;
    }

    .scene-switcher button.active {
      color: #111918;
      background: #f5c46b;
    }

    .hero-bottom {
      gap: 10px;
      overflow-x: auto;
      padding-bottom: 2px;
    }

    .metric-tile {
      min-width: 168px;
      display: grid;
      gap: 4px;
      padding: 12px 14px;
      color: #eef8f5;
    }

    .metric-tile span,
    .metric-tile small {
      color: #c7d8d3;
      font-size: 0.77rem;
    }

    .metric-tile strong {
      font-size: 1.45rem;
      line-height: 1.1;
    }

    .availability-strip {
      width: min(1180px, calc(100% - 32px));
      min-height: 76px;
      gap: 12px;
      flex-wrap: wrap;
      margin: -1px auto 0;
      padding: 14px 0 8px;
      color: #22302f;
    }

    .availability-strip strong {
      margin-right: 4px;
      font-size: 1rem;
    }

    .availability-strip span {
      min-height: 34px;
      display: inline-flex;
      align-items: center;
      padding: 0 11px;
      border: 1px solid rgba(15, 118, 110, 0.14);
      border-radius: 8px;
      background: #ffffff;
      color: #51615d;
      font-weight: 800;
    }

    .availability-strip a {
      margin-left: auto;
      box-shadow: none;
    }

    .salon-section,
    .booking-band {
      width: min(1180px, calc(100% - 32px));
      margin: 0 auto;
      padding: 48px 0;
    }

    .section-heading {
      max-width: 710px;
      margin-bottom: 22px;
    }

    .section-heading h2,
    .booking-copy h2 {
      margin: 8px 0 10px;
      color: #17201f;
      font-size: 2rem;
      line-height: 1.14;
      letter-spacing: 0;
    }

    .section-heading p,
    .booking-copy p,
    .service-card p,
    .zone-card p,
    .visit-plan p {
      margin: 0;
      color: #53625f;
      line-height: 1.6;
    }

    .service-grid,
    .experience-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 14px;
    }

    .service-card,
    .zone-card {
      min-height: 220px;
      display: grid;
      align-content: space-between;
      gap: 18px;
      border-color: rgba(15, 118, 110, 0.13);
      padding: 18px;
      background: rgba(255, 255, 255, 0.88);
      color: #17201f;
      backdrop-filter: none;
      box-shadow: 0 16px 42px rgba(15, 23, 42, 0.08);
    }

    .service-card h3,
    .zone-card h3 {
      margin: 8px 0 10px;
      font-size: 1.18rem;
      line-height: 1.25;
      letter-spacing: 0;
    }

    .service-card strong {
      color: #0f766e;
      font-size: 1.05rem;
    }

    .experience-section {
      border-top: 1px solid rgba(15, 118, 110, 0.1);
    }

    .zone-card {
      min-height: 190px;
      background:
        linear-gradient(145deg, rgba(255, 255, 255, 0.95), rgba(235, 246, 241, 0.82));
    }

    .booking-band {
      display: grid;
      grid-template-columns: minmax(280px, 0.7fr) minmax(320px, 1fr);
      gap: 18px;
      align-items: start;
      padding-bottom: 64px;
    }

    .booking-copy {
      padding: 22px 0;
    }

    .visit-form {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px;
      border-color: rgba(15, 118, 110, 0.13);
      padding: 18px;
      background: rgba(255, 255, 255, 0.9);
      backdrop-filter: none;
      box-shadow: 0 18px 46px rgba(15, 23, 42, 0.08);
    }

    .visit-form label {
      min-width: 0;
      display: grid;
      gap: 6px;
    }

    .visit-form label span {
      color: #566663;
      font-size: 0.78rem;
      font-weight: 900;
    }

    .visit-form input,
    .visit-form select {
      width: 100%;
      min-height: 44px;
      border: 1px solid rgba(15, 118, 110, 0.18);
      border-radius: 8px;
      padding: 0 12px;
      color: #17201f;
      background: #ffffff;
    }

    .visit-form button {
      grid-column: 1 / -1;
      width: 100%;
      border: 0;
      cursor: pointer;
      box-shadow: none;
    }

    .visit-form button:disabled {
      opacity: 0.62;
    }

    .visit-plan {
      grid-column: 2;
      border-color: rgba(15, 118, 110, 0.13);
      padding: 18px;
      background: #ffffff;
      backdrop-filter: none;
      box-shadow: 0 18px 46px rgba(15, 23, 42, 0.08);
    }

    .visit-plan strong {
      display: block;
      margin: 8px 0;
      color: #17201f;
      font-size: 1.15rem;
    }

    .visit-plan a {
      width: fit-content;
      margin-top: 14px;
      box-shadow: none;
    }

    @media (max-width: 980px) {
      .salon-hero {
        min-height: 86vh;
      }

      .hero-body,
      .booking-band {
        grid-template-columns: 1fr;
      }

      .hero-copy h1 {
        font-size: 3.15rem;
      }

      .scene-switcher {
        justify-self: start;
        width: min(360px, 100%);
        grid-template-columns: repeat(3, minmax(0, 1fr));
      }

      .scene-switcher button {
        text-align: center;
      }

      .service-grid,
      .experience-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }

      .visit-plan {
        grid-column: auto;
      }
    }

    @media (max-width: 640px) {
      .salon-hero {
        min-height: 86vh;
        gap: 14px;
        padding: 14px;
      }

      .salon-nav {
        align-items: flex-start;
      }

      .salon-nav-links {
        display: none;
      }

      .salon-brand strong {
        max-width: 170px;
      }

      .hero-copy h1 {
        font-size: 2.45rem;
      }

      .hero-copy p {
        font-size: 0.98rem;
        line-height: 1.55;
      }

      .hero-actions,
      .hero-open-row,
      .availability-strip {
        align-items: stretch;
      }

      .primary-cta,
      .secondary-cta,
      .availability-strip a {
        width: 100%;
      }

      .hero-open-row span {
        width: 100%;
      }

      .hero-bottom {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        overflow: visible;
      }

      .metric-tile {
        min-width: 0;
      }

      .availability-strip {
        width: calc(100% - 28px);
        display: grid;
        grid-template-columns: 1fr;
      }

      .availability-strip a {
        margin-left: 0;
      }

      .salon-section,
      .booking-band {
        width: calc(100% - 28px);
        padding: 34px 0;
      }

      .section-heading h2,
      .booking-copy h2 {
        font-size: 1.55rem;
      }

      .service-grid,
      .experience-grid,
      .visit-form {
        grid-template-columns: 1fr;
      }

      .service-card,
      .zone-card {
        min-height: 0;
      }
    }
  `]
})
export class Salon3dWebsiteComponent implements AfterViewInit, OnDestroy {
  @ViewChild('sceneCanvas', { static: true }) private readonly sceneCanvas?: ElementRef<HTMLCanvasElement>;

  private readonly fb = inject(NonNullableFormBuilder);
  readonly content = inject(SalonWebsiteContentService).content();
  readonly minDate = this.today();
  readonly activeMode = signal<SalonSceneModeId>('lounge');
  readonly visitPlan = signal<VisitPlan | null>(null);

  readonly visitForm = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    phone: ['', [Validators.required, Validators.pattern(/^[0-9+\-\s()]{8,18}$/)]],
    service: [this.content.services[0]?.name || '', Validators.required],
    branch: [this.content.branches[0] || '', Validators.required],
    preferredDate: [this.defaultDate(), Validators.required]
  });

  private renderer: THREE.WebGLRenderer | null = null;
  private scene: THREE.Scene | null = null;
  private camera: THREE.PerspectiveCamera | null = null;
  private salonGroup: THREE.Group | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private animationFrameId = 0;
  private readonly targetCameraPosition = new THREE.Vector3(0, 3.1, 8.8);
  private readonly targetLookAt = new THREE.Vector3(0, 1.25, -0.4);
  private readonly currentLookAt = new THREE.Vector3(0, 1.25, -0.4);
  private readonly pointerTarget = new THREE.Vector2(0, 0);
  private readonly clock = new THREE.Clock();

  ngAfterViewInit(): void {
    this.initScene();
  }

  ngOnDestroy(): void {
    cancelAnimationFrame(this.animationFrameId);
    this.resizeObserver?.disconnect();
    this.disposeScene();
  }

  selectSceneMode(mode: SalonSceneMode): void {
    this.activeMode.set(mode.id);
    this.targetCameraPosition.set(mode.camera[0], mode.camera[1], mode.camera[2]);
    this.targetLookAt.set(mode.lookAt[0], mode.lookAt[1], mode.lookAt[2]);
  }

  trackPointer(event: PointerEvent): void {
    const host = event.currentTarget as HTMLElement;
    const rect = host.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    this.pointerTarget.set(
      ((event.clientX - rect.left) / rect.width - 0.5) * 0.34,
      ((event.clientY - rect.top) / rect.height - 0.5) * 0.22
    );
  }

  resetPointer(): void {
    this.pointerTarget.set(0, 0);
  }

  createVisitPlan(): void {
    if (this.visitForm.invalid) {
      this.visitForm.markAllAsTouched();
      return;
    }
    const value = this.visitForm.getRawValue();
    this.visitPlan.set({
      name: value.name,
      phone: value.phone,
      service: value.service,
      branch: value.branch,
      preferredDate: value.preferredDate
    });
  }

  private initScene(): void {
    const canvas = this.sceneCanvas?.nativeElement;
    if (!canvas) return;

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#111918');
    this.scene.fog = new THREE.Fog('#111918', 9, 19);

    this.camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
    this.camera.position.copy(this.targetCameraPosition);

    this.addLighting(this.scene);
    this.salonGroup = this.createSalonInterior();
    this.scene.add(this.salonGroup);

    this.resizeObserver = new ResizeObserver(() => this.resizeScene());
    this.resizeObserver.observe(canvas.parentElement || canvas);
    this.resizeScene();
    this.animate();
  }

  private animate = (): void => {
    const renderer = this.renderer;
    const scene = this.scene;
    const camera = this.camera;
    if (!renderer || !scene || !camera) return;

    const elapsed = this.clock.getElapsedTime();
    camera.position.lerp(this.targetCameraPosition, 0.035);
    this.currentLookAt.lerp(this.targetLookAt, 0.045);
    camera.lookAt(this.currentLookAt);

    if (this.salonGroup) {
      this.salonGroup.rotation.y += (this.pointerTarget.x - this.salonGroup.rotation.y) * 0.035;
      this.salonGroup.rotation.x += (-this.pointerTarget.y - this.salonGroup.rotation.x) * 0.025;
      this.salonGroup.position.y = Math.sin(elapsed * 0.55) * 0.025;
    }

    scene.traverse((object) => {
      if (object.userData['pulse'] === true) {
        object.rotation.y += 0.006;
      }
    });

    renderer.render(scene, camera);
    this.animationFrameId = requestAnimationFrame(this.animate);
  };

  private resizeScene(): void {
    const renderer = this.renderer;
    const camera = this.camera;
    if (!renderer || !camera) return;
    const canvas = renderer.domElement;
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(1, Math.floor(rect.width || canvas.clientWidth || 1));
    const height = Math.max(1, Math.floor(rect.height || canvas.clientHeight || 1));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  private addLighting(scene: THREE.Scene): void {
    scene.add(new THREE.HemisphereLight('#fff3d3', '#14302c', 1.6));

    const keyLight = new THREE.DirectionalLight('#ffe4b2', 3.4);
    keyLight.position.set(-4, 7, 5);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(2048, 2048);
    keyLight.shadow.camera.near = 1;
    keyLight.shadow.camera.far = 18;
    scene.add(keyLight);

    const fillLight = new THREE.PointLight('#66f0d3', 1.9, 9);
    fillLight.position.set(4.5, 3.1, 1.8);
    scene.add(fillLight);

    const warmLight = new THREE.PointLight('#f5c46b', 2.2, 7);
    warmLight.position.set(-2.6, 3.5, -3.2);
    scene.add(warmLight);
  }

  private createSalonInterior(): THREE.Group {
    const group = new THREE.Group();
    const floor = this.material('#d9d0c1', 0.8);
    const wall = this.material('#2d3936', 0.72);
    const teal = this.material('#0f766e', 0.48);
    const brass = this.material('#c99637', 0.36, 0.35);
    const charcoal = this.material('#171f20', 0.55);
    const rose = this.material('#aa5b68', 0.62);
    const cream = this.material('#efe4d0', 0.78);
    const glass = new THREE.MeshPhysicalMaterial({
      color: '#c3e2df',
      metalness: 0.1,
      roughness: 0.18,
      transmission: 0.24,
      transparent: true,
      opacity: 0.72
    });

    const floorMesh = this.addMesh(group, new THREE.PlaneGeometry(14, 12), floor, [0, -0.02, 0], [-Math.PI / 2, 0, 0]);
    floorMesh.receiveShadow = true;
    this.addMesh(group, new THREE.PlaneGeometry(5.5, 2.2), this.material('#b58a58', 0.88), [0, 0.02, 2.2], [-Math.PI / 2, 0, 0]);

    this.addBox(group, 14, 4.8, 0.22, [0, 2.35, -5.9], wall);
    this.addBox(group, 0.22, 4.8, 12, [-7, 2.35, 0], this.material('#263532', 0.74));
    this.addBox(group, 0.22, 4.8, 12, [7, 2.35, 0], this.material('#2f2828', 0.74));
    this.addBox(group, 14, 0.18, 12, [0, 4.85, 0], this.material('#161d1d', 0.82));

    for (let i = -5; i <= 5; i += 2.5) {
      this.addBox(group, 0.08, 4.3, 0.08, [i, 2.35, -5.73], brass);
    }

    this.addSign(group, [0, 3.55, -5.66]);
    this.addReception(group, brass, teal, cream);
    this.addLounge(group, teal, rose, cream, brass);
    this.addStylingStation(group, -3.9, -4.15, teal, brass, charcoal, glass);
    this.addStylingStation(group, -1.25, -4.15, rose, brass, charcoal, glass);
    this.addStylingStation(group, 1.4, -4.15, teal, brass, charcoal, glass);
    this.addShampooZone(group, cream, teal, brass);
    this.addRetailWall(group, brass, charcoal, teal, cream);
    this.addPendantLights(group, brass);
    this.addPlanters(group);

    return group;
  }

  private addReception(group: THREE.Group, brass: THREE.Material, teal: THREE.Material, cream: THREE.Material): void {
    this.addBox(group, 2.8, 0.85, 1.05, [3.9, 0.45, 1.85], cream);
    this.addBox(group, 2.55, 0.16, 0.92, [3.9, 0.95, 1.85], brass);
    this.addBox(group, 1.05, 0.08, 0.28, [3.92, 1.16, 1.27], teal);
    this.addBox(group, 2.5, 0.05, 0.18, [3.9, 0.95, 2.42], brass);
  }

  private addLounge(group: THREE.Group, teal: THREE.Material, rose: THREE.Material, cream: THREE.Material, brass: THREE.Material): void {
    this.addBox(group, 2.6, 0.55, 0.8, [-2.8, 0.35, 1.7], teal);
    this.addBox(group, 2.6, 0.85, 0.18, [-2.8, 0.75, 1.34], teal);
    this.addBox(group, 1.2, 0.46, 0.72, [-4.9, 0.31, 1.45], rose);
    this.addBox(group, 1.2, 0.72, 0.18, [-4.9, 0.67, 1.11], rose);
    this.addCylinder(group, 0.62, 0.32, [-3.5, 0.18, 2.85], brass, [0, 0, 0], 36);
    this.addCylinder(group, 0.55, 0.08, [-3.5, 0.39, 2.85], cream, [0, 0, 0], 36);
  }

  private addStylingStation(
    group: THREE.Group,
    x: number,
    z: number,
    accent: THREE.Material,
    brass: THREE.Material,
    charcoal: THREE.Material,
    glass: THREE.Material
  ): void {
    this.addMesh(group, new THREE.PlaneGeometry(1.55, 1.85), glass, [x, 2.18, -5.62]);
    this.addBox(group, 1.78, 0.08, 0.09, [x, 1.16, -5.51], brass);
    this.addBox(group, 1.64, 0.44, 0.42, [x, 0.65, -5.26], charcoal);
    this.addSalonChair(group, [x, 0.15, z + 0.95], accent, brass, charcoal);
  }

  private addSalonChair(group: THREE.Group, position: Vec3, accent: THREE.Material, brass: THREE.Material, charcoal: THREE.Material): void {
    const [x, y, z] = position;
    this.addCylinder(group, 0.48, 0.16, [x, y + 0.54, z], accent, [0, 0, 0], 42);
    this.addBox(group, 0.9, 0.85, 0.2, [x, y + 0.98, z - 0.42], accent);
    this.addBox(group, 0.18, 0.28, 0.72, [x - 0.56, y + 0.74, z], accent);
    this.addBox(group, 0.18, 0.28, 0.72, [x + 0.56, y + 0.74, z], accent);
    this.addCylinder(group, 0.1, 0.72, [x, y + 0.2, z], brass, [0, 0, 0], 26);
    this.addCylinder(group, 0.42, 0.08, [x, y + 0.02, z], charcoal, [0, 0, 0], 36);
    this.addBox(group, 0.56, 0.08, 0.2, [x, y + 0.3, z + 0.56], brass);
  }

  private addShampooZone(group: THREE.Group, cream: THREE.Material, teal: THREE.Material, brass: THREE.Material): void {
    this.addBox(group, 1.7, 0.54, 0.95, [-5.6, 0.35, -2.55], teal);
    this.addBox(group, 0.95, 0.28, 0.58, [-5.6, 0.78, -3.02], cream);
    this.addCylinder(group, 0.24, 0.18, [-5.6, 1.0, -3.05], this.material('#f7f1e7', 0.24), [Math.PI / 2, 0, 0], 28);
    this.addCylinder(group, 0.06, 0.56, [-5.05, 0.95, -3.08], brass, [Math.PI / 2, 0, 0], 18);
  }

  private addRetailWall(group: THREE.Group, brass: THREE.Material, charcoal: THREE.Material, teal: THREE.Material, cream: THREE.Material): void {
    for (let y = 1.0; y <= 2.8; y += 0.62) {
      this.addBox(group, 2.35, 0.08, 0.28, [5.55, y, -4.65], brass);
    }
    this.addBox(group, 2.55, 2.4, 0.08, [5.55, 1.92, -4.85], charcoal);
    const bottleMaterials = [teal, cream, this.material('#8a5871', 0.58), this.material('#ecd28d', 0.42)];
    let index = 0;
    for (let row = 0; row < 4; row += 1) {
      for (let col = 0; col < 5; col += 1) {
        const x = 4.65 + col * 0.45;
        const y = 1.14 + row * 0.62;
        const bottle = this.addCylinder(group, 0.08, 0.3, [x, y, -4.46], bottleMaterials[index % bottleMaterials.length], [0, 0, 0], 18);
        bottle.userData['pulse'] = row === 3 && col === 2;
        index += 1;
      }
    }
  }

  private addPendantLights(group: THREE.Group, brass: THREE.Material): void {
    for (const x of [-3.2, 0, 3.2]) {
      this.addCylinder(group, 0.04, 1.1, [x, 4.18, -1.05], brass, [0, 0, 0], 16);
      const shade = this.addCylinder(group, 0.34, 0.3, [x, 3.52, -1.05], this.material('#f5c46b', 0.28, 0.2), [0, 0, 0], 36);
      shade.userData['pulse'] = true;
      const light = new THREE.PointLight('#ffd895', 1.35, 4);
      light.position.set(x, 3.3, -1.05);
      group.add(light);
    }
  }

  private addPlanters(group: THREE.Group): void {
    const pot = this.material('#6f5546', 0.62);
    const leaf = this.material('#2d7d58', 0.78);
    for (const position of [[-6.1, 0.2, 3.4], [6.0, 0.2, 3.2]] as const) {
      this.addCylinder(group, 0.34, 0.42, position, pot, [0, 0, 0], 26);
      this.addBox(group, 0.18, 0.9, 0.08, [position[0], 0.86, position[2]], leaf, [0, 0, 0.52]);
      this.addBox(group, 0.18, 0.78, 0.08, [position[0] + 0.15, 0.78, position[2] - 0.06], leaf, [0, 0, -0.68]);
      this.addBox(group, 0.18, 0.72, 0.08, [position[0] - 0.18, 0.76, position[2] + 0.04], leaf, [0, 0, 0.18]);
    }
  }

  private addSign(group: THREE.Group, position: Vec3): void {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 256;
    const context = canvas.getContext('2d');
    if (!context) return;
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = 'rgba(10, 18, 18, 0.68)';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.strokeStyle = '#f5c46b';
    context.lineWidth = 9;
    context.strokeRect(26, 26, canvas.width - 52, canvas.height - 52);
    context.fillStyle = '#fff4d8';
    context.font = '900 96px Arial';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText('AURASHINE', canvas.width / 2, 108);
    context.fillStyle = '#8ae5d6';
    context.font = '700 34px Arial';
    context.fillText('LUXE SALON', canvas.width / 2, 174);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(3.8, 0.95),
      new THREE.MeshBasicMaterial({ map: texture, transparent: true })
    );
    sign.position.set(position[0], position[1], position[2]);
    group.add(sign);
  }

  private addBox(parent: THREE.Object3D, width: number, height: number, depth: number, position: Vec3, material: THREE.Material, rotation: Vec3 = [0, 0, 0]): THREE.Mesh {
    return this.addMesh(parent, new THREE.BoxGeometry(width, height, depth), material, position, rotation);
  }

  private addCylinder(parent: THREE.Object3D, radius: number, height: number, position: Vec3, material: THREE.Material, rotation: Vec3 = [0, 0, 0], segments = 32): THREE.Mesh {
    return this.addMesh(parent, new THREE.CylinderGeometry(radius, radius, height, segments), material, position, rotation);
  }

  private addMesh(parent: THREE.Object3D, geometry: THREE.BufferGeometry, material: THREE.Material, position: Vec3, rotation: Vec3 = [0, 0, 0]): THREE.Mesh {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(position[0], position[1], position[2]);
    mesh.rotation.set(rotation[0], rotation[1], rotation[2]);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  private material(color: string, roughness: number, metalness = 0): THREE.MeshStandardMaterial {
    return new THREE.MeshStandardMaterial({ color, roughness, metalness });
  }

  private disposeScene(): void {
    this.scene?.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.geometry.dispose();
        this.disposeMaterial(object.material);
      }
    });
    this.renderer?.dispose();
    this.renderer = null;
    this.scene = null;
    this.camera = null;
    this.salonGroup = null;
  }

  private disposeMaterial(material: THREE.Material | THREE.Material[]): void {
    if (Array.isArray(material)) {
      material.forEach((item) => item.dispose());
      return;
    }
    material.dispose();
  }

  private today(): string {
    return new Date().toISOString().slice(0, 10);
  }

  private defaultDate(): string {
    const date = new Date();
    date.setDate(date.getDate() + 1);
    return date.toISOString().slice(0, 10);
  }
}
