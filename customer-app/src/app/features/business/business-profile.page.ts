import { Component, OnDestroy, OnInit, computed, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";
import { IonBackButton, IonButton, IonContent, IonIcon } from "@ionic/angular/standalone";
import { addIcons } from "ionicons";
import {
  callOutline,
  bookmark,
  bookmarkOutline,
  cardOutline,
  checkmarkCircleOutline,
  clipboardOutline,
  closeCircleOutline,
  heart,
  heartOutline,
  locationOutline,
  navigateOutline,
  peopleOutline,
  pricetagOutline,
  ribbonOutline,
  searchOutline,
  shareOutline,
  sparklesOutline,
  starOutline,
  timeOutline,
  walletOutline,
  listOutline
} from "ionicons/icons";
import { PublicOfferItem, ServiceItem, StaffMember } from "../../core/api.types";
import { CustomerFeedbackService } from "../../core/customer-feedback.service";
import { MarketplaceService } from "../../core/marketplace.service";
import { Subscription } from "rxjs";

@Component({
  standalone: true,
  imports: [FormsModule, RouterLink, IonBackButton, IonButton, IonContent, IonIcon],
  template: `
    <ion-content>
      @if (business(); as b) {
       <main class="profile-page" [class.salon-mode-profile]="salonModeRoute()">
        <section class="cover" [class.cover--placeholder]="!hasCoverPhoto()">
          <ion-back-button class="cover-back-button" [defaultHref]="backHref()"></ion-back-button>
          @if (hasCoverPhoto()) {
            <img [src]="coverPhoto()" [alt]="b.businessName + ' cover photo'" />
          } @else {
            <div class="cover-placeholder" [style.background]="coverGradientStyle()" role="img" [attr.aria-label]="b.businessName + ' cover placeholder'">
              <span class="cover-monogram" aria-hidden="true">{{ initials(b.businessName) }}</span>
            </div>
          }
          <div class="cover-overlay"></div>
          <div class="cover-actions">
            <ion-button fill="clear" shape="round" [class.saved-action]="isSaved()" [disabled]="favoritePending" [attr.aria-label]="isSaved() ? 'Remove from wishlist' : 'Save to wishlist'" (click)="toggleWishlist()">
              <ion-icon [name]="isSaved() ? 'heart' : 'heart-outline'"></ion-icon>
            </ion-button>
            <ion-button fill="clear" shape="round" [class.saved-action]="isSalonSaved()" [disabled]="savedSalonPending" [attr.aria-label]="isSalonSaved() ? 'Remove saved salon' : 'Save salon'" (click)="toggleSavedSalon()">
              <ion-icon [name]="isSalonSaved() ? 'bookmark' : 'bookmark-outline'"></ion-icon>
            </ion-button>
          </div>
          <div class="cover-copy">
            <div class="hero-business-name" role="heading" aria-level="1">{{ b.businessName }}</div>
            @if (b.area || b.city) {
              <p>{{ b.area }}{{ b.area && b.city ? ', ' : '' }}{{ b.city }}</p>
            }
          </div>
        </section>

        <section class="app-container profile-shell">
          <div class="main-column">
            <section class="intro premium-card">
              @if (b.area || b.city || b.description) {
                <div>
                  @if (b.area || b.city) {
                    <p class="eyebrow">{{ b.area }}{{ b.area && b.city ? ', ' : '' }}{{ b.city }}</p>
                  }
                  @if (b.description) {
                    <h2>{{ b.description }}</h2>
                  }
                </div>
              }

              <div class="quick-actions" role="group" aria-label="Salon quick actions">
                <button type="button" class="quick-action" [disabled]="!phoneHref()" (click)="callSalon()">
                  <ion-icon name="call-outline" aria-hidden="true"></ion-icon> Call
                </button>
                <a class="quick-action" [href]="b.mapsUrl || undefined" target="_blank" rel="noopener">
                  <ion-icon name="navigate-outline" aria-hidden="true"></ion-icon> Directions
                </a>
                <button type="button" class="quick-action" (click)="shareBusiness()">
                  <ion-icon name="share-outline" aria-hidden="true"></ion-icon> Share
                </button>
              </div>

              <div class="hero-meta" aria-label="Salon status summary">
                <span class="hero-meta-item" [class.closed]="!b.isOpen">
                  <ion-icon name="time-outline" aria-hidden="true"></ion-icon>
                  <strong>{{ b.isOpen ? "Open now" : "Closed now" }}</strong>
                </span>
                @if (hasRating()) {
                  <button type="button" class="hero-meta-item hero-meta-rating" [attr.aria-label]="'Rated ' + b.ratingAverage + ', view ' + b.ratingCount + ' reviews'" (click)="scrollToSection('reviews')">
                    <ion-icon name="star-outline" aria-hidden="true"></ion-icon>
                    <strong>{{ b.ratingAverage }}</strong>
                    <span>{{ b.ratingCount }} reviews</span>
                  </button>
                } @else {
                  <span class="hero-meta-item">
                    <ion-icon name="sparkles-outline" aria-hidden="true"></ion-icon>
                    <strong>New</strong>
                  </span>
                }
                <span class="hero-meta-item">
                  <ion-icon name="location-outline" aria-hidden="true"></ion-icon>
                  <strong>{{ locationSummary() }}</strong>
                </span>
                <span class="hero-meta-item">
                  <ion-icon name="time-outline" aria-hidden="true"></ion-icon>
                  <strong>{{ todayHoursLabel() }}</strong>
                </span>
              </div>

              @if (isAuthenticated() && !marketplace.salonMode()) {
                <div class="primary-salon-strip">
                  @if (isPrimarySalon()) {
                    <div>
                      <strong>Your primary salon</strong>
                      <span>Get faster booking, personalised offers, memberships and salon rewards.</span>
                    </div>
                    <div class="primary-salon-actions">
                      <a class="primary-salon-action secondary" [routerLink]="mySalonHref()">
                        <ion-icon name="sparkles-outline" aria-hidden="true"></ion-icon> Open My Salon
                      </a>
                      <button type="button" class="primary-salon-link" (click)="removeAsPrimary()">Change</button>
                    </div>
                  } @else {
                    <div>
                      <strong>Make this your primary salon</strong>
                      <span>Get faster booking, personalised offers, memberships and salon rewards.</span>
                    </div>
                    <button type="button" class="primary-salon-action" (click)="setAsPrimary()">Set primary</button>
                  }
                </div>
              }
              <div class="trust-row">
                <span><ion-icon name="sparkles-outline"></ion-icon>{{ b.services.length }} services</span>
                <span><ion-icon name="people-outline"></ion-icon>{{ b.staff.length }} professionals</span>
                <span><ion-icon name="time-outline"></ion-icon>{{ b.hoursLabel || "Hours published" }}</span>
                <span><ion-icon name="card-outline"></ion-icon>{{ paymentLabel() }}</span>
              </div>
            </section>

            <nav class="page-section-nav" role="tablist" aria-label="Salon sections">
              <button
                type="button"
                role="tab"
                [class.active]="activeProfileTab() === 'services'"
                [attr.aria-selected]="activeProfileTab() === 'services'"
                (click)="activeProfileTab.set('services')">
                Services
              </button>
              <button
                type="button"
                role="tab"
                [class.active]="activeProfileTab() === 'team'"
                [attr.aria-selected]="activeProfileTab() === 'team'"
                (click)="activeProfileTab.set('team')">
                Team
              </button>
              <button
                type="button"
                role="tab"
                [class.active]="activeProfileTab() === 'reviews'"
                [attr.aria-selected]="activeProfileTab() === 'reviews'"
                (click)="activeProfileTab.set('reviews')">
                Reviews
              </button>
              <button
                type="button"
                role="tab"
                [class.active]="activeProfileTab() === 'about'"
                [attr.aria-selected]="activeProfileTab() === 'about'"
                (click)="activeProfileTab.set('about')">
                About
              </button>
            </nav>

            @if (activeProfileTab() === 'services') {
              <section class="services-section section-anchor" id="services">
                <div class="section-heading">
                  <div>
                    <h2 class="section-title">
                      Services @if (b.services.length) { <span class="section-title-count">· {{ b.services.length }}</span> }
                    </h2>
                  </div>
                  @if (serviceQuery() || selectedCategory()) {
                    <button type="button" class="clear-filter-text-btn" (click)="clearServiceFilters()">Show all</button>
                  }
                </div>

                <div class="service-search-box">
                  <ion-icon name="search-outline" class="search-icon" aria-hidden="true"></ion-icon>
                  <input
                    type="text"
                    class="service-search-input"
                    [ngModel]="serviceQuery()"
                    (ngModelChange)="serviceQuery.set($event)"
                    placeholder="Search services"
                    aria-label="Search salon services" />
                  @if (serviceQuery()) {
                    <button type="button" class="clear-search-btn" (click)="serviceQuery.set('')" aria-label="Clear search">
                      <ion-icon name="close-circle-outline" aria-hidden="true"></ion-icon>
                    </button>
                  }
                </div>

                <div class="service-stack">
                  @for (service of paginatedServices(); track service.id) {
                    <article
                      class="salon-service-item service-card premium-card"
                      [class.is-picked]="isServiceSelected(service.id)"
                      [class.selected]="isServiceSelected(service.id)"
                      role="button"
                      tabindex="0"
                      (click)="openServicePopup(service.id)"
                      (keydown.enter)="openServicePopup(service.id)">
                      <div class="salon-service-copy">
                        <span class="service-title-row">
                          <strong class="service-name">{{ formatServiceName(service.name) }}</strong>
                          @if (service.popular) { <span class="offer-pill">Popular</span> }
                          @if (service.durationMinutes >= 120) { <span class="offer-pill extended">Extended visit</span> }
                        </span>
                        <span class="service-price-row">
                          <strong>{{ money(service.pricePaise) }}</strong>
                          <span>{{ service.durationMinutes || 0 }} min</span>
                        </span>
                        <span class="service-desc">{{ serviceDescription(service) }}</span>
                        <span class="service-eligibility">{{ eligibleStaffLabel(service) }}</span>
                      </div>
                      <div class="salon-service-action">
                        @if (serviceImage(service, $index)) {
                          <div class="salon-service-thumb" [style.background-image]="serviceImageBackground(service, $index)" role="img" [attr.aria-label]="service.name + ' service image'"></div>
                        } @else {
                          <div class="salon-service-thumb salon-service-thumb--letter" role="img" [attr.aria-label]="service.name">
                            <span aria-hidden="true">{{ serviceInitial(service.name) }}</span>
                          </div>
                        }
                        <button
                          type="button"
                          class="salon-service-add"
                          [class.selected]="isServiceSelected(service.id)"
                          [attr.aria-label]="isServiceSelected(service.id) ? 'Remove service' : 'Add service'"
                          (click)="$event.stopPropagation(); openServicePopup(service.id)">
                          @if (isServiceSelected(service.id)) {
                            <ion-icon name="checkmark-circle-outline" aria-hidden="true"></ion-icon> Added
                          } @else {
                            Add
                          }
                        </button>
                      </div>
                    </article>
                  } @empty {
                    <section class="state-card premium-card service-empty-card">
                      <div class="empty-icon"><ion-icon name="search-outline" aria-hidden="true"></ion-icon></div>
                      <h3>No services found</h3>
                      <p>No services match "{{ serviceQuery() }}"{{ selectedCategory() ? ' in ' + categoryLabel(selectedCategory()) : '' }}.</p>
                      <button type="button" class="reset-search-btn" (click)="clearServiceFilters()">Clear search</button>
                    </section>
                  }
                </div>

                @if (paginatedServices().length < filteredServices().length) {
                  <button type="button" class="show-more-btn" (click)="showMoreServices()">
                    Show more services · {{ filteredServices().length - paginatedServices().length }} more
                  </button>
                }
              </section>

              @if (activeOffers().length) {
                <section class="offers-section">
                  <div class="section-heading">
                    <div>
                      <h2 class="section-title">Special offers & discounts</h2>
                    </div>
                  </div>
                  <div class="offers-stack">
                    @for (offer of activeOffers(); track offer.id) {
                      <article class="offer-card premium-card" [class.coupon-offer]="offer.type === 'coupon'" [class.rule-offer]="offer.type === 'discount_rule'" [class.promo-offer]="offer.type === 'calendar_promotion'">
                        <div class="offer-icon">
                          @if (offer.type === 'coupon') {
                            <ion-icon name="pricetag-outline"></ion-icon>
                          } @else if (offer.type === 'discount_rule') {
                            <ion-icon name="clipboard-outline"></ion-icon>
                          } @else {
                            <ion-icon name="time-outline"></ion-icon>
                          }
                        </div>
                        <div class="offer-body">
                          <strong>{{ offer.title }}</strong>
                          <span class="offer-summary">{{ offerSummary(offer) }}</span>
                          @if (offer.type === 'coupon') {
                            <code class="coupon-code">{{ offer.code }}</code>
                          }
                          @if (offerValidity(offer); as validity) {
                            <small class="offer-validity">Valid {{ validity.from }} – {{ validity.to }}</small>
                          }
                        </div>
                      </article>
                    }
                  </div>
                </section>
              }
            }

            @if (activeProfileTab() === 'team') {
              <section class="staff-section section-anchor" id="team">
                <div class="section-heading">
                  <div>
                    <h2 class="section-title">Our professional team ({{ b.staff.length }})</h2>
                    <p class="muted">Skilled stylists, therapists & beauticians</p>
                  </div>
                </div>
                <div class="staff-grid">
                  @for (staff of b.staff; track staff.id) {
                    <article class="staff-card premium-card">
                      @if (staff.image) {
                        <img [src]="staff.image" [alt]="staff.name" />
                      } @else {
                        <span class="staff-avatar" [style.background]="staffGradientStyle(staff)" aria-hidden="true">{{ initials(staff.name) }}</span>
                      }
                      <strong>{{ staff.name }}</strong>
                      <span>{{ staff.title }}</span>
                      <small>{{ staff.rating }} · {{ staff.specialty }}</small>
                      <em>{{ staff.nextAvailable }}</em>
                      <ion-button size="small" fill="outline" class="secondary-button" [routerLink]="businessBookLink(b.slug)" [queryParams]="staffBookingParams(staff.id)">Book with {{ staff.name.split(' ')[0] }}</ion-button>
                    </article>
                  } @empty {
                    <section class="state-card premium-card"><h2>No staff profiles published yet</h2></section>
                  }
                </div>
              </section>
            }

            @if (activeProfileTab() === 'reviews') {
              <section class="review-section section-anchor" id="reviews">
                <div class="section-heading">
                  <div>
                    <h2 class="section-title">Loved by customers</h2>
                    @if (hasRating()) {
                      <p class="muted">Rated {{ b.ratingAverage }} · {{ b.ratingCount }} verified customer reviews</p>
                    }
                  </div>
                </div>
                <div class="review-grid">
                  @for (review of b.reviews; track review.id) {
                    <article class="review-card premium-card">
                      <span class="rating-pill">Star {{ review.rating }}</span>
                      <p>{{ review.text }}</p>
                      <strong>{{ review.author }}</strong>
                      <small>{{ review.dateLabel }}</small>
                    </article>
                  } @empty {
                    <section class="state-card premium-card"><h2>No reviews yet</h2><p class="muted">Be the first to share your experience after your visit.</p></section>
                  }
                </div>
              </section>
            }

            @if (activeProfileTab() === 'about') {
              @if (b.galleryImages.length) {
                <section class="gallery-section">
                  <div class="section-heading">
                    <div>
                      <h2 class="section-title">Inside the studio</h2>
                    </div>
                  </div>
                  <div class="gallery-strip">
                    @for (image of b.galleryImages; track image) {
                      <img [src]="image" [alt]="b.businessName + ' gallery image'" loading="lazy" />
                    }
                  </div>
                </section>
              }

              @if (isAuthenticated()) {
                <section class="loyalty-section">
                  <div class="section-heading">
                    <div>
                      <h2 class="section-title">Loyalty & rewards</h2>
                    </div>
                  </div>
                  <div class="loyalty-grid">
                    <a class="loyalty-card" [routerLink]="hubLink('wallet')">
                      <ion-icon name="wallet-outline"></ion-icon>
                      <div>
                        <strong>Wallet</strong>
                        <span>View credits, balance, and payment history for this salon</span>
                      </div>
                    </a>
                    <a class="loyalty-card" [routerLink]="hubLink('rewards')">
                      <ion-icon name="ribbon-outline"></ion-icon>
                      <div>
                        <strong>Rewards</strong>
                        <span>Loyalty points, referrals, and redemption options</span>
                      </div>
                    </a>
                    <a class="loyalty-card" [routerLink]="hubLink('memberships')">
                      <ion-icon name="card-outline"></ion-icon>
                      <div>
                        <strong>Memberships</strong>
                        <span>Exclusive plans and benefits for regular customers</span>
                      </div>
                    </a>
                  </div>
                </section>
              }

              <section class="info-grid section-anchor" id="about">
                <article class="premium-card info-card">
                  <h2>Location & Address</h2>
                  <p><ion-icon name="location-outline"></ion-icon>{{ b.address }}</p>
                  @if (b.area || b.city) {
                    <span class="muted">{{ b.area }}{{ b.area && b.city ? ', ' : '' }}{{ b.city }}{{ b.postalCode ? ' ' + b.postalCode : '' }}</span>
                  }
                </article>
                <article class="premium-card info-card">
                  <h2>Working Hours</h2>
                  @for (day of b.businessHours || []; track day.day) {
                    <p class="hours-row"><strong>{{ day.label }}</strong><span>{{ day.display }}{{ day.note ? " · " + day.note : "" }}</span></p>
                  } @empty {
                    <p class="muted">{{ b.hoursLabel || "Business hours have not been published yet." }}</p>
                  }
                </article>
                <article class="premium-card info-card">
                  <h2>Contact & Social</h2>
                  @if (b.phone || b.appointmentNumber || b.mobileNumber) {
                    <p><ion-icon name="call-outline"></ion-icon>{{ b.appointmentNumber || b.mobileNumber || b.phone }}</p>
                  }
                  @if (b.websiteUrl) {
                    <p><ion-icon name="navigate-outline"></ion-icon>{{ b.websiteUrl }}</p>
                  }
                  @if (b.instagramUrl) {
                    <p><ion-icon name="sparkles-outline"></ion-icon>{{ b.instagramUrl }}</p>
                  }
                </article>
                <article class="premium-card info-card">
                  <h2>Salon Policies</h2>
                  @for (policy of b.policies || []; track policy) {
                    <p>{{ policy }}</p>
                  } @empty {
                    <p class="muted">No public policies have been published yet.</p>
                  }
                </article>
              </section>

              @if (otherBranches().length) {
                <section class="other-branches-section">
                  <div class="section-heading">
                    <div>
                      <h2 class="section-title">Other branches ({{ otherBranches().length }})</h2>
                      <p class="muted">More locations from this salon group</p>
                    </div>
                  </div>
                  <div class="other-branches-rail" aria-label="Other branches from this salon group">
                    @for (branch of otherBranches(); track branch.branchId || branch.id) {
                      <a class="branch-option" [routerLink]="businessProfileLink(branch.slug)">
                        <span class="branch-option-mark">{{ branch.businessName.slice(0, 1).toUpperCase() }}</span>
                        <span class="branch-option-copy">
                          <strong>{{ branch.businessName }}</strong>
                          <small>{{ branch.area || branch.city || 'Location details' }}</small>
                          <small>
                            {{ branch.distanceKm != null ? branch.distanceKm + " km" : "Distance not known" }} ·
                            <span [class.open]="branch.isOpen">{{ branch.isOpen ? "Open" : "Closed" }}</span>
                            @if (branch.nextAvailableSlot) { · next {{ branch.nextAvailableSlot }} }
                          </small>
                        </span>
                        <ion-icon name="location-outline"></ion-icon>
                      </a>
                    }
                  </div>
                </section>
              }
            }
          </div>

          <aside class="booking-rail premium-card">
            @if (hasRating()) {
              <span class="rating-pill">Star {{ b.ratingAverage }}</span>
            }
            @if (selectedServices().length) {
              <h2>{{ selectedServices().length }} service{{ selectedServices().length === 1 ? "" : "s" }} selected</h2>
              <p class="muted">{{ selectedServicesLabel() }}</p>
            } @else {
              <h2>Book {{ b.popularService || b.category }}</h2>
              <p class="muted">Starts from {{ money(b.startingPricePaise || 0) }}. Next available {{ b.nextAvailableSlot || "after selecting a service" }}.</p>
            }
            @if (b.hasOffer) {
              <div class="rail-offer">{{ b.offerText }}</div>
            }
            <div class="rail-row"><span><ion-icon name="time-outline"></ion-icon> Next slot</span><strong>{{ b.nextAvailableSlot || "Check availability" }}</strong></div>
            <div class="rail-row"><span><ion-icon name="time-outline"></ion-icon> Hours</span><strong>{{ b.hoursLabel || "Published" }}</strong></div>
            <div class="rail-row"><span><ion-icon name="location-outline"></ion-icon> Area</span><strong>{{ b.area }}</strong></div>
            <div class="rail-row"><span><ion-icon name="card-outline"></ion-icon> Payment</span><strong>{{ paymentLabel() }}</strong></div>
            <ion-button expand="block" size="large" class="primary-gradient" [routerLink]="businessBookLink(b.slug || b.id)" [queryParams]="bookingQueryParams()">Book now</ion-button>
          </aside>
        </section>
      </main>

      @if (selectedServices().length) {
      <div class="sticky-cta mobile-only">
        <div class="bottom-action-card">
          <div>
            @if (selectedServices().length) {
              <small class="selected-service-name">{{ selectedServices().length }} service{{ selectedServices().length === 1 ? "" : "s" }} selected</small>
              <strong>{{ selectedServicesLabel() }}</strong>
            } @else {
              <small>From {{ money(b.startingPricePaise || 0) }}</small>
              <strong>{{ b.nextAvailableSlot || "Check availability" }}</strong>
            }
          </div>
          <ion-button class="primary-gradient" [routerLink]="businessBookLink(b.slug || b.id)" [queryParams]="bookingQueryParams()">Book now</ion-button>
        </div>
      </div>
      }
      @if (activeCustomizationService(); as service) {
        <section class="service-popup-backdrop" role="dialog" aria-modal="true" aria-labelledby="service-popup-title" (click)="closeServicePopup()">
          <article class="service-popup-sheet" (click)="$event.stopPropagation()">
            <button type="button" class="service-popup-close" aria-label="Close service customisation" (click)="closeServicePopup()">×</button>
            <div class="service-popup-head">
              <div>
                <small>Customise service</small>
                <h2 id="service-popup-title">{{ service.name }}</h2>
                <strong>{{ servicePriceLabel(service) }}</strong>
              </div>
              @if (serviceImage(service, 0)) {
                <div class="service-popup-thumb" [style.background-image]="serviceImageBackground(service, 0)" aria-hidden="true"></div>
              } @else {
                <div class="service-popup-thumb service-popup-thumb--letter" aria-hidden="true"><span>{{ serviceInitial(service.name) }}</span></div>
              }
            </div>
            @if (serviceAddOns(service).length) {
              <div class="service-popup-section">
                <h3>Add-on services</h3>
                <div class="service-addon-list popup-list">
                  @for (addon of serviceAddOns(service); track addon.id || addon.name) {
                    <button type="button" class="service-addon-chip">
                      <span>{{ addon.name }}</span>
                      @if (addon.pricePaise) { <small>{{ money(addon.pricePaise) }}</small> }
                    </button>
                  }
                </div>
              </div>
            }
            <div class="service-popup-section">
              <h3>Note for salon</h3>
              <textarea
                class="service-note-input"
                rows="4"
                [ngModel]="serviceNote(service.id)"
                (ngModelChange)="setServiceNote(service.id, $event)"
                placeholder="Add preference, concern, or instruction for this service..."></textarea>
            </div>
            <button type="button" class="service-popup-add" (click)="confirmServiceAdd(service.id)">
              {{ isServiceSelected(service.id) ? "Update added service" : "Add service" }}
            </button>
          </article>
        </section>
      }
      } @else {
        <main class="page-narrow">
          @if (marketplace.loading()) {
            <section class="premium-card state-card"><h1>Loading business</h1></section>
          } @else {
            <section class="premium-card state-card error"><h1>Business unavailable</h1><p>{{ marketplace.error() || "The business profile could not be loaded." }}</p><ion-button class="primary-gradient" (click)="reload()">Retry</ion-button></section>
          }
        </main>
      }
    </ion-content>

    @if (business(); as b) {
      @if (categoryMenuOpen()) {
        <div class="category-menu-backdrop" role="presentation" (click)="categoryMenuOpen.set(false)">
          <section class="category-menu-sheet" role="dialog" aria-modal="true" aria-label="Service category menu" (click)="$event.stopPropagation()">
            <div class="category-menu-head">
              <div>
                <strong>Categories</strong>
                <span>Jump to service category</span>
              </div>
              <button type="button" (click)="categoryMenuOpen.set(false)">Close</button>
            </div>
            <div class="category-menu-list">
              <button type="button" [class.active]="!selectedCategory()" (click)="chooseCategoryFromMenu('')">
                <span>All services</span>
                <small>{{ b.services.length }}</small>
              </button>
              @for (cat of availableCategories(); track cat) {
                <button type="button" [class.active]="selectedCategory() === cat" (click)="chooseCategoryFromMenu(cat)">
                  <span>{{ categoryLabel(cat) }}</span>
                  <small>{{ categoryChipCount(cat) }}</small>
                </button>
              }
            </div>
          </section>
        </div>
      }

      @if (availableCategories().length > 1) {
        <button
          type="button"
          class="category-floating-menu-trigger"
          [class.has-services]="selectedServices().length > 0"
          [class.is-open]="categoryMenuOpen()"
          (click)="toggleCategoryMenu()"
          [attr.aria-expanded]="categoryMenuOpen()"
          aria-label="Toggle service category menu">
          <ion-icon name="list-outline" aria-hidden="true"></ion-icon>
          <span>Menu</span>
        </button>
      }
    }
  `,
  styles: [`
    .profile-page {
      padding-bottom: calc(100px + env(safe-area-inset-bottom));
    }

    .profile-page.salon-mode-profile {
      padding-top: calc(72px + env(safe-area-inset-top));
      padding-bottom: calc(120px + env(safe-area-inset-bottom));
    }

    .profile-page.salon-mode-profile .sticky-cta {
      bottom: calc(64px + env(safe-area-inset-bottom));
    }

    .cover {
      position: relative;
      min-height: clamp(260px, 40vh, 430px);
      display: grid;
      align-items: end;
      overflow: hidden;
      border-radius: 0 0 40px 40px;
      background: var(--surface-soft);
    }

    .cover.cover--placeholder {
      min-height: clamp(150px, 24vh, 250px);
    }

    .cover img,
    .cover-overlay,
    .cover-placeholder {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
    }

    .cover img {
      object-fit: cover;
    }

    .cover-placeholder {
      display: grid;
      place-items: center;
    }

    .cover-monogram {
      color: rgba(255, 255, 255, 0.94);
      font-size: clamp(2.6rem, 11vw, 4.8rem);
      font-weight: 950;
      letter-spacing: -0.05em;
      text-shadow: 0 2px 24px rgba(28, 28, 28, 0.2);
    }

    .cover-overlay {
      background: linear-gradient(180deg, rgba(24, 17, 31, 0.08), rgba(24, 17, 31, 0.72));
    }

    .cover-actions {
      position: absolute;
      top: calc(12px + env(safe-area-inset-top));
      right: 10px;
      z-index: 5;
      display: flex;
      gap: 2px;
      --background: transparent;
      --color: #0066ff;
    }

    .cover-actions ion-button {
      width: 36px;
      height: 36px;
      min-width: 36px;
      min-height: 36px;
      margin: 0;
      --padding-start: 0;
      --padding-end: 0;
      --background: transparent;
      --box-shadow: none;
    }

    .cover-copy {
      position: absolute;
      left: 20px;
      right: 20px;
      bottom: 18px;
      z-index: 2;
      display: grid;
      justify-items: start;
      gap: 6px;
      color: #ffffff;
    }

    .hero-business-name {
      margin: 0;
      max-width: min(620px, 100%);
      color: #1C1C1C;
      font-size: clamp(0.98rem, 4vw, 1.65rem);
      font-weight: 900;
      letter-spacing: -0.055em;
      line-height: 0.96;
      text-wrap: balance;
      text-shadow: 0 1px 0 rgba(255, 255, 255, 0.34);
    }

    .cover-copy p {
      margin: 0;
      color: rgba(11, 31, 51, 0.72);
      font-size: 0.82rem;
      font-weight: 900;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }

    .profile-shell {
      display: grid;
      gap: 22px;
      padding-top: 22px;
    }

    .main-column {
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      gap: 4px;
      min-width: 0;
    }

    .main-column > *,
    .services-section,
    .service-stack {
      min-width: 0;
      max-width: 100%;
    }

    .services-section {
      overflow: hidden;
    }

    .cover-back-button {
      position: absolute;
      top: calc(2px + env(safe-area-inset-top));
      left: 2px;
      z-index: 5;
      width: 34px;
      height: 34px;
      min-width: 34px;
      min-height: 34px;
      margin: 0;
      --color: #1C1C1C;
      --background: transparent;
      --box-shadow: none;
      --border-radius: 0;
      --padding-start: 0;
      --padding-end: 0;
      filter: drop-shadow(0 1px 2px rgba(255, 255, 255, 0.55));
    }

    .cover-back-button::part(native) {
      width: 34px;
      height: 34px;
      padding: 0;
      background: transparent;
      box-shadow: none;
    }

    .intro {
      display: grid;
      gap: 20px;
      padding: 22px;
    }

    .intro h2 {
      margin: 0;
      max-width: 760px;
      font-size: clamp(1.4rem, 3vw, 2.2rem);
      letter-spacing: -0.045em;
      line-height: 1.1;
    }

    .quick-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    .quick-action {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      min-height: 40px;
      padding: 0 16px;
      border: 1px solid var(--border);
      border-radius: 999px;
      color: var(--text);
      background: var(--surface);
      font: inherit;
      font-size: 0.8rem;
      font-weight: 900;
      text-decoration: none;
      cursor: pointer;
      transition: border-color 160ms ease, background 160ms ease;
    }

    .quick-action ion-icon {
      flex: 0 0 auto;
      color: var(--primary);
      font-size: 1rem;
    }

    .quick-action:hover {
      border-color: rgba(99, 102, 241, 0.4);
      background: var(--primary-soft);
    }

    .quick-action:disabled {
      opacity: 0.45;
      cursor: not-allowed;
    }

    .hero-meta {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 8px;
    }

    .hero-meta-item {
      display: flex;
      align-items: center;
      gap: 7px;
      min-width: 0;
      min-height: 46px;
      padding: 8px 12px;
      border: 0;
      border-radius: 14px;
      color: var(--muted);
      background: var(--surface-soft);
      font: inherit;
      font-size: 0.84rem;
      font-weight: 800;
      text-align: left;
    }

    .hero-meta-item ion-icon {
      flex: 0 0 auto;
      color: var(--primary);
      font-size: 0.95rem;
    }

    .hero-meta-item strong {
      min-width: 0;
      overflow: hidden;
      color: var(--text);
      font-weight: 900;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .hero-meta-item.closed strong {
      color: #EF4444;
    }

    .hero-meta-rating {
      cursor: pointer;
    }

    .hero-meta-rating span {
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .primary-salon-strip {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 12px;
      border: 1px solid rgba(99, 102, 241, 0.14);
      border-radius: 16px;
      background: var(--glass);
    }

    .primary-salon-strip > div:first-child {
      display: grid;
      gap: 2px;
      min-width: 0;
    }

    .primary-salon-strip strong {
      color: var(--text);
      font-size: 0.9rem;
      font-weight: 950;
      line-height: 1.15;
    }

    .primary-salon-strip span {
      color: var(--muted);
      font-size: 0.82rem;
      font-weight: 800;
      line-height: 1.2;
    }

    .primary-salon-action {
      flex: 0 0 auto;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      min-height: 42px;
      margin: 0 0 0 auto;
      padding: 0 18px;
      border: 0;
      border-radius: 999px;
      color: #FFFFFF;
      background: var(--primary);
      font-family: inherit;
      font-size: 0.84rem;
      font-weight: 950;
      text-decoration: none;
      cursor: pointer;
      box-shadow: 0 8px 18px rgba(99, 102, 241, 0.2);
      transition: background 160ms ease, transform 160ms ease;
    }

    .primary-salon-action:hover {
      background: var(--brand-800);
    }

    .primary-salon-action.secondary {
      color: var(--primary);
      border: 1px solid rgba(99, 102, 241, 0.22);
      background: var(--surface);
      box-shadow: none;
    }

    .primary-salon-action.secondary:hover {
      background: var(--primary-soft);
    }

    .primary-salon-actions {
      display: flex;
      align-items: center;
      gap: 8px;
      flex: 0 0 auto;
    }

    .primary-salon-link {
      min-height: 42px;
      padding: 0 8px;
      border: 0;
      color: var(--muted);
      background: transparent;
      font: inherit;
      font-size: 0.84rem;
      font-weight: 850;
      cursor: pointer;
    }

    .primary-salon-link:hover {
      color: var(--primary);
    }

    .page-section-nav {
      position: sticky;
      top: calc(8px + env(safe-area-inset-top));
      z-index: 30;
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 4px;
      margin: 2px 0 14px;
      padding: 4px;
      width: 100%;
      box-sizing: border-box;
      border: 1px solid var(--border);
      border-radius: 16px;
      background: var(--glass);
      backdrop-filter: blur(14px);
    }

    .page-section-nav button {
      width: 100%;
      min-height: 34px;
      padding: 0 4px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border: 0;
      border-radius: 11px;
      color: var(--muted);
      background: transparent;
      font: inherit;
      font-size: 0.82rem;
      font-weight: 900;
      text-align: center;
      white-space: nowrap;
      cursor: pointer;
      transition: color 160ms ease, background 160ms ease, box-shadow 160ms ease;
    }

    .page-section-nav button:active {
      color: var(--primary);
      background: var(--primary-soft);
    }

    .page-section-nav button.active {
      color: #ffffff;
      background: var(--primary);
      box-shadow: 0 4px 14px rgba(99, 102, 241, 0.32);
    }

    .section-anchor {
      scroll-margin-top: 68px;
    }

    .section-title-count {
      color: var(--muted);
      font-weight: 800;
    }

    .trust-row {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    .trust-row span {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      min-height: 34px;
      padding: 7px 11px;
      border-radius: 999px;
      color: var(--primary);
      background: var(--pink-soft);
      font-weight: 900;
    }

    .gallery-strip {
      display: grid;
      grid-auto-flow: column;
      grid-auto-columns: minmax(220px, 320px);
      gap: 12px;
      overflow-x: auto;
      padding-bottom: 8px;
      scrollbar-width: none;
    }

    .gallery-strip::-webkit-scrollbar {
      display: none;
    }

    .service-search-box {
      position: relative;
      margin-bottom: 12px;
      display: flex;
      align-items: center;
    }

    .service-search-box .search-icon {
      position: absolute;
      left: 14px;
      color: var(--primary);
      font-size: 1.15rem;
      pointer-events: none;
    }

    .service-search-input {
      width: 100%;
      height: 46px;
      padding: 0 40px 0 42px;
      border: 1.5px solid var(--border);
      border-radius: 14px;
      outline: none;
      color: var(--text);
      background: var(--surface);
      font-size: 0.88rem;
      font-weight: 600;
      box-shadow: 0 2px 8px rgba(99, 102, 241, 0.04);
      transition: border-color 180ms ease, box-shadow 180ms ease;
    }

    .service-search-input:focus {
      border-color: var(--primary);
      box-shadow: 0 0 0 3.5px rgba(99, 102, 241, 0.18);
    }

    .clear-search-btn {
      position: absolute;
      right: 12px;
      background: transparent;
      border: 0;
      padding: 0;
      color: var(--muted);
      font-size: 1.25rem;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .clear-filter-text-btn {
      background: transparent;
      border: 0;
      color: var(--primary);
      font-size: 0.84rem;
      font-weight: 800;
      cursor: pointer;
      padding: 4px 8px;
    }

    .category-pills-strip {
      display: flex;
      gap: 8px;
      overflow-x: auto;
      padding-bottom: 10px;
      margin-bottom: 8px;
      scrollbar-width: none;
    }
    .category-pills-strip::-webkit-scrollbar { display: none; }

    .category-pill {
      flex: 0 0 auto;
      height: 32px;
      padding: 0 14px;
      border: 1px solid var(--border);
      border-radius: 999px;
      background: var(--surface);
      color: var(--muted);
      font-size: 0.82rem;
      font-weight: 750;
      cursor: pointer;
      transition: all 180ms ease;
    }

    .category-pill.active {
      border-color: var(--primary);
      background: var(--primary);
      color: #ffffff;
      box-shadow: 0 4px 12px rgba(99, 102, 241, 0.18);
    }

    .service-empty-card {
      text-align: center;
      padding: 28px 16px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
    }

    .service-empty-card .empty-icon {
      width: 44px;
      height: 44px;
      border-radius: 14px;
      background: rgba(99, 102, 241, 0.1);
      color: var(--primary);
      display: grid;
      place-items: center;
      font-size: 1.2rem;
    }

    .reset-search-btn {
      margin-top: 6px;
      min-height: 44px;
      padding: 8px 16px;
      border: 1px solid rgba(124, 58, 237, 0.3);
      border-radius: 999px;
      color: var(--primary);
      background: transparent;
      font-weight: 800;
      font-size: 0.84rem;
      cursor: pointer;
    }

    .salon-service-item {
      width: 100%;
      box-sizing: border-box;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 14px;
      padding: 14px 16px;
      border: 1px solid var(--border);
      border-radius: 20px;
      color: var(--text);
      background: var(--surface);
      box-shadow: 0 4px 14px rgba(28, 28, 28, 0.04);
      text-align: left;
      cursor: pointer;
    }

    .service-card {
      display: block;
      width: 100%;
      max-width: 100%;
      box-sizing: border-box;
    }

    .service-custom-card {
      grid-column: 1 / -1;
      display: grid;
      gap: 10px;
      margin-top: 2px;
      padding: 12px;
      border: 1px solid rgba(99, 102, 241, 0.12);
      border-radius: 15px;
      background: rgba(246, 249, 252, 0.88);
    }

    .service-custom-card > strong {
      color: var(--text);
      font-size: 0.86rem;
      font-weight: 900;
    }

    .service-addon-list {
      display: flex;
      gap: 8px;
      overflow-x: auto;
      scrollbar-width: none;
    }

    .service-addon-list::-webkit-scrollbar { display: none; }

    .service-addon-chip {
      flex: 0 0 auto;
      min-height: 34px;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 0 11px;
      border: 1px solid rgba(99, 102, 241, 0.16);
      border-radius: 999px;
      color: var(--brand-800);
      background: var(--surface);
      font-size: 0.84rem;
      font-weight: 850;
    }

    .service-addon-chip small {
      color: var(--primary);
      font-weight: 900;
    }

    .service-note-input {
      width: 100%;
      resize: vertical;
      min-height: 116px;
      padding: 15px 14px;
      border: 1px solid rgba(124, 99, 223, 0.2);
      border-radius: 17px;
      outline: none;
      color: var(--text);
      background: linear-gradient(180deg, #FFFFFF, rgba(248, 247, 255, 0.82));
      font: inherit;
      font-size: 0.84rem;
      line-height: 1.35;
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.9);
      transition: border-color 160ms ease, box-shadow 160ms ease, background 160ms ease;
    }

    .service-note-input::placeholder {
      color: rgba(82, 101, 121, 0.62);
    }

    .service-note-input:focus {
      border-color: rgba(92, 72, 217, 0.5);
      background: #FFFFFF;
      box-shadow: 0 0 0 4px rgba(99, 102, 241, 0.11), inset 0 1px 0 rgba(255, 255, 255, 0.95);
    }

    .service-popup-backdrop {
      position: fixed;
      inset: 0;
      z-index: 1000;
      display: grid;
      align-items: center;
      justify-items: center;
      padding: 18px;
      background: radial-gradient(circle at 50% 22%, rgba(124, 99, 223, 0.24), transparent 32%), rgba(16, 18, 28, 0.52);
      backdrop-filter: blur(12px) saturate(1.08);
    }

    .service-popup-sheet {
      position: relative;
      width: min(408px, 100%);
      max-height: min(86vh, 720px);
      margin: 0;
      display: grid;
      gap: 17px;
      overflow: auto;
      padding: 24px 18px 18px;
      border: 1px solid rgba(255, 255, 255, 0.78);
      border-radius: 28px;
      background:
        radial-gradient(circle at 88% 10%, rgba(238, 232, 255, 0.95), transparent 34%),
        linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(250, 248, 255, 0.97));
      box-shadow: 0 30px 76px rgba(18, 16, 38, 0.28), 0 2px 0 rgba(255, 255, 255, 0.82) inset;
    }

    .service-popup-close {
      position: absolute;
      top: 16px;
      right: 16px;
      width: 34px;
      min-width: 34px;
      height: 34px;
      min-height: 34px;
      border: 0;
      border-radius: 999px;
      color: rgba(25, 28, 40, 0.78);
      background: rgba(255, 255, 255, 0.82);
      font-size: 1.35rem;
      line-height: 1;
      cursor: pointer;
      box-shadow: 0 8px 20px rgba(25, 28, 40, 0.08);
    }

    .service-popup-head {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 108px;
      gap: 16px;
      align-items: start;
      padding: 36px 1px 2px;
    }

    .service-popup-head small {
      display: inline-flex;
      width: fit-content;
      padding: 5px 8px;
      border: 1px solid rgba(124, 99, 223, 0.14);
      border-radius: 999px;
      color: rgba(67, 56, 128, 0.76);
      background: rgba(255, 255, 255, 0.72);
      font-size: 0.68rem;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: 0.1em;
    }

    .service-popup-head h2 {
      margin: 8px 0 7px;
      color: var(--text);
      font-size: clamp(1.25rem, 6vw, 1.56rem);
      line-height: 1.08;
      letter-spacing: -0.045em;
    }

    .service-popup-head strong {
      display: inline-flex;
      align-items: center;
      width: fit-content;
      padding: 5px 9px;
      border-radius: 999px;
      color: #4F46E5;
      background: rgba(79, 70, 229, 0.1);
      font-weight: 950;
    }

    .service-popup-thumb {
      width: 108px;
      height: 92px;
      border-radius: 24px;
      background-color: var(--primary-soft, #EEF2FF);
      background-position: center;
      background-size: cover;
      box-shadow: 0 16px 34px rgba(75, 58, 168, 0.16), 0 1px 0 rgba(255, 255, 255, 0.72) inset;
    }

    .service-popup-thumb--letter {
      display: grid;
      place-items: center;
      background: linear-gradient(145deg, rgba(239, 235, 255, 0.96), rgba(228, 220, 255, 0.88));
    }

    .service-popup-section {
      display: grid;
      gap: 9px;
    }

    .service-popup-section h3 {
      margin: 0;
      color: rgba(25, 28, 40, 0.9);
      font-size: 0.92rem;
      font-weight: 950;
      letter-spacing: -0.02em;
    }

    .service-addon-list.popup-list {
      flex-wrap: wrap;
      overflow: visible;
    }

    .service-popup-add {
      min-height: 50px;
      border: 0;
      border-radius: 17px;
      color: #FFFFFF;
      background: linear-gradient(135deg, #6D5DF7, #4F46E5 58%, #4338CA);
      font-size: 0.98rem;
      font-weight: 950;
      cursor: pointer;
      box-shadow: 0 15px 30px rgba(79, 70, 229, 0.26), inset 0 1px 0 rgba(255, 255, 255, 0.24);
      transition: transform 160ms ease, box-shadow 160ms ease;
    }

    .service-popup-add:active {
      transform: translateY(1px) scale(0.99);
      box-shadow: 0 10px 22px rgba(79, 70, 229, 0.22), inset 0 1px 0 rgba(255, 255, 255, 0.2);
    }

    .salon-service-item.is-picked {
      border-color: rgba(99, 102, 241, 0.5);
      background: linear-gradient(145deg, rgba(240, 244, 255, 0.98), #FFFFFF 54%);
      box-shadow: 0 12px 24px rgba(99, 102, 241, 0.1);
    }

    .salon-service-item.selected {
      border-color: rgba(99, 102, 241, 0.5);
      background: linear-gradient(145deg, rgba(240, 244, 255, 0.98), #FFFFFF 54%);
      box-shadow: 0 12px 24px rgba(99, 102, 241, 0.1);
    }

    .salon-service-copy {
      flex: 1 1 auto;
      display: grid;
      gap: 6px;
      min-width: 0;
      text-align: left;
    }

    .salon-service-copy h3 {
      margin: 0;
      color: var(--text);
      font-size: 1rem;
      font-weight: 850;
      line-height: 1.18;
      overflow-wrap: anywhere;
    }

    .service-title-row {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 6px;
      min-width: 0;
    }

    .service-name {
      color: var(--text);
      font-size: 1.02rem;
      font-weight: 950;
      letter-spacing: -0.03em;
      line-height: 1.2;
      overflow-wrap: anywhere;
    }

    .offer-pill {
      display: inline-flex;
      align-items: center;
      min-height: 22px;
      padding: 0 8px;
      border-radius: 999px;
      color: var(--primary);
      background: var(--primary-soft);
      font-size: 0.72rem;
      font-weight: 950;
    }

    .offer-pill.extended {
      color: var(--muted);
      border-color: var(--border);
      background: var(--surface-soft);
    }

    .service-price-row {
      display: flex;
      align-items: baseline;
      gap: 10px;
      min-width: 0;
    }

    .service-price-row strong {
      color: var(--primary);
      font-size: 0.92rem;
      font-weight: 950;
    }

    .service-price-row span {
      color: var(--muted);
      font-size: 0.88rem;
      font-weight: 850;
    }

    .service-desc {
      display: -webkit-box;
      overflow: hidden;
      color: var(--muted);
      font-size: 0.82rem;
      line-height: 1.35;
      -webkit-box-orient: vertical;
      -webkit-line-clamp: 2;
    }

    .service-eligibility {
      color: var(--muted);
      font-size: 0.84rem;
      font-weight: 800;
    }

    .service-description {
      display: -webkit-box;
      margin: 0;
      overflow: hidden;
      color: var(--muted);
      font-size: 0.84rem;
      line-height: 1.35;
      -webkit-line-clamp: 3;
      -webkit-box-orient: vertical;
    }

    .service-description.expanded {
      -webkit-line-clamp: 5;
    }

    .service-more {
      justify-self: start;
      min-width: 0;
      min-height: 0;
      padding: 0;
      border: 0;
      color: var(--primary);
      background: transparent;
      font-size: 0.84rem;
      font-weight: 900;
      cursor: pointer;
    }

    .salon-service-copy strong {
      color: var(--primary);
      font-size: 0.9rem;
      font-weight: 900;
    }

    .salon-service-copy .service-name {
      color: var(--text);
      font-size: 1.02rem;
      font-weight: 950;
      letter-spacing: -0.03em;
      line-height: 1.2;
    }

    .salon-service-action {
      flex: 0 0 100px;
      width: 100px;
      display: grid;
      justify-items: center;
      gap: 0;
      visibility: visible;
      opacity: 1;
    }

    .salon-service-thumb {
      width: 100px;
      height: 84px;
      display: block;
      border-radius: 18px;
      background-color: var(--primary-soft, #EEF2FF);
      background-position: center;
      background-size: cover;
      background-repeat: no-repeat;
      box-shadow: 0 8px 20px rgba(28, 28, 28, 0.06);
      visibility: visible;
      opacity: 1;
    }

    .salon-service-thumb--letter {
      display: grid;
      place-items: center;
      background: linear-gradient(145deg, #f0ebff, #e8e0ff);
      box-shadow: none;
    }

    .salon-service-thumb--letter span,
    .service-popup-thumb--letter span {
      color: var(--brand-700);
      font-size: 1.65rem;
      font-weight: 950;
      letter-spacing: -0.04em;
    }

    .salon-service-add {
      min-width: 74px;
      min-height: 34px;
      margin-top: -16px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 4px;
      padding: 0 14px;
      border: 1px solid rgba(99, 102, 241, 0.22);
      border-radius: 12px;
      color: #5f46cf;
      background: #FFFFFF;
      font-size: 0.86rem;
      font-weight: 950;
      cursor: pointer;
      box-shadow: 0 8px 18px rgba(28, 28, 28, 0.1);
      visibility: visible;
      opacity: 1;
      z-index: 2;
      transition: all 160ms ease;
    }

    .salon-service-add.selected {
      color: #059669;
      border-color: rgba(16, 185, 129, 0.32);
      background: #D1FAE5;
      box-shadow: none;
    }

    .show-more-btn {
      width: 100%;
      min-height: 46px;
      margin-top: 4px;
      border: 1px dashed rgba(99, 102, 241, 0.4);
      border-radius: 14px;
      color: var(--primary);
      background: var(--surface);
      font: inherit;
      font-size: 0.84rem;
      font-weight: 900;
      cursor: pointer;
      transition: border-color 160ms ease, background 160ms ease;
    }

    .show-more-btn:hover {
      border-style: solid;
      border-color: var(--primary);
      background: var(--primary-soft);
    }

    .staff-card img,
    .staff-avatar {
      width: 74px;
      height: 74px;
      margin-bottom: 6px;
      border-radius: 24px;
    }

    .staff-card img {
      object-fit: cover;
    }

    .staff-avatar {
      display: grid;
      place-items: center;
      color: #ffffff;
      font-size: 1.4rem;
      font-weight: 950;
      letter-spacing: -0.03em;
      background: linear-gradient(145deg, var(--brand-600), var(--brand-800));
    }

    .staff-card span,
    .staff-card small,
    .staff-card em {
      color: var(--muted);
      font-style: normal;
      line-height: 1.35;
    }

    .staff-card em {
      color: var(--primary-2);
      font-weight: 900;
    }

    .staff-card ion-button {
      margin-top: 6px;
      min-height: 44px;
    }

    .review-card {
      padding: 18px;
    }

    .review-card p {
      margin: 14px 0;
      color: var(--text);
      line-height: 1.5;
    }

    .review-card small {
      display: block;
      margin-top: 3px;
      color: var(--muted);
    }

    .info-card {
      padding: 18px;
    }

    .info-card h2 {
      margin: 0 0 12px;
      letter-spacing: -0.04em;
    }

    .info-card p {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      margin: 0 0 10px;
      color: var(--text);
      line-height: 1.5;
    }

    .info-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin: 12px 0;
    }

    .hours-row {
      justify-content: space-between;
    }

    .hours-row span {
      color: var(--muted);
      font-weight: 800;
      text-align: right;
    }

    .booking-rail {
      display: none;
      align-self: start;
      padding: 20px;
      position: sticky;
      top: 102px;
    }

    .booking-rail h2 {
      margin: 14px 0 8px;
      font-size: 1.45rem;
      letter-spacing: -0.04em;
    }

    .rail-offer {
      margin: 16px 0;
      padding: 13px;
      border-radius: 18px;
      color: #EF4444;
      background: #FDF2F8;
      font-weight: 900;
    }

    .rail-row {
      display: flex;
      justify-content: space-between;
      gap: 14px;
      padding: 13px 0;
      border-top: 1px solid var(--border);
    }

    .rail-row span {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      color: var(--muted);
      font-weight: 800;
    }

    .rail-row strong {
      text-align: right;
    }

    .booking-rail ion-button {
      margin-top: 18px;
    }

    .state-card {
      padding: 24px;
    }

    .state-card h1 {
      margin: 0 0 8px;
      letter-spacing: -0.05em;
    }

    .state-card.error p {
      color: #EF4444;
    }

    .offers-stack {
      display: grid;
      gap: 10px;
    }

    .offer-card {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 14px;
      align-items: start;
      padding: 16px;
    }

    .offer-icon {
      display: grid;
      place-items: center;
      width: 40px;
      height: 40px;
      border-radius: 14px;
      background: var(--surface-soft);
    }

    .offer-icon ion-icon {
      font-size: 1.15rem;
      color: var(--primary);
    }

    .coupon-offer .offer-icon {
      background: linear-gradient(135deg, rgba(99, 102, 241, 0.12), rgba(99, 102, 241, 0.08));
    }

    .coupon-offer .offer-icon ion-icon {
      color: var(--primary);
    }

    .promo-offer .offer-icon {
      background: linear-gradient(135deg, rgba(245, 158, 11, 0.12), rgba(239, 68, 68, 0.08));
    }

    .promo-offer .offer-icon ion-icon {
      color: #F59E0B;
    }

    .offer-body {
      display: grid;
      gap: 3px;
    }

    .offer-body strong {
      font-size: 0.92rem;
      letter-spacing: -0.02em;
    }

    .offer-summary {
      color: var(--muted);
      font-size: 0.82rem;
      line-height: 1.4;
    }

    .coupon-code {
      display: inline-block;
      margin-top: 4px;
      padding: 4px 10px;
      border-radius: 8px;
      background: var(--surface-soft);
      color: var(--primary-2);
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 0.8rem;
      font-weight: 700;
      letter-spacing: 0.06em;
      width: fit-content;
    }

    .offer-validity {
      margin-top: 2px;
      color: var(--muted);
      font-size: 0.80rem;
    }

    .loyalty-grid {
      display: grid;
      gap: 12px;
    }

    .loyalty-card {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr) auto;
      align-items: center;
      gap: 14px;
      padding: 18px;
      border-radius: 20px;
      background: var(--surface);
      border: 1px solid var(--border);
      text-decoration: none;
      color: inherit;
      cursor: pointer;
      transition: border-color 0.25s ease, box-shadow 0.25s ease;
    }

    .loyalty-card:hover,
    .loyalty-card:focus-visible {
      border-color: var(--primary);
      box-shadow: 0 0 0 1px var(--primary);
    }

    .loyalty-card.primary-card {
      background: linear-gradient(135deg, rgba(99, 102, 241, 0.1), rgba(99, 102, 241, 0.06));
      border-color: rgba(99, 102, 241, 0.25);
    }

    .loyalty-card ion-icon {
      font-size: 1.5rem;
      color: var(--primary);
    }

    .loyalty-card div {
      min-width: 0;
    }

    .loyalty-card strong {
      display: block;
      margin: 0;
      font-size: 0.95rem;
      letter-spacing: -0.02em;
    }

    .loyalty-card span {
      display: block;
      margin: 2px 0 0;
      color: var(--muted);
      font-size: 0.8rem;
      line-height: 1.4;
    }

    .loyalty-card ion-button {
      --padding-start: 12px;
      --padding-end: 12px;
    }

    .loyalty-section {
      margin-top: 4px;
    }

    @media (max-width: 599px) {
      .loyalty-grid {
        gap: 8px;
      }

      .loyalty-card {
        grid-template-columns: auto minmax(0, 1fr);
        gap: 10px;
        padding: 14px;
        border-radius: 16px;
      }

      .loyalty-card ion-button:last-child {
        grid-column: 1 / -1;
        justify-self: start;
      }

      .offer-card {
        gap: 10px;
        padding: 12px;
        border-radius: 16px;
      }

      .offer-icon {
        width: 34px;
        height: 34px;
        border-radius: 11px;
      }
    }

    @media (max-width: 599px) {
      .profile-page {
        padding-bottom: calc(82px + env(safe-area-inset-bottom));
      }

      .cover {
        min-height: 150px;
        border-radius: 0 0 22px 22px;
      }

      .cover.cover--placeholder {
        min-height: 120px;
      }

      .cover-actions {
        top: 8px;
        right: 8px;
      }

      .cover-actions ion-button:last-child,
      .intro h2,
      .trust-row {
        display: none;
      }

      .cover-copy {
        left: 18px;
        right: 18px;
        bottom: 16px;
      }

      .hero-business-name {
        margin: 0;
        max-width: calc(100% - 34px);
        font-size: 0.88rem;
        line-height: 0.96;
      }

      .cover-copy p {
        font-size: 0.80rem;
      }

      .cover-monogram {
        font-size: 1.8rem;
      }

      .profile-shell {
        gap: 10px;
        padding-top: 10px;
      }

      .main-column {
        gap: 10px;
      }

      .intro {
        gap: 7px;
        padding: 9px 10px;
        border-radius: 16px;
      }

      .intro .eyebrow {
        margin-bottom: 0;
        font-size: 0.80rem;
      }

      .quick-actions {
        gap: 6px;
      }

      .quick-action {
        min-height: 38px;
        padding: 0 14px;
        font-size: 0.84rem;
      }

      .hero-meta {
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 6px;
      }

      .hero-meta-item {
        min-height: 42px;
        padding: 6px 10px;
        font-size: 0.80rem;
      }

      .primary-salon-strip {
        align-items: center;
        gap: 8px;
        padding: 10px;
      }

      .primary-salon-action {
        min-height: 38px;
        padding: 0 14px;
        font-size: 0.84rem;
      }

      .page-section-nav {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 3px;
        margin: 0 0 10px;
        padding: 3px;
        width: 100%;
        box-sizing: border-box;
      }

      .page-section-nav button {
        width: 100%;
        min-height: 32px;
        padding: 0 2px;
        font-size: 0.78rem;
      }

      .section-heading {
        margin-top: 0;
      }

      .section-title {
        font-size: 1.08rem;
      }

      .service-stack {
        gap: 8px;
      }

      .salon-service-item {
        gap: 14px;
        padding: 14px 16px;
        border-radius: 20px;
      }

      .salon-service-action {
        flex: 0 0 100px;
        width: 100px;
      }

      .salon-service-thumb {
        width: 100px;
        height: 84px;
        border-radius: 18px;
      }

      .salon-service-thumb--letter span,
      .service-popup-thumb--letter span {
        font-size: 1.5rem;
      }

      .salon-service-add {
        min-width: 74px;
        min-height: 34px;
        margin-top: -16px;
        font-size: 0.86rem;
      }

      .salon-service-copy h3 {
        font-size: 0.95rem;
      }

      .salon-service-copy .service-name {
        font-size: 1.02rem;
      }

      .salon-service-item ion-button {
        width: 100%;
        min-height: 38px;
      }

      .bottom-action-card {
        padding: 8px 10px;
        border-radius: 18px;
      }

      .sticky-cta {
        bottom: calc(8px + env(safe-area-inset-bottom));
      }
    }

    .other-branches-section {
      display: grid;
      gap: 12px;
    }

    .other-branches-rail {
      display: flex;
      gap: 9px;
      overflow-x: auto;
      padding: 2px 1px 7px;
      scrollbar-width: none;
      scroll-snap-type: x proximity;
    }

    .other-branches-rail::-webkit-scrollbar {
      display: none;
    }

    .branch-option {
      display: grid;
      grid-template-columns: 34px minmax(0, 1fr) auto;
      align-items: center;
      gap: 8px;
      flex: 0 0 min(230px, 76vw);
      min-height: 58px;
      padding: 8px 10px;
      border: 1px solid var(--border);
      border-radius: 15px;
      color: var(--text);
      background: var(--glass);
      box-shadow: 0 7px 18px rgba(28, 28, 28, 0.07);
      text-decoration: none;
      scroll-snap-align: start;
    }

    .branch-option-mark {
      width: 34px;
      height: 34px;
      display: grid;
      place-items: center;
      border-radius: 11px;
      color: #704812;
      background: rgba(99, 102, 241, 0.14);
      font-size: 0.82rem;
      font-weight: 950;
    }

    .branch-option-copy {
      display: grid;
      gap: 3px;
      min-width: 0;
    }

    .branch-option-copy strong,
    .branch-option-copy small {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .branch-option-copy strong {
      font-size: 0.8rem;
    }

    .branch-option-copy small {
      color: var(--muted);
      font-size: 0.78rem;
      font-weight: 800;
    }

    .branch-option-copy small .open {
      color: #059669;
      font-weight: 950;
    }

    .branch-option > ion-icon {
      color: #a36d16;
      font-size: 0.95rem;
    }

    @media (min-width: 768px) {
      .staff-grid,
      .review-grid,
      .info-grid,
      .review-grid,
      .info-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }

    .category-floating-menu-trigger {
      position: fixed;
      z-index: 1200;
      right: 0;
      bottom: calc(68px + env(safe-area-inset-bottom));
      min-height: 28px;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 0 8px 0 10px;
      border: 0;
      border-radius: 999px 0 0 999px;
      color: #ffffff;
      background: #7c63df;
      box-shadow: -2px 4px 16px rgba(124, 99, 223, 0.38);
      font-size: 0.72rem;
      font-weight: 950;
      letter-spacing: 0.01em;
      cursor: pointer;
      transition: bottom 220ms cubic-bezier(0.2, 0.8, 0.2, 1), transform 160ms ease, box-shadow 160ms ease;
    }
    .category-floating-menu-trigger.has-services {
      bottom: calc(118px + env(safe-area-inset-bottom));
    }
    .category-floating-menu-trigger ion-icon {
      font-size: 0.82rem;
    }
    .category-floating-menu-trigger:active {
      transform: scale(0.95);
    }
    .category-menu-backdrop {
      position: fixed;
      inset: 0;
      z-index: 1000;
      background: rgba(15, 23, 42, 0.28);
    }
    .category-menu-sheet {
      position: fixed;
      z-index: 1010;
      right: calc(8px + env(safe-area-inset-right));
      left: auto;
      bottom: calc(110px + env(safe-area-inset-bottom));
      top: auto;
      width: min(300px, calc(100% - 28px));
      max-height: 60vh;
      display: grid;
      grid-template-rows: auto minmax(0, 1fr);
      overflow: hidden;
      border: 1px solid rgba(225, 214, 251, 0.86);
      border-radius: 24px;
      background: #ffffff;
      box-shadow: 0 24px 60px rgba(15, 23, 42, 0.24);
    }
    .category-menu-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 8px 14px 6px;
      border-bottom: 1px solid var(--border);
    }
    .category-menu-head div { display: grid; gap: 1px; }
    .category-menu-head strong { font-size: 0.92rem; font-weight: 950; }
    .category-menu-head span { color: var(--muted); font-size: 0.72rem; font-weight: 800; }
    .category-menu-head button {
      min-height: 28px;
      padding: 0 10px;
      border: 1px solid var(--border);
      border-radius: 999px;
      color: var(--primary);
      background: var(--surface);
      font-size: 0.72rem;
      font-weight: 950;
    }
    .category-menu-list {
      display: grid;
      gap: 6px;
      overflow-y: scroll;
      padding: 10px;
      scrollbar-width: thin;
      scrollbar-color: rgba(15, 23, 42, 0.28) transparent;
    }
    .category-menu-list::-webkit-scrollbar { width: 1px; height: 3px; background: transparent; }
    .category-menu-list::-webkit-scrollbar-thumb { background: rgba(15, 23, 42, 0.1); border-radius: 3px; }
    .category-menu-list button {
      min-height: 40px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 14px;
      padding: 0 10px;
      border: 1px solid transparent;
      border-radius: 14px;
      color: var(--text);
      background: transparent;
      font: inherit;
      font-weight: 800;
      font-size: 0.82rem;
      text-align: left;
    }
    .category-menu-list button.active {
      border-color: rgba(99, 102, 241, 0.28);
      background: var(--primary-soft);
      color: var(--primary);
    }
    .category-menu-list button span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .category-menu-list small {
      flex: 0 0 auto;
      min-width: 26px;
      min-height: 22px;
      display: inline-grid;
      place-items: center;
      padding: 0 7px;
      border-radius: 999px;
      color: var(--primary);
      background: #ffffff;
      font-size: 0.7rem;
      font-weight: 950;
    }
    @media (min-width: 1024px) {
      .profile-page {
        padding-bottom: 40px;
      }

      .profile-shell {
        grid-template-columns: minmax(0, 1fr) 330px;
        align-items: start;
      }

      .booking-rail {
        display: block;
      }
      .mobile-only {
        display: none;
      }
    }
  `]
})
export class BusinessProfilePage implements OnInit, OnDestroy {
  private readonly slug = signal(this.route.snapshot.paramMap.get("slug"));
  readonly selectedServiceIds = signal<string[]>(this.initialServiceIds());
  readonly expandedServiceId = signal<string>("");
  readonly activeCustomizationServiceId = signal<string>("");
  readonly serviceNotes = signal<Record<string, string>>({});
  readonly serviceQuery = signal<string>("");
  readonly selectedCategory = signal<string>("");
  readonly visibleServiceLimit = signal(12);
  readonly categoryMenuOpen = signal<boolean>(false);
  readonly activeProfileTab = signal<"services" | "team" | "reviews" | "about">("services");

  toggleCategoryMenu(): void {
    this.categoryMenuOpen.update((open) => !open);
  }

  chooseCategoryFromMenu(cat: string): void {
    this.selectedCategory.set(cat);
    this.categoryMenuOpen.set(false);
    this.scrollToServices();
  }

  categoryChipCount(cat: string): number {
    return (this.business()?.services ?? []).filter((s) => (s.category || "Other") === cat).length;
  }

  scrollToServices(): void {
    const el = document.getElementById("services");
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  readonly business = computed(() => {
    const slug = this.slug();
    const business = slug ? this.marketplace.findBusiness(slug) : null;
    if (!business && slug) this.reload();
    return business;
  });

  readonly hasCoverPhoto = computed(() => {
    const b = this.business();
    return Boolean(b && (b.coverImage || b.galleryImages?.[0] || b.logoUrl));
  });

  readonly coverPhoto = computed(() => {
    const b = this.business();
    return b?.coverImage || b?.galleryImages?.[0] || b?.logoUrl || "";
  });
  readonly isAuthenticated = computed(() => this.marketplace.isAuthenticated());
  readonly isPrimarySalon = computed(() => {
    const biz = this.business();
    const primary = this.marketplace.primarySalon();
    if (!biz || !primary) return false;
    return primary.branchId === biz.branchId || primary.businessId === biz.id;
  });
  readonly activeOffers = computed(() => this.marketplace.salonOffers()?.offers ?? []);
  readonly selectedService = computed(() => {
    const id = this.selectedServiceIds()[0] ?? "";
    if (!id) return null;
    return this.business()?.services.find((s) => s.id === id) || null;
  });
  readonly selectedServices = computed(() => {
    const ids = new Set(this.selectedServiceIds());
    return this.business()?.services.filter((service) => ids.has(service.id)) ?? [];
  });
  readonly activeCustomizationService = computed(() => {
    const serviceId = this.activeCustomizationServiceId();
    if (!serviceId) return null;
    return this.business()?.services.find((service) => service.id === serviceId) ?? null;
  });

  readonly availableCategories = computed(() => {
    const biz = this.business();
    if (!biz?.services) return [];
    const cats = biz.services.map((s) => s.category).filter((c): c is string => Boolean(c));
    return Array.from(new Set(cats));
  });

  readonly filteredServices = computed(() => {
    const biz = this.business();
    if (!biz?.services) return [];
    const q = this.serviceQuery().trim().toLowerCase();
    const cat = this.selectedCategory();

    return biz.services
      .filter((service) => {
        const matchCat = !cat || service.category === cat;
        const matchQ = !q || service.name.toLowerCase().includes(q) || (service.description && service.description.toLowerCase().includes(q));
        return matchCat && matchQ;
      })
      .sort((left, right) => Number(right.popular) - Number(left.popular));
  });

  readonly paginatedServices = computed(() => {
    const services = this.filteredServices();
    const filtering = Boolean(this.serviceQuery() || this.selectedCategory());
    const limit = filtering ? services.length : this.visibleServiceLimit();
    return services.slice(0, limit);
  });

  clearServiceFilters() {
    this.serviceQuery.set("");
    this.selectedCategory.set("");
    this.visibleServiceLimit.set(12);
  }

  showMoreServices() {
    this.visibleServiceLimit.update((limit) => limit + 12);
  }

  readonly otherBranches = computed(() => {
    const current = this.business();
    if (!current?.tenantId) return [];
    const seen = new Set<string>();
    return this.marketplace.businesses().filter((branch) => {
      if (branch.tenantId !== current.tenantId) return false;
      if (branch.id === current.id || branch.slug === current.slug || (current.branchId && branch.branchId === current.branchId)) return false;
      const key = branch.branchId || branch.id || branch.slug;
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  });
  private routeSubscription?: Subscription;
  favoritePending = false;
  savedSalonPending = false;

  private initialServiceIds(): string[] {
    const multi = this.route.snapshot.queryParamMap.get("serviceIds");
    if (multi) return Array.from(new Set(multi.split(",").map((id) => id.trim()).filter(Boolean)));
    const single = this.route.snapshot.queryParamMap.get("serviceId");
    return single ? [single] : [];
  }

  constructor(private readonly route: ActivatedRoute, private readonly router: Router, readonly marketplace: MarketplaceService, private readonly feedback: CustomerFeedbackService) {
    addIcons({
      callOutline,
      bookmark,
      bookmarkOutline,
      cardOutline,
      checkmarkCircleOutline,
      clipboardOutline,
      closeCircleOutline,
      heart,
      heartOutline,
      locationOutline,
      navigateOutline,
      peopleOutline,
      pricetagOutline,
      ribbonOutline,
      searchOutline,
      shareOutline,
      sparklesOutline,
      starOutline,
      timeOutline,
      walletOutline,
      listOutline
    });
  }

  ngOnInit() {
    this.routeSubscription = this.route.paramMap.subscribe((params) => {
      this.slug.set(params.get("slug"));
      this.reload();
    });
    const paramServiceId = this.route.snapshot.queryParamMap.get("serviceId");
    if (paramServiceId) {
      this.selectedServiceIds.set([paramServiceId]);
    }
    void this.marketplace.ensureFavorites().catch(() => undefined);
    void this.marketplace.ensureSavedSalons().catch(() => undefined);
  }

  selectService(serviceId: string) {
    this.selectedServiceIds.update((ids) => ids.includes(serviceId) ? ids.filter((id) => id !== serviceId) : [...ids, serviceId]);
  }

  openServicePopup(serviceId: string) {
    this.activeCustomizationServiceId.set(serviceId);
  }

  closeServicePopup() {
    this.activeCustomizationServiceId.set("");
  }

  confirmServiceAdd(serviceId: string) {
    if (!this.isServiceSelected(serviceId)) {
      this.selectedServiceIds.update((ids) => [...ids, serviceId]);
    }
    this.recordRecentlyViewedService(serviceId);
    this.closeServicePopup();
  }

  private recordRecentlyViewedService(serviceId: string) {
    try {
      const biz = this.business();
      const service = biz?.services.find((item) => item.id === serviceId);
      if (!biz || !service) return;
      const key = "aura_customer_recently_viewed_businesses";
      const current = JSON.parse(localStorage.getItem(key) || "[]") as Array<{ id?: string; slug?: string; serviceId?: string; serviceName?: string }>;
      const next = [
        {
          id: biz.id,
          slug: biz.slug,
          serviceId: service.id,
          serviceName: service.name,
          viewedAt: new Date().toISOString()
        },
        ...current.filter((item) => item.id !== biz.id && item.slug !== biz.slug)
      ].slice(0, 12);
      localStorage.setItem(key, JSON.stringify(next));
    } catch {
      // Recently viewed service history is optional.
    }
  }

  isServiceSelected(serviceId: string): boolean {
    return this.selectedServiceIds().includes(serviceId);
  }

  selectedServicesLabel(): string {
    const services = this.selectedServices();
    const total = services.reduce((sum, service) => sum + service.pricePaise, 0);
    const minutes = services.reduce((sum, service) => sum + service.durationMinutes, 0);
    return minutes > 0 ? `${this.money(total)} · ${minutes} min` : this.money(total);
  }

  servicePriceLabel(service: ServiceItem): string {
    return service.durationMinutes > 0 ? `${this.money(service.pricePaise)} · ${service.durationMinutes} min` : this.money(service.pricePaise);
  }

  formatServiceName(name: string): string {
    const trimmed = String(name || "").trim().replace(/[_]+/g, " ");
    if (!trimmed) return "";
    return trimmed.split(/\s+/).map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(" ");
  }

  serviceDescription(service: ServiceItem): string {
    const description = String(service.description || "").trim();
    if (description) return description;
    return `${this.formatServiceName(service.category || "Salon")} service · ${service.durationMinutes || 0} min visit`;
  }

  eligibleStaffLabel(service: ServiceItem): string {
    const count = this.staffForService(service).length;
    return count > 0 ? `${count} professional${count === 1 ? "" : "s"} available` : "Any available professional";
  }

  private staffForService(service: ServiceItem): StaffMember[] {
    return this.business()?.staff.filter((staff) => !staff.bookableServiceIds?.length || staff.bookableServiceIds.includes(service.id)) ?? [];
  }

  initials(name: string): string {
    return String(name || "Aura").trim().split(/\s+/).filter(Boolean).slice(0, 2).map((word) => word.charAt(0).toUpperCase()).join("") || "A";
  }

  serviceInitial(name: string): string {
    return String(name || "?").trim().charAt(0).toUpperCase() || "?";
  }

  categoryLabel(cat: string): string {
    return String(cat || "")
      .trim()
      .split(/[\s\-_]+/)
      .filter(Boolean)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  }

  hasRating(): boolean {
    const b = this.business();
    return Boolean(b && Number(b.ratingCount) > 0 && Number(b.ratingAverage) > 0);
  }

  locationSummary(): string {
    const b = this.business();
    if (!b) return "Location";
    if (typeof b.distanceKm === "number" && Number.isFinite(b.distanceKm)) return `${b.distanceKm.toFixed(b.distanceKm < 10 ? 1 : 0)} km away`;
    return b.area || b.city || b.address || "Location";
  }

  todayHoursLabel(): string {
    const b = this.business();
    if (!b) return "Hours today";
    const today = this.todayBusinessHour();
    if (today) {
      if (!today.open) return today.note || "Closed today";
      const open = this.timeOfDayLabel(today.opensAt);
      const close = this.timeOfDayLabel(today.closesAt);
      return open && close ? `${open}–${close}` : today.display || "Open today";
    }
    const open = this.timeOfDayLabel(b.openingTime);
    const close = this.timeOfDayLabel(b.closingTime);
    if (open && close) return `${open}–${close}`;
    return b.hoursLabel || "Hours today";
  }

  private todayBusinessHour() {
    const rows = this.business()?.businessHours ?? [];
    if (!rows.length) return null;
    const dayKeys = this.currentIstDayKeys();
    return rows.find((row) => {
      const day = String(row.day || "").trim().toLowerCase();
      const label = String(row.label || "").trim().toLowerCase();
      return dayKeys.includes(day) || dayKeys.includes(label);
    }) ?? null;
  }

  private currentIstDayKeys(): string[] {
    const now = new Date();
    const long = new Intl.DateTimeFormat("en-US", { weekday: "long", timeZone: "Asia/Kolkata" }).format(now).toLowerCase();
    const short = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "Asia/Kolkata" }).format(now).toLowerCase();
    const index = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"].indexOf(short);
    return [long, short, short.slice(0, 3), String(index), String(index + 1)].filter(Boolean);
  }

  private timeOfDayLabel(value?: string): string {
    const raw = String(value || "").trim();
    if (!raw) return "";
    const match = raw.match(/^(\d{1,2}):(\d{2})/);
    if (!match) return raw;
    const date = new Date();
    date.setHours(Number(match[1]), Number(match[2]), 0, 0);
    return new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit", hour12: true }).format(date).replace(":00", "");
  }

  coverGradientStyle(): string {
    const b = this.business();
    return b?.coverGradient || "linear-gradient(135deg, var(--primary), var(--primary-2), var(--accent))";
  }

  staffGradientStyle(staff: StaffMember): string {
    return staff.avatarGradient || "linear-gradient(145deg, var(--brand-600), var(--brand-800))";
  }

  mySalonHref(): string {
    return this.marketplace.salonMode() ? this.marketplace.salonModeUrl() : "/tabs/my-salon";
  }

  salonModeRoute(): boolean {
    return this.router.url.split(/[?#]/)[0].startsWith("/my-salon/");
  }

  callSalon() {
    const href = this.phoneHref();
    if (href) window.location.href = href;
  }

  async shareBusiness() {
    const b = this.business();
    if (!b) return;
    const url = window.location.href;
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({ title: b.businessName, text: `${b.businessName} — ${b.area}, ${b.city}`, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      await this.feedback.success("Salon link copied to clipboard");
    } catch {
      // Sharing was cancelled or clipboard is unavailable.
    }
  }

  scrollToSection(id: string) {
    const element = document.getElementById(id);
    if (!element) return;
    const reduceMotion = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    element.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
  }

  isLongDescription(description: string): boolean {
    return description.trim().length > 96;
  }

  toggleDescription(serviceId: string) {
    this.expandedServiceId.update((current) => current === serviceId ? "" : serviceId);
  }

  serviceAddOns(service: ServiceItem): { id?: string; name: string; pricePaise?: number }[] {
    const withAddOns = service as ServiceItem & { addOns?: { id?: string; name: string; pricePaise?: number }[]; addons?: { id?: string; name: string; pricePaise?: number }[] };
    return (withAddOns.addOns || withAddOns.addons || []).slice(0, 3);
  }

  serviceNote(serviceId: string): string {
    return this.serviceNotes()[serviceId] || "";
  }

  setServiceNote(serviceId: string, note: string) {
    this.serviceNotes.update((notes) => ({ ...notes, [serviceId]: note }));
  }

  staffBookingParams(staffId: string): { staffId: string } {
    return { staffId };
  }

  bookingQueryParams(): { serviceIds?: string; serviceId?: string; step: number } {
    const ids = this.selectedServiceIds();
    if (ids.length > 1) return { serviceIds: ids.join(","), step: 2 };
    if (ids.length === 1) return { serviceId: ids[0], step: 2 };
    return { step: 2 };
  }

  backHref(): string {
    return this.marketplace.salonMode() ? this.marketplace.salonModeUrl() : "/tabs/home";
  }

  businessProfileLink(slug: string): string {
    return this.marketplace.salonMode() ? this.marketplace.salonModeUrl("business", slug) : `/business/${encodeURIComponent(slug)}`;
  }

  businessBookLink(slug: string): string {
    return this.marketplace.salonMode() ? this.marketplace.salonModeUrl("business", slug, "book") : `/business/${encodeURIComponent(slug)}/book`;
  }

  hubLink(hub: string): string {
    return this.marketplace.salonMode() ? this.marketplace.salonModeUrl(hub) : `/tabs/${encodeURIComponent(hub)}`;
  }

  serviceImage(service: ServiceItem, index: number): string {
    const withImage = service as ServiceItem & { image?: string; imageUrl?: string; photoUrl?: string; thumbnailUrl?: string };
    return withImage.image || withImage.imageUrl || withImage.photoUrl || withImage.thumbnailUrl || "";
  }

  serviceImageBackground(service: ServiceItem, index: number): string {
    return `linear-gradient(135deg, rgba(231, 240, 248, 0.2), rgba(255, 255, 255, 0.18)), url("${this.serviceImage(service, index)}")`;
  }

  ngOnDestroy() {
    this.routeSubscription?.unsubscribe();
  }

  reload() {
    const slug = this.slug();
    if (slug) {
      void Promise.all([
        this.marketplace.loadBusiness(slug),
        this.marketplace.loadPublicBusinesses()
      ]).then(() => this.loadOffers()).catch(() => undefined);
    }
  }

  private loadOffers() {
    const biz = this.business();
    if (biz?.tenantId && biz?.branchId) {
      void this.marketplace.loadSalonOffers(biz.tenantId, biz.branchId).catch(() => undefined);
    }
  }

  money(pricePaise: number): string {
    return this.marketplace.formatMoney(pricePaise);
  }

  paymentLabel(): string {
    const modes = this.business()?.paymentModes ?? [];
    if (modes.includes("online") && modes.includes("pay_at_venue")) return "Online or venue";
    if (modes.includes("online")) return "Online ready";
    return "Pay at venue";
  }

  phoneHref(): string | undefined {
    const phone = this.business()?.appointmentNumber || this.business()?.mobileNumber || this.business()?.phone || "";
    return phone ? `tel:${phone}` : undefined;
  }

  isSaved(): boolean {
    const business = this.business();
    return business ? this.marketplace.isFavorite(business.id) || this.marketplace.isFavorite(business.slug) : false;
  }

  async toggleWishlist() {
    const business = this.business();
    if (!business || this.favoritePending) return;
    if (!this.marketplace.isAuthenticated()) {
      void this.router.navigate(["/login"], { queryParams: { returnUrl: this.router.url } });
      return;
    }
    this.favoritePending = true;
    try {
      const saved = await this.marketplace.toggleFavorite(business.id);
      await this.feedback.success(saved ? "Added to favorites / wishlist" : "Removed from favorites / wishlist");
    } catch {
      await this.feedback.error(this.marketplace.error() || "Could not update favorites. Please try again.");
    } finally {
      this.favoritePending = false;
    }
  }

  isSalonSaved(): boolean {
    const business = this.business();
    return business ? this.marketplace.isSalonSaved(business.id) : false;
  }

  async toggleSavedSalon() {
    const business = this.business();
    if (!business || this.savedSalonPending) return;
    if (!this.marketplace.isAuthenticated()) {
      void this.router.navigate(["/login"], { queryParams: { returnUrl: this.router.url } });
      return;
    }
    this.savedSalonPending = true;
    try {
      const saved = await this.marketplace.toggleSavedSalon(business.id);
      await this.feedback.success(saved ? "Added to saved salons" : "Removed from saved salons");
    } catch {
      await this.feedback.error(this.marketplace.error() || "Could not update saved salons. Please try again.");
    } finally {
      this.savedSalonPending = false;
    }
  }

  async setAsPrimary() {
    const biz = this.business();
    if (!biz) return;
    if (!biz.tenantId || !biz.branchId) {
      await this.feedback.error("This salon cannot be set as primary yet. Missing salon branch details.");
      return;
    }
    if (!this.isAuthenticated()) {
      void this.router.navigate(["/login"], { queryParams: { returnUrl: this.router.url } });
      return;
    }
    try {
      await this.marketplace.setPrimarySalon(biz.tenantId, biz.branchId, biz.id, biz.businessName);
      await this.feedback.success("Primary salon updated");
    } catch {
      await this.feedback.error(this.marketplace.error() || "Could not set primary salon. Please try again.");
    }
  }

  async removeAsPrimary() {
    try {
      await this.marketplace.removePrimarySalon();
      await this.feedback.success("Primary salon removed");
    } catch {
      await this.feedback.error(this.marketplace.error() || "Could not update primary salon. Please try again.");
    }
  }

  offerSummary(offer: PublicOfferItem): string {
    if ("discountSummary" in offer) return offer.discountSummary || offer.description;
    return offer.description;
  }

  offerValidity(offer: PublicOfferItem): { from: string; to: string } | null {
    if ("validFrom" in offer) return { from: offer.validFrom, to: offer.validTo };
    if ("startDate" in offer) return { from: offer.startDate, to: offer.endDate };
    return null;
  }
}
