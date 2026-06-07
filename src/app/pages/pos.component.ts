import { CommonModule, CurrencyPipe } from '@angular/common';
import { Component, HostListener, OnDestroy, OnInit, effect, signal } from '@angular/core';
import { FormsModule, ReactiveFormsModule, UntypedFormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { catchError, distinctUntilChanged, forkJoin, of, Subscription } from 'rxjs';
import { ApiRecord, ApiService } from '../core/api.service';
import { PosActiveBillingDraft, PosHeldInvoiceDraft, PosMembershipPlan, PosPaymentMode, PosSettingsService, PosTipPreset } from '../core/pos-settings.service';
import { AppStateService } from '../core/state/app-state.service';
import { StateComponent } from '../shared/ui/state/state.component';

type ItemDiscountType = 'amount' | 'percent';
type ItemDiscountSource = 'none' | 'manual' | 'membership';

type SaleItem = {
  type: 'service' | 'product' | 'membership' | 'package' | 'gift_card' | 'custom';
  id: string;
  name: string;
  quantity: number;
  price: number;
  gstRate: number;
  staffId?: string;
  staffName?: string;
  staffSplits?: StaffSplitLine[];
  discountPercent?: number;
  discountType?: ItemDiscountType;
  discountValue?: number;
  discountSource?: ItemDiscountSource;
  validityDays?: number;
  serviceCredits?: ApiRecord[];
  packageCredits?: ApiRecord[];
  giftCode?: string;
  expiryDate?: string;
};

type StaffSplitLine = {
  staffId: string;
  staffName: string;
  percent: number;
};

type TipLine = {
  id: string;
  staffId: string;
  staffName: string;
  paymentMode: string;
  amount: number;
  note: string;
};

@Component({
  selector: 'app-pos',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterLink, CurrencyPipe, StateComponent],
  template: `
    <section class="page-stack">
      <div class="module-hero">
        <div>
          <span class="eyebrow">POS / GST billing</span>
        </div>
        <div class="hero-actions">
          <a class="ghost-button" routerLink="/pos/invoices">Invoices</a>
          <a class="ghost-button" routerLink="/pos/holds">Held invoices</a>
          <a class="ghost-button" routerLink="/pos/tips">Tip register</a>
          <button class="ghost-button" type="button" (click)="printInvoice()" [disabled]="!invoice()">Print invoice</button>
        </div>
      </div>

      <section class="client-crm-strip" *ngIf="selectedClient() as client">
        <article class="client-crm-tile identity">
          <span>Name</span>
          <strong>{{ client.name || 'Client' }}</strong>
          <small>{{ client.phone || client.email || client.id }}</small>
          <a
            class="ghost-button mini client-crm-edit-button"
            *ngIf="client.id"
            [routerLink]="['/clients']"
            [queryParams]="{ edit: client.id }"
          >
            Edit
          </a>
        </article>
        <article class="client-crm-tile">
          <span>E-wallet Amt</span>
          <strong>{{ Number(client.walletBalance || 0) | currency: 'INR':'symbol':'1.0-0' }}</strong>
          <small>Available wallet balance</small>
        </article>
        <article class="client-crm-tile">
          <span>Unpaid Amt</span>
          <strong [class.due-amount]="Number(client.unpaidBalance || 0) > 0">
            {{ Number(client.unpaidBalance || 0) | currency: 'INR':'symbol':'1.0-0' }}
          </strong>
          <small>Pending invoice balance</small>
        </article>
        <ng-container *ngIf="selectedClientMembership() as membership; else noClientMembershipSnapshot">
          <article class="client-crm-tile">
            <span>Membership assign date</span>
            <strong>{{ membershipTakenDate(membership) }}</strong>
            <small>{{ membership.planName || 'Active membership' }}</small>
          </article>
          <article class="client-crm-tile">
            <span>Membership expire date</span>
            <strong>{{ membershipExpiryDate(membership) }}</strong>
            <small>{{ selectedClientMembershipStatus() }}</small>
          </article>
        </ng-container>
        <ng-template #noClientMembershipSnapshot>
          <article class="client-crm-tile muted-tile">
            <span>Membership assign date</span>
            <strong>-</strong>
            <small>No active membership</small>
          </article>
          <article class="client-crm-tile muted-tile">
            <span>Membership expire date</span>
            <strong>-</strong>
            <small>No active membership</small>
          </article>
        </ng-template>
      </section>

      <app-state [loading]="loading()" [error]="error()"></app-state>
      <div class="state warning" *ngIf="dataHint()">{{ dataHint() }}</div>

      <div class="pos-layout" *ngIf="!loading()">
        <section class="panel">
          <form [formGroup]="form" class="pos-form">
            <div class="client-search-row pos-client-search-row">
            <label class="field smart-search-field pos-floating-search client-search-field" style="min-width: 0;">
              <span>Client</span>
              <input
                type="search"
                [ngModel]="clientSearchText"
                (ngModelChange)="setClientSearch($event)"
                (focus)="clientSearchActive = true"
                (blur)="closeClientSearchSoon()"
                [ngModelOptions]="{ standalone: true }"
                placeholder="Search By Name/Contact/Address/File No/Card Number (Atleast 3 Characters are required)"
              />
              <div class="smart-search-results pos-search-results client-search-results" *ngIf="showClientResults()">
                <button
                  type="button"
                  *ngFor="let client of filteredClients()"
                  (mousedown)="$event.preventDefault()"
                  (click)="selectClient(client)"
                >
                  <strong>{{ client.name || 'Client' }}</strong>
                  <span>{{ client.phone || client.email || client.id }}</span>
                  <span>{{ clientMembershipSearchSnapshot(client) }}</span>
                </button>
              </div>
              <small *ngIf="clientSearchText && clientSearchText.length < 3">Type 3 characters to search clients.</small>
            </label>
            <button class="ghost-button fit pos-add-client-button" type="button" *ngIf="canCreateClientFromSearch()" (click)="openClientFormFromSearch()">Add client</button>
            <div class="client-search-actions">
              <button class="dark-button fit" type="button" (click)="useWalkinClient()">Walkin Client</button>
              <button class="ghost-button fit" type="button" (click)="holdInvoice()">Hold invoice</button>
            </div>
            </div>
            <div class="branch-context-card">
              <span>Header branch</span>
              <strong>{{ currentBranchName() }}</strong>
              <small>POS billing is locked to the top header branch.</small>
            </div>
            <label class="field billing-date-field">
              <span>Invoice date</span>
              <input type="date" formControlName="invoiceDate" [attr.max]="invoiceDateMax" />
              <small>Back-date invoice ke liye billing date select karo.</small>
            </label>
            <label class="field smart-search-field pos-floating-search staff-search-field">
              <span>Staff</span>
              <div class="staff-search-input-wrap">
                <input
                  type="search"
                  [ngModel]="staffSearchText"
                  (ngModelChange)="setStaffSearch($event)"
                  (focus)="staffSearchActive = true"
                  (blur)="closeStaffSearchSoon()"
                  [ngModelOptions]="{ standalone: true }"
                  placeholder="Search staff by name, phone, role"
                />
                <button
                  class="staff-clear-button"
                  *ngIf="staffSearchText"
                  type="button"
                  aria-label="Clear staff"
                  (mousedown)="$event.preventDefault()"
                  (click)="clearStaffSelection()"
                >
                  x
                </button>
              </div>
              <div class="smart-search-results pos-search-results staff-search-results" *ngIf="showStaffResults()">
                <button
                  type="button"
                  *ngFor="let person of filteredStaff()"
                  (mousedown)="$event.preventDefault()"
                  (click)="selectStaff(person)"
                >
                  <strong>{{ person.name || person.fullName || 'Staff' }}</strong>
                  <span>{{ staffResultMeta(person) }}</span>
                </button>
              </div>
              <small *ngIf="staffSearchText && staffSearchActive && !filteredStaff().length">No matching active staff found.</small>
            </label>
            <label class="field">
              <span>Completed appointment</span>
              <select formControlName="appointmentId">
                <option value="">Walk-in / no appointment</option>
                <option *ngFor="let appointment of billableAppointments()" [value]="appointment.id">
                  {{ clientName(appointment.clientId) }} · {{ appointment.startAt | date: 'short' }}
                </option>
              </select>
            </label>
          </form>

          <section class="form-panel pos-client-form" *ngIf="showClientForm()">
            <div class="section-title compact-title">
              <div>
                <span class="eyebrow">Add client from POS</span>
                <h2>New client details</h2>
              </div>
              <button class="ghost-button mini" type="button" (click)="closeClientForm()">Close form</button>
            </div>
            <form [formGroup]="clientForm" (ngSubmit)="saveClientFromPos()">
              <label class="field">
                <span>Name</span>
                <input formControlName="name" />
              </label>
              <label class="field">
                <span>Phone</span>
                <input formControlName="phone" />
              </label>
              <label class="field">
                <span>Email</span>
                <input type="email" formControlName="email" />
              </label>
              <label class="field">
                <span>Birthday</span>
                <input type="date" formControlName="birthday" />
              </label>
              <label class="field">
                <span>Anniversary</span>
                <input type="date" formControlName="anniversary" />
              </label>
              <label class="field">
                <span>Tags</span>
                <select formControlName="tag">
                  <option>new</option>
                  <option>VIP</option>
                  <option>inactive</option>
                  <option>high spender</option>
                  <option>pos-created</option>
                </select>
              </label>
              <label class="field full">
                <span>Notes</span>
                <textarea formControlName="notes"></textarea>
              </label>
              <div class="form-actions">
                <button class="ghost-button" type="button" (click)="closeClientForm()">Cancel</button>
                <button class="primary-button" type="submit" [disabled]="clientForm.invalid || clientSaving()">Save client</button>
              </div>
            </form>
          </section>

          <div class="catalog-picker">
            <label class="field smart-search-field">
              <span>Add service</span>
              <input
                type="search"
                [ngModel]="serviceSearchText"
                (ngModelChange)="setServiceSearch($event)"
                (focus)="serviceSearchActive = true"
                (blur)="closeServiceSearchSoon()"
                [ngModelOptions]="{ standalone: true }"
                placeholder="Type service name, e.g. cut"
              />
              <div class="smart-search-results service-search-results" *ngIf="showServiceResults()">
                <button
                  class="service-result-option"
                  type="button"
                  *ngFor="let service of filteredServices()"
                  [class.selected]="isServiceSelected(service.id)"
                  (mousedown)="$event.preventDefault()"
                  (click)="toggleServiceSelection(service)"
                >
                  <span class="multi-select-box" [class.checked]="isServiceSelected(service.id)" aria-hidden="true"></span>
                  <span class="result-copy">
                    <strong>{{ service.name || 'Service' }}</strong>
                    <span>{{ service.category || 'Service' }} · ₹{{ service.price || 0 }}</span>
                  </span>
                  <span class="select-pill">{{ isServiceSelected(service.id) ? 'Selected' : 'Select' }}</span>
                </button>
                <div class="service-result-actions">
                  <button type="button" (mousedown)="$event.preventDefault()" (click)="selectVisibleServices()">Select visible</button>
                  <button type="button" *ngIf="selectedServiceIds.length" (mousedown)="$event.preventDefault()" (click)="clearServiceSelection()">Clear</button>
                </div>
              </div>
              <small class="smart-search-hint selected" *ngIf="selectedServiceIds.length">
                {{ selectedServiceIds.length }} service selected. Add dabane par sab invoice me add honge.
              </small>
              <small class="smart-search-hint" *ngIf="serviceSearchActive && serviceSearchText.trim().length > 0 && filteredServices().length > 1">
                Multiple service match hain. Jo chahiye unko tick karo.
              </small>
              <small class="smart-search-hint is-empty" *ngIf="serviceSearchActive && serviceSearchText.trim().length > 0 && !filteredServices().length">
                Is naam se service nahi mili.
              </small>
            </label>
            <button class="ghost-button" type="button" (click)="addSelectedService()" [disabled]="!selectedServiceIds.length">
              {{ selectedServiceIds.length ? 'Add ' + selectedServiceIds.length : 'Add' }}
            </button>
            <label class="field smart-search-field">
              <span>Add product</span>
              <input
                type="search"
                [ngModel]="productSearchText"
                (ngModelChange)="setProductSearch($event)"
                (focus)="productSearchActive = true"
                (blur)="closeProductSearchSoon()"
                [ngModelOptions]="{ standalone: true }"
                placeholder="Type product name, SKU, barcode"
              />
              <div class="smart-search-results service-search-results" *ngIf="showProductResults()">
                <button
                  class="service-result-option"
                  type="button"
                  *ngFor="let product of filteredProducts()"
                  [class.selected]="isProductSelected(product.id)"
                  (mousedown)="$event.preventDefault()"
                  (click)="toggleProductSelection(product)"
                >
                  <span class="multi-select-box" [class.checked]="isProductSelected(product.id)" aria-hidden="true"></span>
                  <span class="result-copy">
                    <strong>{{ product.name || 'Product' }}</strong>
                    <span>{{ product.category || product.sku || 'Product' }} · ₹{{ product.price || 0 }} · {{ product.stock || 0 }} left</span>
                  </span>
                  <span class="select-pill">{{ isProductSelected(product.id) ? 'Selected' : 'Select' }}</span>
                </button>
                <div class="service-result-actions">
                  <button type="button" (mousedown)="$event.preventDefault()" (click)="selectVisibleProducts()">Select visible</button>
                  <button type="button" *ngIf="selectedProductIds.length" (mousedown)="$event.preventDefault()" (click)="clearProductSelection()">Clear</button>
                </div>
              </div>
              <small class="smart-search-hint selected" *ngIf="selectedProductIds.length">
                {{ selectedProductIds.length }} product selected. Add dabane par sab invoice me add honge.
              </small>
              <small class="smart-search-hint" *ngIf="productSearchActive && productSearchText.trim().length > 0 && filteredProducts().length > 1">
                Multiple product match hain. Jo chahiye unko tick karo.
              </small>
              <small class="smart-search-hint is-empty" *ngIf="productSearchActive && productSearchText.trim().length > 0 && !filteredProducts().length">
                Is naam se product nahi mila.
              </small>
            </label>
            <button class="ghost-button" type="button" (click)="addSelectedProduct()" [disabled]="!selectedProductIds.length">
              {{ selectedProductIds.length ? 'Add ' + selectedProductIds.length : 'Add' }}
            </button>
          </div>

          <div class="benefit-lines">
            <label class="field">
              <span>Membership sale</span>
              <select #membershipPlanSelect>
                <option value="">Choose membership</option>
                <option *ngFor="let plan of activeMembershipPlans()" [value]="plan.id">{{ plan.name }} - ₹{{ plan.price }} / {{ plan.discountPercent }}% every bill</option>
              </select>
            </label>
            <button class="ghost-button" type="button" (click)="addMembershipPlan(membershipPlanSelect.value); membershipPlanSelect.value = ''">Add</button>

            <label class="field">
              <span>Package sale</span>
              <select #packageSelect>
                <option value="">Choose package</option>
                <option *ngFor="let itemPackage of packages()" [value]="itemPackage.id">{{ itemPackage.name }} - ₹{{ itemPackage.price }}</option>
              </select>
            </label>
            <button class="ghost-button" type="button" (click)="addPackage(packageSelect.value); packageSelect.value = ''">Add</button>

            <label class="field">
              <span>Gift card sale</span>
              <input #giftCardAmount type="number" min="0" placeholder="Gift card amount" />
            </label>
            <button class="ghost-button" type="button" (click)="addGiftCard(giftCardAmount.value); giftCardAmount.value = ''">Add</button>
          </div>

          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Staff</th>
                  <th>Qty</th>
                  <th>Price</th>
                  <th>Discount</th>
                  <th>GST</th>
                  <th>Total</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let item of items(); let index = index">
                  <td>
                    <span style="display: block; margin-bottom: 6px; color: #64748b; font-size: 12px; font-weight: 800; text-transform: uppercase;">{{ itemCategoryTitle(item) }}</span>
                    <span>{{ item.name }}</span>
                  </td>
                  <td>
                    <div class="line-staff-box" [class.has-splits]="item.staffSplits?.length">
                      <div class="staff-primary-row">
                        <select class="line-staff-select" [ngModel]="item.staffId || ''" (ngModelChange)="setItemStaff(item, $event)" [ngModelOptions]="{ standalone: true }">
                          <option value="">Unassigned</option>
                          <option *ngFor="let person of staff()" [value]="person.id">{{ person.name }}</option>
                        </select>
                        <button class="ghost-button mini split-action" type="button" (click)="addStaffSplit(item)">
                          {{ item.staffSplits?.length ? '+ Staff' : 'Split' }}
                        </button>
                      </div>
                      <div class="split-lines" *ngIf="item.staffSplits?.length">
                        <div class="split-line" *ngFor="let split of item.staffSplits; let splitIndex = index">
                          <span class="split-number">{{ splitIndex + 1 }}</span>
                          <select class="split-staff-select" [ngModel]="split.staffId" (ngModelChange)="setItemSplitStaff(item, splitIndex, $event)" [ngModelOptions]="{ standalone: true }">
                            <option value="">Staff</option>
                            <option *ngFor="let person of staff()" [value]="person.id">{{ person.name }}</option>
                          </select>
                          <div class="split-percent-field">
                            <input type="number" min="0" max="100" [ngModel]="split.percent" (ngModelChange)="setItemSplitPercent(item, splitIndex, $event)" [ngModelOptions]="{ standalone: true }" />
                            <span>%</span>
                          </div>
                          <button class="icon-button split-remove" type="button" title="Remove split" (click)="removeStaffSplit(item, splitIndex)">x</button>
                        </div>
                        <small class="split-total" [class.warning-text]="splitPercentTotal(item) !== 100">
                          Split total {{ splitPercentTotal(item) }}%
                        </small>
                      </div>
                    </div>
                  </td>
                  <td><input class="small-input" type="number" min="1" [(ngModel)]="item.quantity" (ngModelChange)="touchItems()" /></td>
                  <td><input class="small-input" type="number" min="0" [(ngModel)]="item.price" (ngModelChange)="touchItems()" /></td>
                  <td>
                    <div class="line-discount-cell">
                      <div class="line-discount-control">
                        <select
                          [ngModel]="item.discountType || 'amount'"
                          (ngModelChange)="setItemDiscountType(item, $event)"
                          [ngModelOptions]="{ standalone: true }"
                        >
                          <option value="amount">₹</option>
                          <option value="percent">%</option>
                        </select>
                        <input
                          type="number"
                          min="0"
                          [ngModel]="item.discountValue || 0"
                          (ngModelChange)="setItemDiscountValue(item, $event)"
                          [ngModelOptions]="{ standalone: true }"
                        />
                      </div>
                      <small *ngIf="lineDiscountAmount(item) > 0">
                        {{ lineDiscountSourceLabel(item) }} {{ lineDiscountAmount(item) | currency: 'INR':'symbol':'1.0-0' }}
                      </small>
                    </div>
                  </td>
                  <td>{{ item.gstRate }}%</td>
                  <td class="line-total-cell">
                    <strong>{{ lineTotal(item) | currency: 'INR':'symbol':'1.0-0' }}</strong>
                    <small *ngIf="lineDiscountAmount(item) > 0">
                      Gross {{ lineGross(item) | currency: 'INR':'symbol':'1.0-0' }}
                    </small>
                  </td>
                  <td><button class="ghost-button mini" type="button" (click)="removeItem(index)">Remove</button></td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <aside class="panel checkout-panel">
          <div class="section-title">
            <div>
              <span class="eyebrow">Invoice summary</span>
            </div>
          </div>
          <div class="summary-control-grid summary-control-grid--discount">
            <label class="field">
              <span>Discount</span>
              <input type="number" min="0" [(ngModel)]="discount" />
            </label>
            <label class="field">
              <span>Type</span>
              <select [(ngModel)]="discountMode">
                <option value="amount">₹</option>
                <option value="percent">%</option>
              </select>
            </label>
            <label class="field">
              <span>Coupon code</span>
              <input type="text" [(ngModel)]="couponCode" (ngModelChange)="clearCoupon()" placeholder="GLOW10" />
            </label>
            <button class="ghost-button summary-apply-button" type="button" (click)="validateCoupon()" [disabled]="couponChecking() || !couponCode || !items().length || !form.value.branchId">
              {{ couponChecking() ? 'Checking...' : 'Apply' }}
            </button>
          </div>
          <p class="inline-hint" *ngIf="couponMessage()">{{ couponMessage() }}</p>
          <div class="summary-control-grid summary-control-grid--membership">
            <label class="field">
              <span>Membership credits to redeem</span>
              <input type="number" min="0" [(ngModel)]="creditsUsed" />
            </label>
            <label class="field">
              <span>Membership</span>
              <select [(ngModel)]="membershipId">
                <option value="">No redemption</option>
                <option *ngFor="let membership of memberships()" [value]="membership.id">{{ membership.planName }} - {{ membership.creditsRemaining }} credits</option>
              </select>
            </label>
          </div>

          <section class="tip-box">
            <div class="section-title compact-title tip-box-title">
              <span class="eyebrow">Staff tips</span>
              <a class="ghost-button mini" routerLink="/pos/tips">Tip register</a>
            </div>
            <div class="tip-draft-grid">
              <label class="field">
                <span>Staff</span>
                <select [(ngModel)]="tipDraft.staffId">
                  <option value="">Use invoice staff</option>
                  <option *ngFor="let person of staff()" [value]="person.id">{{ person.name }}</option>
                </select>
              </label>
              <label class="field">
                <span>Amount</span>
                <input type="number" min="0" [(ngModel)]="tipDraft.amount" />
              </label>
              <button class="ghost-button tip-add-button" type="button" (click)="addTip()">Add tip</button>
            </div>
            <p class="inline-hint" *ngIf="tipMessage()">{{ tipMessage() }}</p>
            <div class="tip-lines" *ngIf="tips().length">
              <article *ngFor="let tip of tips(); let index = index">
                <div>
                  <strong>{{ tip.staffName }}</strong>
                  <span>Invoice tip</span>
                </div>
                <strong>{{ tip.amount | currency: 'INR':'symbol':'1.0-0' }}</strong>
                <button class="ghost-button mini" type="button" (click)="removeTip(index)">Remove</button>
              </article>
            </div>
          </section>

          <div class="summary-lines">
            <div><span>Subtotal</span><strong>{{ subtotal | currency: 'INR':'symbol':'1.0-0' }}</strong></div>
            <div><span>Manual discount</span><strong>{{ manualDiscountAmount | currency: 'INR':'symbol':'1.0-0' }}</strong></div>
            <div *ngIf="membershipAutoDiscount > 0"><span>{{ membershipAutoDiscountLabel }}</span><strong>{{ membershipAutoDiscount | currency: 'INR':'symbol':'1.0-0' }}</strong></div>
            <div><span>Coupon discount</span><strong>{{ couponDiscount | currency: 'INR':'symbol':'1.0-0' }}</strong></div>
            <div><span>GST</span><strong>{{ gst | currency: 'INR':'symbol':'1.0-0' }}</strong></div>
            <div><span>Staff tips</span><strong>{{ tipTotal | currency: 'INR':'symbol':'1.0-0' }}</strong></div>
            <div class="total"><span>Total</span><strong>{{ total | currency: 'INR':'symbol':'1.0-0' }}</strong></div>
            <div><span>Paid now</span><strong>{{ paidTotal | currency: 'INR':'symbol':'1.0-0' }}</strong></div>
            <div [class.total]="balanceDue > 0"><span>Balance due</span><strong>{{ balanceDue | currency: 'INR':'symbol':'1.0-0' }}</strong></div>
          </div>

          <div class="payment-header">
            <div class="payment-title-copy">
              <span class="eyebrow">Click to fill balance</span>
              <h2>Payment collection</h2>
            </div>
            <div class="payment-actions">
              <button
                class="ghost-button mini wallet-action-button"
                type="button"
                [class.ready]="walletButtonReady"
                [disabled]="!walletButtonReady"
                (click)="handleWalletButton()"
              >
                {{ walletButtonLabel }}
              </button>
              <a class="ghost-button mini" routerLink="/pos/payment-modes">Manage modes</a>
            </div>
          </div>
          <div class="payment-grid">
            <label
              class="field payment-mode-card"
              *ngFor="let mode of activePaymentModes()"
              [class.filled]="paymentAmount(mode.id) > 0"
              (click)="fillPaymentDue(mode.id)"
            >
              <span>{{ mode.label }} <small>{{ paymentHint(mode.id) }}</small></span>
              <input
                type="number"
                min="0"
                [ngModel]="paymentAmount(mode.id)"
                (ngModelChange)="setPaymentAmount(mode.id, $event)"
                (focus)="fillPaymentDue(mode.id)"
              />
            </label>
          </div>
          <section class="unpaid-receive-box" *ngIf="selectedClientUnpaidBalance > 0">
            <div class="unpaid-receive-copy">
              <span class="eyebrow">Receive old balance</span>
              <strong>{{ selectedClientUnpaidBalance | currency: 'INR':'symbol':'1.0-0' }}</strong>
              <small>Clear pending dues from previous invoices before or with this bill.</small>
            </div>
            <label class="field">
              <span>Amount</span>
              <input
                type="number"
                min="0"
                [max]="selectedClientUnpaidBalance"
                name="unpaidReceiveAmount"
                [ngModel]="unpaidReceiveAmount"
                (ngModelChange)="setUnpaidReceiveAmount($event)"
                [ngModelOptions]="{ standalone: true }"
              />
            </label>
            <label class="field">
              <span>Mode</span>
              <select
                name="unpaidReceiveMode"
                [(ngModel)]="unpaidReceiveMode"
                [ngModelOptions]="{ standalone: true }"
              >
                <option *ngFor="let mode of activePaymentModes()" [value]="mode.id">{{ mode.label }}</option>
              </select>
            </label>
            <button class="ghost-button" type="button" (click)="fillUnpaidReceiveAmount()">Fill due</button>
            <button class="primary-button" type="button" (click)="receiveUnpaid()" [disabled]="!canReceiveUnpaid">
              Receive unpaid
            </button>
          </section>
          <p class="inline-hint" *ngIf="unpaidReceiveMessage()">{{ unpaidReceiveMessage() }}</p>
          <p class="inline-hint" *ngIf="overPaid > 0 && !walletCreditRequested()">Extra {{ overPaid | currency: 'INR':'symbol':'1.0-0' }} received. Click Wallet to add extra amount to client wallet.</p>
          <p class="inline-hint wallet-status" *ngIf="walletCreditRequested() && overPaid > 0">After invoice save, {{ overPaid | currency: 'INR':'symbol':'1.0-0' }} will be credited to this client's wallet.</p>
          <p class="inline-hint" *ngIf="selectedClient() as client">Wallet balance: {{ Number(client.walletBalance || 0) | currency: 'INR':'symbol':'1.0-0' }}</p>

          <button class="primary-button full-button" type="button" (click)="checkout()" [disabled]="!canSaveCheckout">
            {{ saving() ? 'Saving sale...' : 'Save sale and invoice' }}
          </button>

          <section class="invoice-preview" *ngIf="invoice() as invoice">
            <span class="eyebrow">Invoice generated</span>
            <h3>{{ invoice.invoiceNumber }}</h3>
            <p>Status: <strong>{{ invoice.status }}</strong></p>
            <button class="ghost-button" type="button" (click)="downloadInvoice()">Download invoice</button>
          </section>
        </aside>
      </div>
    </section>
  `,
  styles: [`
    :host .pos-layout,
    :host .pos-layout > .panel,
    :host .pos-form {
      overflow: visible;
    }

    :host .pos-client-search-row {
      position: relative;
      z-index: 35;
      overflow: visible;
    }

    :host .pos-floating-search {
      position: relative;
      z-index: 30;
    }

    :host .pos-floating-search:focus-within {
      z-index: 120;
    }

    :host .pos-search-results {
      position: absolute;
      top: calc(100% + 8px);
      left: 0;
      right: 0;
      z-index: 1000;
      display: grid;
      max-height: min(340px, 42vh);
      overflow-y: auto;
      padding: 8px;
      border: 1px solid rgba(15, 118, 110, 0.22);
      border-radius: 18px;
      background: rgba(255, 255, 255, 0.98);
      box-shadow: 0 26px 70px rgba(15, 23, 42, 0.2);
      backdrop-filter: blur(12px);
    }

    :host .client-search-results {
      width: min(100%, 780px);
    }

    :host .staff-search-results {
      max-height: min(280px, 36vh);
    }

    :host .staff-search-input-wrap {
      position: relative;
    }

    :host .staff-search-input-wrap input {
      padding-right: 44px;
    }

    :host .staff-clear-button {
      position: absolute;
      top: 50%;
      right: 12px;
      width: 26px;
      height: 26px;
      display: grid;
      place-items: center;
      transform: translateY(-50%);
      border: 0;
      border-radius: 999px;
      color: #0f766e;
      background: rgba(15, 118, 110, 0.1);
      font-weight: 900;
      cursor: pointer;
    }

    :host .pos-search-results button {
      min-height: 48px;
      border-radius: 12px;
    }

    :host .pos-search-results button:hover,
    :host .pos-search-results button:focus-visible {
      background: rgba(15, 118, 110, 0.09);
      outline: 0;
    }
  `]
})
export class PosComponent implements OnInit, OnDestroy {
  readonly clients = signal<ApiRecord[]>([]);
  readonly staff = signal<ApiRecord[]>([]);
  readonly services = signal<ApiRecord[]>([]);
  readonly products = signal<ApiRecord[]>([]);
  readonly branches = signal<ApiRecord[]>([]);
  readonly appointments = signal<ApiRecord[]>([]);
  readonly invoices = signal<ApiRecord[]>([]);
  readonly memberships = signal<ApiRecord[]>([]);
  readonly packages = signal<ApiRecord[]>([]);
  readonly membershipPlans = signal<PosMembershipPlan[]>([]);
  readonly membershipEligibility = signal<ApiRecord | null>(null);
  readonly membershipSuggestion = signal<ApiRecord | null>(null);
  readonly items = signal<SaleItem[]>([]);
  readonly paymentModes = signal<PosPaymentMode[]>([]);
  readonly tipPresets = signal<PosTipPreset[]>([]);
  readonly tips = signal<TipLine[]>([]);
  readonly invoice = signal<ApiRecord | null>(null);
  readonly couponResult = signal<ApiRecord | null>(null);
  readonly couponMessage = signal('');
  readonly tipMessage = signal('');
  readonly walletCreditRequested = signal(false);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly couponChecking = signal(false);
  readonly error = signal('');
  readonly dataHint = signal('');
  readonly showClientForm = signal(false);
  readonly clientSaving = signal(false);
  discount = 0;
  discountMode: 'amount' | 'percent' = 'amount';
  couponCode = '';
  creditsUsed = 0;
  membershipId = '';
  clientSearchText = '';
  staffSearchText = '';
  serviceSearchText = '';
  productSearchText = '';
  clientSearchActive = false;
  staffSearchActive = false;
  serviceSearchActive = false;
  productSearchActive = false;
  selectedServiceId = '';
  selectedServiceIds: string[] = [];
  selectedProductId = '';
  selectedProductIds: string[] = [];
  currentHoldId = '';
  private pendingHoldId = '';
  payments: Record<string, number> = {};
  tipDraft = { staffId: '', paymentMode: 'card', amount: 0, note: '' };
  unpaidReceiveAmount = 0;
  unpaidReceiveMode = 'cash';
  readonly unpaidReceiveMessage = signal('');
  readonly Number = Number;
  readonly invoiceDateMax = this.todayDateInput();

  readonly form = this.fb.group({
    clientId: ['', Validators.required],
    branchId: ['', Validators.required],
    staffId: [''],
    appointmentId: [''],
    invoiceDate: [this.invoiceDateMax, Validators.required]
  });

  readonly clientForm = this.fb.group({
    name: ['', Validators.required],
    phone: ['', Validators.required],
    email: [''],
    birthday: [''],
    anniversary: [''],
    tag: ['new'],
    notes: ['']
  });
  private fallbackTried = false;
  private fallbackNotice = false;
  private activeDraftRestored = false;
  private suppressActiveDraftPersistence = false;
  private readonly loadFailures = new Set<string>();
  private readonly branchSelectionSub = new Subscription();
  private branchSyncReady = false;

  constructor(
    private readonly api: ApiService,
    private readonly fb: UntypedFormBuilder,
    private readonly posSettings: PosSettingsService,
    private readonly appState: AppStateService,
    private readonly route: ActivatedRoute
  ) {
    effect(() => {
      const branchId = this.appState.selectedBranchId();
      this.syncHeaderBranchToForm(branchId, true);
      if (this.branchSyncReady) this.load();
    });
  }

  ngOnInit(): void {
    this.pendingHoldId = this.route.snapshot.queryParamMap.get('holdId') || '';
    this.syncHeaderBranchToForm(this.appState.selectedBranchId(), false);
    const branchControl = this.form.get('branchId');
    if (branchControl) {
      this.branchSelectionSub.add(
        branchControl.valueChanges.pipe(distinctUntilChanged()).subscribe((branchId) => {
          this.loadStaffForBranch(String(branchId || ''));
        })
      );
    }
    this.loadPosSettings();
    this.branchSyncReady = true;
    this.load();
  }

  ngOnDestroy(): void {
    this.branchSelectionSub.unsubscribe();
    this.persistActiveBillingDraft();
  }

  @HostListener('window:beforeunload')
  persistActiveBillingDraft(): void {
    if (this.suppressActiveDraftPersistence) {
      return;
    }
    if (!this.hasActiveBillingDraftDetails()) {
      this.posSettings.clearActiveBillingDraft();
      return;
    }
    this.posSettings.saveActiveBillingDraft(this.buildActiveBillingDraft());
  }

  get subtotal(): number {
    return this.items().reduce((sum, item) => sum + this.lineGross(item), 0);
  }

  get itemDiscountTotal(): number {
    return this.money(this.items().reduce((sum, item) => sum + this.lineDiscountAmount(item), 0));
  }

  get itemManualDiscountTotal(): number {
    return this.money(
      this.items()
        .filter((item) => item.discountSource !== 'membership')
        .reduce((sum, item) => sum + this.lineDiscountAmount(item), 0)
    );
  }

  get billLevelDiscount(): number {
    const base = Math.max(0, this.subtotal - this.itemDiscountTotal);
    return this.money(Math.min(base, this.manualDiscountAmount + this.couponDiscount));
  }

  get gst(): number {
    const itemTaxableSubtotal = Math.max(0, this.subtotal - this.itemDiscountTotal);
    const afterBillDiscountRatio = itemTaxableSubtotal
      ? Math.max(0, itemTaxableSubtotal - this.billLevelDiscount) / itemTaxableSubtotal
      : 0;
    return this.money(
      this.items().reduce((sum, item) => {
        const taxable = this.lineTaxableSubtotal(item) * afterBillDiscountRatio;
        return sum + taxable * (Number(item.gstRate) / 100);
      }, 0)
    );
  }

  get total(): number {
    return this.money(Math.max(0, this.subtotal - this.totalDiscount) + this.gst + this.tipTotal);
  }

  get tipTotal(): number {
    return this.money(this.tips().reduce((sum, tip) => sum + Number(tip.amount || 0), 0));
  }

  get paidTotal(): number {
    return this.money(Object.values(this.payments).reduce((sum, amount) => sum + Number(amount || 0), 0));
  }

  get balanceDue(): number {
    return this.money(Math.max(0, this.total - this.paidTotal));
  }

  get overPaid(): number {
    return this.money(Math.max(0, this.paidTotal - this.total));
  }

  get walletBalance(): number {
    return this.money(Number(this.selectedClient()?.walletBalance || 0));
  }

  get selectedClientUnpaidBalance(): number {
    return this.money(Number(this.selectedClient()?.unpaidBalance || 0));
  }

  get canReceiveUnpaid(): boolean {
    return !this.saving()
      && !!this.form.value.clientId
      && this.selectedClientUnpaidBalance > 0
      && this.money(Number(this.unpaidReceiveAmount || 0)) > 0
      && this.unpaidInvoicesForSelectedClient().length > 0;
  }

  get redeemableWalletAmount(): number {
    return this.money(Math.min(this.balanceDue, this.walletBalance));
  }

  get walletButtonReady(): boolean {
    return !!this.form.value.clientId && (this.overPaid > 0 || this.redeemableWalletAmount > 0);
  }

  get walletButtonLabel(): string {
    if (!this.form.value.clientId) return 'Wallet';
    if (this.overPaid > 0) {
      return this.walletCreditRequested()
        ? `Wallet +₹${this.overPaid}`
        : `Add ₹${this.overPaid} to wallet`;
    }
    if (this.redeemableWalletAmount > 0) return `Redeem ₹${this.redeemableWalletAmount}`;
    return `Wallet ₹${this.walletBalance}`;
  }

  get canSaveCheckout(): boolean {
    return !this.saving() && !!this.items().length && !this.form.invalid && (this.overPaid <= 0 || this.walletCreditRequested());
  }

  get couponDiscount(): number {
    return Number(this.couponResult()?.discountAmount || 0);
  }

  get manualDiscountAmount(): number {
    const value = Math.max(0, Number(this.discount || 0));
    const base = Math.max(0, this.subtotal - this.itemDiscountTotal);
    if (this.discountMode === 'percent') {
      return this.money((base * Math.min(value, 100)) / 100);
    }
    return this.money(value);
  }

  get membershipAutoDiscount(): number {
    return this.money(
      this.items()
        .filter((item) => item.discountSource === 'membership')
        .reduce((sum, item) => sum + this.lineDiscountAmount(item), 0)
    );
  }

  get membershipAutoDiscountLabel(): string {
    const membership = this.activeMembershipForClient();
    const percent = this.activeMembershipDiscountPercent();
    return membership ? `${membership.planName} ${percent}% discount` : 'Membership discount';
  }

  get totalDiscount(): number {
    return this.money(Math.min(this.subtotal, this.itemDiscountTotal + this.billLevelDiscount));
  }

  load(): void {
    this.loading.set(true);
    this.error.set('');
    if (!this.fallbackNotice) this.dataHint.set('');
    this.loadFailures.clear();

    forkJoin({
      clients: this.safeList('clients', { limit: 1000 }),
      staff: this.safeList('staff-os/staff', this.staffQueryParams()),
      services: this.safeList('services', { limit: 1000 }),
      products: this.safeList('products', { limit: 1000 }),
      branches: this.safeList('branches', { limit: 1000 }),
      appointments: this.safeList('appointments', { limit: 1000 }),
      memberships: this.safeList('memberships', { limit: 1000 }),
      invoices: this.safeList('invoices', { limit: 1000 }),
      walletTransactions: this.safeList('walletTransactions', { limit: 5000 }),
      packages: this.safeList('packages', { limit: 1000 }),
      packagesAllBranches: this.safeList('packages', { limit: 1000, includeAllBranches: true }),
      membershipPlans: this.safeList('membership-enterprise/plans')
    }).subscribe({
      next: ({ clients, staff, services, products, branches, appointments, memberships, invoices, walletTransactions, packages, packagesAllBranches, membershipPlans }) => {
        if (this.shouldSwitchToDemoTenant({ clients, staff, services, products, branches })) {
          this.fallbackTried = true;
          this.fallbackNotice = true;
          this.appState.setTenant('tenant_aura');
          this.dataHint.set('Current tenant me POS catalog empty hai. Aura demo tenant load kar raha hoon.');
          this.load();
          return;
        }
        const clientsWithWallet = this.withWalletBalances(clients || [], walletTransactions || []);
        const clientsWithBalances = this.withUnpaidBalances(clientsWithWallet, invoices || []);
        this.invoices.set(invoices || []);
        this.clients.set(clientsWithBalances);
        this.applyStaffRows(staff || [], branches || []);
        this.services.set(services || []);
        this.products.set(products || []);
        this.branches.set(branches || []);
        this.appointments.set(appointments || []);
        this.memberships.set(memberships || []);
        const packageRows = packages?.length ? packages : packagesAllBranches || [];
        this.packages.set(packageRows);
        const livePlans = (membershipPlans || []).map((plan) => this.normalizeMembershipPlan(plan as PosMembershipPlan));
        if (livePlans.length) {
          this.membershipPlans.set(livePlans);
          this.posSettings.saveMembershipPlans(livePlans);
        }
        this.applyDefaultBranch(branches || []);
        this.reloadStaffIfBranchScopeChanged(staff || []);
        this.setDataHint({ clients, staff, services, products, branches });
        const hadPendingHold = !!this.pendingHoldId;
        this.restorePendingHold();
        if (!hadPendingHold) this.restoreActiveBillingDraft();
        this.applyRouteClientSelection(clientsWithBalances);
        this.loading.set(false);
      },
      error: (error) => {
        this.error.set(error?.error?.error || 'Unable to load POS data');
        this.loading.set(false);
      }
    });
  }

  loadPosSettings(): void {
    const modes = this.posSettings.loadPaymentModes().filter((mode) => mode.active);
    this.paymentModes.set(modes);
    this.tipPresets.set(this.posSettings.loadTipPresets());
    this.membershipPlans.set(this.posSettings.loadMembershipPlans());
    const nextPayments: Record<string, number> = {};
    for (const mode of modes) {
      nextPayments[mode.id] = Number(this.payments[mode.id] || 0);
    }
    this.payments = nextPayments;
    this.tipDraft.paymentMode = modes[0]?.id || 'cash';
  }

  private applyRouteClientSelection(clients: ApiRecord[]): void {
    if (this.currentHoldId) {
      return;
    }
    const params = this.route.snapshot.queryParamMap;
    const appointmentId = params.get('appointmentId') || '';
    if (appointmentId && this.applyRouteAppointmentSelection(appointmentId, clients)) {
      return;
    }
    if (this.form.value.clientId) {
      return;
    }
    const clientId = params.get('clientId') || '';
    const queryPhone = this.phoneDigits(params.get('q') || '');
    if (!clientId && !queryPhone) {
      return;
    }
    const target = clients.find((client) => clientId && String(client.id) === clientId)
      || clients.find((client) => queryPhone && this.clientPhoneDigits(client) === queryPhone);
    if (!target) {
      return;
    }

    this.selectClient(target);
    const receiveDue = Number(params.get('receiveDue') || 0);
    if (receiveDue > 0) {
      this.setUnpaidReceiveAmount(receiveDue);
    }
  }

  private applyRouteAppointmentSelection(appointmentId: string, clients: ApiRecord[]): boolean {
    const appointment = this.appointments().find((item) => String(item.id || '') === appointmentId);
    if (!appointment) return false;
    const clientId = String(appointment.clientId || '');
    const client = clients.find((item) => String(item.id || '') === clientId);
    if (client) {
      this.selectClient(client);
    } else {
      this.form.patchValue({ clientId }, { emitEvent: false });
      this.clientSearchText = clientId;
    }
    const staffId = String(appointment.staffId || '');
    const staff = this.staff().find((person) => String(person.id || '') === staffId);
    if (staff) {
      this.selectStaff(staff);
    } else {
      this.form.patchValue({ staffId }, { emitEvent: false });
      this.staffSearchText = staffId;
    }
    this.form.patchValue({ appointmentId }, { emitEvent: false });
    this.items.set([]);
    for (const serviceId of this.appointmentServiceIds(appointment)) {
      this.addService(serviceId);
    }
    this.serviceSearchText = '';
    this.selectedServiceIds = [];
    this.dataHint.set(`Appointment ${appointmentId} POS me load ho gaya. Services bill me add ho gayi hain.`);
    return true;
  }

  activePaymentModes(): PosPaymentMode[] {
    return this.paymentModes().filter((mode) => mode.active).sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0));
  }

  activeTipPresets(): PosTipPreset[] {
    return this.tipPresets().filter((preset) => preset.active);
  }

  activeMembershipPlans(): PosMembershipPlan[] {
    return this.membershipPlans().filter((plan) => plan.active);
  }

  paymentAmount(modeId: string): number {
    return Number(this.payments[modeId] || 0);
  }

  setPaymentAmount(modeId: string, value: number | string): void {
    const rawAmount = this.money(Number(value || 0));
    const amount = modeId === 'wallet' ? Math.min(rawAmount, this.walletBalance) : rawAmount;
    this.payments = { ...this.payments, [modeId]: this.money(amount) };
    this.walletCreditRequested.set(false);
  }

  fillPaymentDue(modeId: string): void {
    if (this.paymentAmount(modeId) > 0 || this.balanceDue <= 0) return;
    const amount = modeId === 'wallet' ? this.redeemableWalletAmount : this.balanceDue;
    if (amount > 0) this.setPaymentAmount(modeId, amount);
  }

  paymentHint(modeId: string): string {
    const amount = this.paymentAmount(modeId);
    if (amount > 0) return `₹${amount} applied`;
    if (modeId === 'wallet' && this.walletBalance > 0) return `redeem ₹${this.redeemableWalletAmount}`;
    if (modeId === 'wallet') return 'wallet ₹0';
    if (this.balanceDue > 0) return `click ₹${this.balanceDue}`;
    return 'settled';
  }

  paymentModeLabel(modeId: string): string {
    return this.paymentModes().find((mode) => mode.id === modeId)?.label || modeId;
  }

  handleWalletButton(): void {
    if (this.overPaid > 0) {
      this.walletCreditRequested.set(true);
      return;
    }
    this.redeemWalletBalance();
  }

  redeemWalletBalance(): void {
    if (this.redeemableWalletAmount <= 0) return;
    this.setPaymentAmount('wallet', this.redeemableWalletAmount);
  }

  addTip(): void {
    const amount = this.money(this.tipDraft.amount);
    const staffId = this.tipDraft.staffId || String(this.form.value.staffId || '');
    const staffName = this.staff().find((person) => person.id === staffId)?.name || '';
    if (!staffId || !staffName) {
      this.tipMessage.set('Tip ke liye staff select karna zaroori hai.');
      return;
    }
    if (amount <= 0) {
      this.tipMessage.set('Tip amount 0 se bada hona chahiye.');
      return;
    }
    const mode = this.tipDraft.paymentMode || this.activePaymentModes()[0]?.id || 'cash';
    this.tips.update((tips) => [
      ...tips,
      {
        id: `tip_${Date.now()}_${tips.length}`,
        staffId,
        staffName,
        paymentMode: mode,
        amount,
        note: this.tipDraft.note || ''
      }
    ]);
    this.tipDraft = { staffId: '', paymentMode: mode, amount: 0, note: '' };
    this.tipMessage.set('');
  }

  removeTip(index: number): void {
    this.tips.update((tips) => tips.filter((_, itemIndex) => itemIndex !== index));
  }

  holdInvoice(): void {
    if (!this.items().length) {
      this.error.set('Hold invoice ke liye at least ek service, product, membership, package ya gift card add karo.');
      return;
    }
    const draft = this.buildHeldInvoiceDraft();
    this.posSettings.upsertHeldInvoice(draft);
    this.posSettings.clearActiveBillingDraft();
    this.dataHint.set(`Invoice hold ho gaya: ${draft.title}. Held invoices page se resume kar sakte ho.`);
    this.resetDraftAfterHold();
  }

  filteredClients(): ApiRecord[] {
    const query = this.normalizeSearch(this.clientSearchText);
    if (query.length < 3) return [];
    return this.clients()
      .filter((client) => this.normalizeSearch(`${client.name || ''} ${client.phone || ''} ${client.email || ''} ${client.address || ''} ${client.cardNumber || ''} ${client.fileNo || ''}`).includes(query))
      .slice(0, 25);
  }

  filteredStaff(): ApiRecord[] {
    const query = this.normalizeSearch(this.staffSearchText);
    const staff = this.staff();
    if (!query) return staff.slice(0, 25);
    return staff
      .filter((person) =>
        this.normalizeSearch(`${person.name || ''} ${person.fullName || ''} ${person.phone || ''} ${person.mobile || ''} ${person.role || ''} ${person.designation || ''} ${person.employeeCode || ''}`).includes(query)
      )
      .slice(0, 25);
  }

  filteredServices(): ApiRecord[] {
    const query = this.normalizeSearch(this.serviceSearchText);
    if (!query) return this.services().slice(0, 25);
    return this.services()
      .filter((service) => this.normalizeSearch(`${service.name || ''} ${service.category || ''} ${service.description || ''}`).includes(query))
      .slice(0, 25);
  }

  filteredProducts(): ApiRecord[] {
    const query = this.normalizeSearch(this.productSearchText);
    if (!query) return this.products().slice(0, 25);
    return this.products()
      .filter((product) =>
        this.normalizeSearch(`${product.name || ''} ${product.category || ''} ${product.brand || ''} ${product.sku || ''} ${product.barcode || ''}`).includes(query)
      )
      .slice(0, 25);
  }

  showClientResults(): boolean {
    return this.clientSearchActive && this.normalizeSearch(this.clientSearchText).length >= 3 && this.filteredClients().length > 0;
  }

  showStaffResults(): boolean {
    return this.staffSearchActive && this.filteredStaff().length > 0;
  }

  showServiceResults(): boolean {
    return this.serviceSearchActive && this.normalizeSearch(this.serviceSearchText).length > 0 && this.filteredServices().length > 0;
  }

  showProductResults(): boolean {
    return this.productSearchActive && this.normalizeSearch(this.productSearchText).length > 0 && this.filteredProducts().length > 0;
  }

  canCreateClientFromSearch(): boolean {
    const query = this.normalizeSearch(this.clientSearchText);
    return query.length >= 3 && !this.form.value.clientId && this.filteredClients().length === 0;
  }

  clientOption(client: ApiRecord): string {
    return String(client.name || client.phone || client.email || client.id || 'Client');
  }

  staffOption(person: ApiRecord): string {
    return String(person.name || person.fullName || person.phone || person.mobile || person.id || 'Staff');
  }

  staffResultMeta(person: ApiRecord): string {
    const role = person.role || person.designation || person.specialization || person.department || 'Staff';
    const phone = person.phone || person.mobile || person.contact || person.phoneNumber || '';
    const branch = person.branchName || person.branch || '';
    return [role, phone, branch].filter(Boolean).join(' · ');
  }

  clientMembershipSearchSnapshot(client: ApiRecord): string {
    const active = this.activeMembershipForClientId(String(client.id || ''));
    const walletBalance = Number(client.walletBalance || 0);
    if (!active) return `Wallet ₹${walletBalance} · No active membership`;
    return `Wallet ₹${walletBalance} · ${active.planName || 'Membership'} · ${Number(active.creditsRemaining || 0)} credits`;
  }

  private invoiceClientId(invoice: ApiRecord): string {
    return String(invoice.clientId || invoice.client_id || invoice.customerId || invoice.customer_id || '');
  }

  private phoneDigits(value: unknown): string {
    const digits = String(value || '').replace(/\D/g, '');
    return digits.length > 10 ? digits.slice(-10) : digits;
  }

  private clientPhoneDigits(client: ApiRecord | undefined): string {
    if (!client) {
      return '';
    }
    return this.phoneDigits(client.phone || client.mobile || client.whatsapp || client.contact || client.phoneNumber || client.mobileNumber || '');
  }

  private invoicePhoneDigits(invoice: ApiRecord): string {
    return this.phoneDigits(
      invoice.clientPhone ||
        invoice.customerPhone ||
        invoice.phone ||
        invoice.mobile ||
        invoice.customerMobile ||
        invoice.clientMobile ||
        ''
    );
  }

  private invoiceKey(invoice: ApiRecord): string {
    return String(invoice.id || invoice.invoiceId || invoice.invoice_id || invoice.invoiceNumber || invoice.invoice_no || invoice.createdAt || invoice.created_at || 'invoice');
  }

  private invoiceBalance(invoice: ApiRecord): number {
    const direct = invoice.balance ?? invoice.balanceDue ?? invoice.dueAmount ?? invoice.due_amount ?? invoice.due;
    if (direct !== undefined && direct !== null && direct !== '') {
      return Math.max(0, this.money(Number(direct)));
    }
    const total = Number(invoice.grandTotal ?? invoice.grand_total ?? invoice.total ?? 0);
    const paid = Number(invoice.paidAmount ?? invoice.paid_amount ?? invoice.paid ?? 0);
    return Math.max(0, this.money(total - paid));
  }

  private invoiceDateMs(invoice: ApiRecord): number {
    return this.dateMs(invoice.createdAt || invoice.created_at || invoice.date || invoice.updatedAt || invoice.updated_at);
  }

  private unpaidInvoicesForSelectedClient(): Array<ApiRecord & { __balance: number }> {
    const clientId = String(this.form.value.clientId || '');
    const selected = this.selectedClient();
    if (!clientId || !selected) {
      return [];
    }
    const selectedPhone = this.clientPhoneDigits(selected);
    const matchingClientIds = new Set(
      this.clients()
        .filter((client) => String(client.id) === clientId || (!!selectedPhone && this.clientPhoneDigits(client) === selectedPhone))
        .map((client) => String(client.id))
    );
    return this.invoices()
      .map((invoice) => ({ ...invoice, __balance: this.invoiceBalance(invoice) }))
      .filter((invoice) => {
        if (invoice.__balance <= 0) {
          return false;
        }
        const invoiceClientId = this.invoiceClientId(invoice);
        if (invoiceClientId && matchingClientIds.has(invoiceClientId)) {
          return true;
        }
        return !!selectedPhone && this.invoicePhoneDigits(invoice) === selectedPhone;
      })
      .sort((a, b) => this.invoiceDateMs(a) - this.invoiceDateMs(b));
  }

  private withUnpaidBalances(clients: ApiRecord[], invoices: ApiRecord[]): ApiRecord[] {
    const clientsById = new Map(clients.map((client) => [String(client.id), client]));
    const idsByPhone = new Map<string, string[]>();
    for (const client of clients) {
      const phone = this.clientPhoneDigits(client);
      if (!phone) {
        continue;
      }
      idsByPhone.set(phone, [...(idsByPhone.get(phone) || []), String(client.id)]);
    }

    const unpaidByClient = new Map<string, Map<string, number>>();
    const addInvoiceBalance = (clientId: string, invoiceKey: string, balance: number) => {
      if (!clientId || balance <= 0) {
        return;
      }
      const ledger = unpaidByClient.get(clientId) || new Map<string, number>();
      ledger.set(invoiceKey, balance);
      unpaidByClient.set(clientId, ledger);
    };

    for (const invoice of invoices) {
      const clientId = this.invoiceClientId(invoice);
      const balance = this.invoiceBalance(invoice);
      if (balance <= 0) {
        continue;
      }
      const key = this.invoiceKey(invoice);
      if (clientId) {
        addInvoiceBalance(clientId, key, balance);
      }
      const invoicePhone = this.invoicePhoneDigits(invoice) || this.clientPhoneDigits(clientsById.get(clientId));
      if (!invoicePhone) {
        continue;
      }
      for (const relatedClientId of idsByPhone.get(invoicePhone) || []) {
        addInvoiceBalance(relatedClientId, key, balance);
      }
    }
    return clients.map((client) => ({
      ...client,
      unpaidBalance: unpaidByClient.has(String(client.id))
        ? this.money([...(unpaidByClient.get(String(client.id)) || new Map()).values()].reduce((sum, balance) => sum + balance, 0))
        : this.money(Number(client.unpaidBalance || 0))
    }));
  }

  private withWalletBalances(clients: ApiRecord[], transactions: ApiRecord[]): ApiRecord[] {
    const latestByClient = new Map<string, ApiRecord>();
    for (const transaction of transactions) {
      const clientId = String(transaction.clientId || transaction.client_id || '');
      if (!clientId) continue;
      const current = latestByClient.get(clientId);
      const currentTime = this.dateMs(current?.createdAt || current?.created_at || current?.date || current?.updatedAt);
      const transactionTime = this.dateMs(transaction.createdAt || transaction.created_at || transaction.date || transaction.updatedAt);
      if (!current || transactionTime >= currentTime) {
        latestByClient.set(clientId, transaction);
      }
    }
    return clients.map((client) => {
      const latest = latestByClient.get(String(client.id));
      const linkedBalance = latest?.balanceAfter ?? latest?.balance_after ?? latest?.balance;
      return {
        ...client,
        walletBalance: linkedBalance !== undefined && linkedBalance !== null && linkedBalance !== ''
          ? this.money(Number(linkedBalance))
          : this.money(Number(client.walletBalance || 0))
      };
    });
  }

  serviceOption(service: ApiRecord): string {
    return `${service.name || 'Service'} - ₹${service.price || 0}`;
  }

  productOption(product: ApiRecord): string {
    return `${product.name || 'Product'} - ₹${product.price || 0} (${product.stock || 0} left)`;
  }

  setClientSearch(value: string): void {
    this.clientSearchText = value || '';
    const selected = this.clients().find((client) => this.clientOption(client) === this.clientSearchText);
    this.form.patchValue({ clientId: selected?.id || '' }, { emitEvent: false });
  }

  setStaffSearch(value: string): void {
    this.staffSearchText = value || '';
    this.staffSearchActive = true;
    const selected = this.staff().find((person) => this.staffOption(person) === this.staffSearchText);
    this.form.patchValue({ staffId: selected?.id || '' }, { emitEvent: false });
  }

  setServiceSearch(value: string): void {
    this.serviceSearchText = value || '';
    this.serviceSearchActive = true;
  }

  setProductSearch(value: string): void {
    this.productSearchText = value || '';
    this.productSearchActive = true;
  }

  selectClient(client: ApiRecord): void {
    this.clientSearchText = this.clientOption(client);
    this.form.patchValue({ clientId: client.id }, { emitEvent: false });
    this.clientSearchActive = false;
    this.walletCreditRequested.set(false);
    this.unpaidReceiveAmount = 0;
    this.unpaidReceiveMode = this.activePaymentModes()[0]?.id || 'cash';
    this.unpaidReceiveMessage.set('');
    this.loadMembershipIntelligence(client.id);
  }

  selectStaff(person: ApiRecord): void {
    this.staffSearchText = this.staffOption(person);
    this.form.patchValue({ staffId: person.id }, { emitEvent: false });
    this.staffSearchActive = false;
  }

  clearStaffSelection(): void {
    this.staffSearchText = '';
    this.staffSearchActive = false;
    this.form.patchValue({ staffId: '' }, { emitEvent: false });
  }

  setUnpaidReceiveAmount(value: unknown): void {
    const max = this.selectedClientUnpaidBalance;
    const next = Math.max(0, this.money(Number(value || 0)));
    this.unpaidReceiveAmount = max > 0 ? this.money(Math.min(next, max)) : next;
    this.unpaidReceiveMessage.set('');
  }

  fillUnpaidReceiveAmount(): void {
    const invoiceBalance = this.money(this.unpaidInvoicesForSelectedClient().reduce((sum, invoice) => sum + invoice.__balance, 0));
    this.setUnpaidReceiveAmount(invoiceBalance || this.selectedClientUnpaidBalance);
  }

  receiveUnpaid(): void {
    const requestedAmount = this.money(Number(this.unpaidReceiveAmount || 0));
    const invoices = this.unpaidInvoicesForSelectedClient();
    const totalOpen = this.money(invoices.reduce((sum, invoice) => sum + invoice.__balance, 0));
    if (!this.form.value.clientId || totalOpen <= 0) {
      this.unpaidReceiveMessage.set('Client ka old unpaid balance available nahi hai.');
      return;
    }
    if (requestedAmount <= 0) {
      this.unpaidReceiveMessage.set('Receive amount 0 se bada hona chahiye.');
      return;
    }

    const cappedAmount = this.money(Math.min(requestedAmount, totalOpen));
    const mode = this.unpaidReceiveMode || this.activePaymentModes()[0]?.id || 'cash';
    let remaining = cappedAmount;
    const requests = [];
    for (const invoice of invoices) {
      if (remaining <= 0) {
        break;
      }
      const paymentAmount = this.money(Math.min(remaining, invoice.__balance));
      remaining = this.money(remaining - paymentAmount);
      requests.push(this.api.post<ApiRecord>(`invoices/${invoice.id}/payments`, {
        mode,
        amount: paymentAmount,
        reference: 'POS unpaid receive',
        remarks: 'Old unpaid balance received from POS Billing'
      }));
    }

    if (!requests.length) {
      this.unpaidReceiveMessage.set('Receive karne ke liye pending invoice nahi mila.');
      return;
    }

    this.saving.set(true);
    this.unpaidReceiveMessage.set('');
    forkJoin(requests).pipe(
      catchError((error) => {
        this.unpaidReceiveMessage.set(error?.error?.error || error?.message || 'Unable to receive old unpaid amount');
        return of([] as ApiRecord[]);
      })
    ).subscribe((result) => {
      this.saving.set(false);
      if (!result.length) {
        return;
      }
      this.unpaidReceiveAmount = 0;
      const cappedCopy = requestedAmount > totalOpen
        ? ` Open balance ₹${totalOpen.toLocaleString('en-IN')} tha, isliye amount cap kiya gaya.`
        : '';
      this.unpaidReceiveMessage.set(`Old unpaid ₹${cappedAmount.toLocaleString('en-IN')} received.${cappedCopy}`);
      this.load();
    });
  }

  selectService(service: ApiRecord): void {
    this.serviceSearchText = this.serviceOption(service);
    this.selectedServiceId = service.id;
    this.selectedServiceIds = service.id ? [service.id] : [];
    this.serviceSearchActive = false;
  }

  selectProduct(product: ApiRecord): void {
    this.productSearchText = this.productOption(product);
    this.selectedProductId = product.id;
    this.selectedProductIds = product.id ? [product.id] : [];
    this.productSearchActive = false;
  }

  isServiceSelected(id: string): boolean {
    return this.selectedServiceIds.includes(id);
  }

  isProductSelected(id: string): boolean {
    return this.selectedProductIds.includes(id);
  }

  toggleServiceSelection(service: ApiRecord): void {
    if (!service.id) return;
    this.selectedServiceIds = this.isServiceSelected(service.id)
      ? this.selectedServiceIds.filter((id) => id !== service.id)
      : [...this.selectedServiceIds, service.id];
    this.selectedServiceId = this.selectedServiceIds[0] || '';
    this.serviceSearchActive = true;
  }

  toggleProductSelection(product: ApiRecord): void {
    if (!product.id) return;
    this.selectedProductIds = this.isProductSelected(product.id)
      ? this.selectedProductIds.filter((id) => id !== product.id)
      : [...this.selectedProductIds, product.id];
    this.selectedProductId = this.selectedProductIds[0] || '';
    this.productSearchActive = true;
  }

  selectVisibleServices(): void {
    const next = new Set(this.selectedServiceIds);
    this.filteredServices().forEach((service) => {
      if (service.id) next.add(service.id);
    });
    this.selectedServiceIds = Array.from(next);
    this.selectedServiceId = this.selectedServiceIds[0] || '';
    this.serviceSearchActive = true;
  }

  selectVisibleProducts(): void {
    const next = new Set(this.selectedProductIds);
    this.filteredProducts().forEach((product) => {
      if (product.id) next.add(product.id);
    });
    this.selectedProductIds = Array.from(next);
    this.selectedProductId = this.selectedProductIds[0] || '';
    this.productSearchActive = true;
  }

  clearServiceSelection(): void {
    this.selectedServiceIds = [];
    this.selectedServiceId = '';
    this.serviceSearchActive = true;
  }

  clearProductSelection(): void {
    this.selectedProductIds = [];
    this.selectedProductId = '';
    this.productSearchActive = true;
  }

  closeClientSearchSoon(): void {
    window.setTimeout(() => {
      this.clientSearchActive = false;
    }, 120);
  }

  closeStaffSearchSoon(): void {
    window.setTimeout(() => {
      this.staffSearchActive = false;
    }, 120);
  }

  closeServiceSearchSoon(): void {
    window.setTimeout(() => {
      this.serviceSearchActive = false;
    }, 120);
  }

  closeProductSearchSoon(): void {
    window.setTimeout(() => {
      this.productSearchActive = false;
    }, 120);
  }

  openClientFormFromSearch(): void {
    const raw = this.clientSearchText.trim();
    if (!raw || this.normalizeSearch(raw).length < 3) return;
    const digits = raw.replace(/\D/g, '');
    const looksLikePhone = digits.length > 0 && !/[a-z]/i.test(raw);
    this.clientForm.reset({
      name: looksLikePhone ? '' : raw,
      phone: looksLikePhone ? digits : '',
      email: '',
      birthday: '',
      anniversary: '',
      tag: 'new',
      notes: 'Created from POS billing.'
    });
    this.showClientForm.set(true);
    this.clientSearchActive = false;
  }

  closeClientForm(): void {
    this.showClientForm.set(false);
  }

  saveClientFromPos(): void {
    if (this.clientForm.invalid) {
      this.clientForm.markAllAsTouched();
      return;
    }
    const branchId = this.form.value.branchId || this.appState.selectedBranchId() || 'branch_hyd';
    const value = this.clientForm.value;
    this.clientSaving.set(true);
    this.api.create<ApiRecord>('clients', {
      name: value.name,
      phone: value.phone,
      email: value.email,
      birthday: value.birthday,
      anniversary: value.anniversary,
      branchId,
      tags: [value.tag || 'new'],
      notes: value.notes,
      walletBalance: 0,
      loyaltyPoints: 0,
      visitCount: 0,
      totalSpend: 0,
      visitHistory: [],
      purchaseHistory: [],
      whatsappHistory: [],
      consentForms: []
    }).subscribe({
      next: (client) => {
        this.clients.update((clients) => [client, ...clients]);
        this.selectClient(client);
        this.showClientForm.set(false);
        this.clientSaving.set(false);
      },
      error: (error) => {
        this.error.set(error?.error?.error || 'Unable to save client');
        this.clientSaving.set(false);
      }
    });
  }

  useWalkinClient(): void {
    const existing = this.clients().find((client) => this.normalizeSearch(`${client.name} ${client.phone}`) === 'walk in client 0000000000' || this.normalizeSearch(client.name || '').includes('walk'));
    if (existing) {
      this.clientSearchText = this.clientOption(existing);
      this.form.patchValue({ clientId: existing.id }, { emitEvent: false });
      this.loadMembershipIntelligence(existing.id);
      return;
    }
    const branchId = this.form.value.branchId || this.appState.selectedBranchId() || 'branch_hyd';
    this.api.create<ApiRecord>('clients', {
      name: 'Walk-in Client',
      phone: '0000000000',
      branchId,
      tags: ['walk-in'],
      visitHistory: [],
      purchaseHistory: [],
      whatsappHistory: [],
      consentForms: []
    }).subscribe({
      next: (client) => {
        this.clients.update((clients) => [client, ...clients]);
        this.clientSearchText = this.clientOption(client);
        this.form.patchValue({ clientId: client.id }, { emitEvent: false });
        this.loadMembershipIntelligence(client.id);
      },
      error: (error) => this.error.set(error?.error?.error || 'Unable to create walk-in client')
    });
  }

  billableAppointments(): ApiRecord[] {
    const clientId = this.form.value.clientId;
    return this.appointments().filter((appointment) => appointment.status === 'completed' && (!clientId || appointment.clientId === clientId));
  }

  private appointmentServiceIds(appointment: ApiRecord): string[] {
    const raw = appointment.serviceIds ?? appointment.service_ids ?? appointment.serviceId ?? appointment.service_id ?? [];
    if (Array.isArray(raw)) return raw.map(String).filter(Boolean);
    const value = String(raw || '').trim();
    if (!value) return [];
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.map(String).filter(Boolean) : [String(parsed)].filter(Boolean);
    } catch {
      return value.split(',').map((item) => item.trim()).filter(Boolean);
    }
  }

  addService(id: string): void {
    const service = this.services().find((item) => item.id === id);
    if (!service) return;
    this.items.update((items) => [
      ...items,
      {
        type: 'service',
        id: service.id,
        name: service.name,
        quantity: 1,
        price: Number(service.price),
        gstRate: Number(service.gstRate || 18),
        ...this.defaultItemStaff(),
        ...this.defaultItemDiscount('service')
      }
    ]);
    this.clearCoupon();
  }

  addSelectedService(): void {
    if (!this.selectedServiceIds.length) return;
    this.selectedServiceIds.forEach((id) => this.addService(id));
    this.serviceSearchText = '';
    this.clearServiceSelection();
    this.serviceSearchActive = false;
  }

  addProduct(id: string): void {
    const product = this.products().find((item) => item.id === id);
    if (!product) return;
    this.items.update((items) => [
      ...items,
      {
        type: 'product',
        id: product.id,
        name: product.name,
        quantity: 1,
        price: Number(product.price),
        gstRate: Number(product.gstRate || 18),
        ...this.defaultItemStaff(),
        ...this.defaultItemDiscount('product')
      }
    ]);
    this.clearCoupon();
  }

  addSelectedProduct(): void {
    if (!this.selectedProductIds.length) return;
    this.selectedProductIds.forEach((id) => this.addProduct(id));
    this.productSearchText = '';
    this.clearProductSelection();
    this.productSearchActive = false;
  }

  addMembershipPlan(id: string): void {
    const plan = this.membershipPlans().find((item) => item.id === id);
    if (!plan) return;
    this.items.update((items) => [
      ...items,
      {
        type: 'membership',
        id: plan.id,
        name: plan.name,
        quantity: 1,
        price: Number(plan.price || 0),
        gstRate: 18,
        ...this.defaultItemStaff(),
        discountPercent: Number(plan.discountPercent || 0),
        validityDays: Number(plan.validityDays || 365),
        serviceCredits: [
          { type: 'bill_discount', percent: Number(plan.discountPercent || 0), planId: plan.id },
          { type: 'product_discount', percent: Number(plan.productDiscountPercent || 0), planId: plan.id }
        ]
      }
    ]);
    this.clearCoupon();
  }

  addPackage(id: string): void {
    const itemPackage = this.packages().find((item) => item.id === id);
    if (!itemPackage) return;
    this.items.update((items) => [
      ...items,
      {
        type: 'package',
        id: itemPackage.id,
        name: itemPackage.name,
        quantity: 1,
        price: Number(itemPackage.price || 0),
        gstRate: 18,
        ...this.defaultItemStaff(),
        validityDays: Number(itemPackage.validityDays || 90),
        packageCredits: Array.isArray(itemPackage.packageCredits) ? itemPackage.packageCredits : []
      }
    ]);
    this.clearCoupon();
  }

  addGiftCard(value: number | string): void {
    const amount = this.money(value);
    if (amount <= 0) return;
    const code = `GC-${Date.now().toString().slice(-6)}`;
    this.items.update((items) => [
      ...items,
      {
        type: 'gift_card',
        id: code,
        name: `Gift Card ${code}`,
        quantity: 1,
        price: amount,
        gstRate: 0,
        ...this.defaultItemStaff(),
        giftCode: code,
        expiryDate: this.futureDate(365)
      }
    ]);
    this.clearCoupon();
  }

  removeItem(index: number): void {
    this.items.update((items) => items.filter((_, itemIndex) => itemIndex !== index));
    this.clearCoupon();
  }

  touchItems(): void {
    this.items.set([...this.items()]);
    this.clearCoupon();
  }

  setItemDiscountType(item: SaleItem, type: ItemDiscountType): void {
    item.discountType = type === 'percent' ? 'percent' : 'amount';
    item.discountValue = this.cleanItemDiscountValue(item, item.discountValue || 0);
    item.discountSource = item.discountValue > 0 ? 'manual' : 'none';
    this.touchItems();
  }

  setItemDiscountValue(item: SaleItem, value: number | string): void {
    item.discountValue = this.cleanItemDiscountValue(item, value);
    item.discountSource = item.discountValue > 0 ? 'manual' : 'none';
    this.touchItems();
  }

  setItemStaff(item: SaleItem, staffId: string): void {
    const person = this.staff().find((entry) => entry.id === staffId);
    item.staffId = staffId || '';
    item.staffName = person?.name || '';
    if (item.staffSplits?.length) {
      item.staffSplits[0] = { staffId: item.staffId || '', staffName: item.staffName || '', percent: Number(item.staffSplits[0]?.percent || 0) || 100 };
    }
    this.items.set([...this.items()]);
  }

  addStaffSplit(item: SaleItem): void {
    const primary = {
      staffId: item.staffId || '',
      staffName: item.staffName || '',
      percent: item.staffSplits?.length ? 0 : 50
    };
    const nextPercent = item.staffSplits?.length ? 0 : 50;
    item.staffSplits = item.staffSplits?.length
      ? [...item.staffSplits, { staffId: '', staffName: '', percent: nextPercent }]
      : [primary, { staffId: '', staffName: '', percent: nextPercent }];
    this.items.set([...this.items()]);
  }

  removeStaffSplit(item: SaleItem, index: number): void {
    item.staffSplits = (item.staffSplits || []).filter((_, splitIndex) => splitIndex !== index);
    if (item.staffSplits.length <= 1) item.staffSplits = [];
    this.items.set([...this.items()]);
  }

  setItemSplitStaff(item: SaleItem, index: number, staffId: string): void {
    const person = this.staff().find((entry) => entry.id === staffId);
    const splits = [...(item.staffSplits || [])];
    if (!splits[index]) return;
    splits[index] = { ...splits[index], staffId: staffId || '', staffName: person?.name || '' };
    item.staffSplits = splits;
    if (index === 0) {
      item.staffId = staffId || '';
      item.staffName = person?.name || '';
    }
    this.items.set([...this.items()]);
  }

  setItemSplitPercent(item: SaleItem, index: number, value: number | string): void {
    const splits = [...(item.staffSplits || [])];
    if (!splits[index]) return;
    splits[index] = { ...splits[index], percent: Math.max(0, Math.min(100, this.money(value))) };
    item.staffSplits = splits;
    this.items.set([...this.items()]);
  }

  splitPercentTotal(item: SaleItem): number {
    return Math.round((item.staffSplits || []).reduce((sum, split) => sum + Number(split.percent || 0), 0));
  }

  lineGross(item: SaleItem): number {
    return this.money(Number(item.price || 0) * Number(item.quantity || 1));
  }

  lineDiscountAmount(item: SaleItem): number {
    const gross = this.lineGross(item);
    const value = Math.max(0, Number(item.discountValue || 0));
    const amount = item.discountType === 'percent'
      ? (gross * Math.min(value, 100)) / 100
      : value;
    return this.money(Math.min(gross, amount));
  }

  lineTaxableSubtotal(item: SaleItem): number {
    return this.money(Math.max(0, this.lineGross(item) - this.lineDiscountAmount(item)));
  }

  lineTotal(item: SaleItem): number {
    return this.lineTaxableSubtotal(item);
  }

  lineDiscountSourceLabel(item: SaleItem): string {
    return item.discountSource === 'membership' ? 'Membership' : 'Line discount';
  }

  itemCategoryTitle(item: SaleItem): string {
    const titles: Record<SaleItem['type'], string> = {
      service: 'Service',
      product: 'Product',
      membership: 'Membership sale',
      package: 'Package sale',
      gift_card: 'Gift card sale',
      custom: 'Custom item'
    };
    return titles[item.type] || 'Item';
  }

  private defaultItemStaff(): Pick<SaleItem, 'staffId' | 'staffName'> {
    const staffId = String(this.form.value.staffId || '');
    const person = this.staff().find((item) => item.id === staffId);
    return {
      staffId,
      staffName: person?.name || ''
    };
  }

  private defaultItemDiscount(type: SaleItem['type']): Pick<SaleItem, 'discountType' | 'discountValue' | 'discountSource'> {
    const percent = type === 'service'
      ? this.activeMembershipDiscountPercent()
      : type === 'product'
        ? this.activeMembershipProductDiscountPercent()
        : 0;
    if (percent > 0) {
      return { discountType: 'percent', discountValue: percent, discountSource: 'membership' };
    }
    return { discountType: 'amount', discountValue: 0, discountSource: 'none' };
  }

  private cleanItemDiscountValue(item: SaleItem, value: number | string): number {
    const numeric = Math.max(0, Number(value || 0));
    if (item.discountType === 'percent') return this.money(Math.min(numeric, 100));
    return this.money(Math.min(numeric, this.lineGross(item)));
  }

  selectedClient(): ApiRecord | undefined {
    return this.clients().find((client) => client.id === this.form.value.clientId);
  }

  selectedClientMembership(): ApiRecord | undefined {
    const active = this.activeMembershipForClient();
    if (active) return active;
    const clientId = this.form.value.clientId;
    if (!clientId) return undefined;
    return this.memberships()
      .filter((membership) => membership.clientId === clientId)
      .sort((a, b) => this.dateMs(b.validityDate || b.createdAt) - this.dateMs(a.validityDate || a.createdAt))[0];
  }

  selectedClientMembershipIsExpired(): boolean {
    const membership = this.selectedClientMembership();
    if (!membership?.validityDate) return false;
    return String(membership.validityDate) < new Date().toISOString().slice(0, 10);
  }

  selectedClientMembershipStatus(): string {
    const membership = this.selectedClientMembership();
    if (!membership) return 'No membership';
    const days = this.membershipDaysLeft(membership);
    if (days < 0) return `Expired ${Math.abs(days)}d ago`;
    if (days === 0) return 'Expires today';
    if (days < 30) return `${days}d left`;
    return membership.status === 'active' ? 'Active' : String(membership.status || 'Active');
  }

  membershipTakenDate(membership: ApiRecord): string {
    const history = Array.isArray(membership.redeemHistory) ? membership.redeemHistory : [];
    const sold = history.find((item) => item?.type === 'membership_sale' || item?.type === 'manual_membership_assignment');
    return this.dateLabel(sold?.date || membership.createdAt);
  }

  membershipExpiryDate(membership: ApiRecord): string {
    return membership.validityDate ? this.dateLabel(membership.validityDate) : 'No expiry';
  }

  private todayDateInput(): string {
    const now = new Date();
    const offsetMs = now.getTimezoneOffset() * 60_000;
    return new Date(now.getTime() - offsetMs).toISOString().slice(0, 10);
  }

  private invoiceDateValue(): string {
    const value = String(this.form.value.invoiceDate || '').trim();
    return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : this.todayDateInput();
  }

  private selectedInvoiceTimestamp(): string {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const millis = String(now.getMilliseconds()).padStart(3, '0');
    const offsetMinutes = -now.getTimezoneOffset();
    const sign = offsetMinutes >= 0 ? '+' : '-';
    const offsetHours = String(Math.floor(Math.abs(offsetMinutes) / 60)).padStart(2, '0');
    const offsetRemainder = String(Math.abs(offsetMinutes) % 60).padStart(2, '0');
    return `${this.invoiceDateValue()}T${hours}:${minutes}:${seconds}.${millis}${sign}${offsetHours}:${offsetRemainder}`;
  }

  private buildHeldInvoiceDraft(): PosHeldInvoiceDraft {
    const now = new Date().toISOString();
    const client = this.selectedClient();
    const branch = this.branches().find((item) => item.id === this.form.value.branchId);
    const staff = this.staff().find((item) => item.id === this.form.value.staffId);
    const id = this.currentHoldId || `hold_${Date.now()}`;
    const clientName = client?.name || this.clientSearchText || 'Walk-in client';
    return {
      id,
      title: `${clientName} · ₹${this.total}`,
      clientId: String(this.form.value.clientId || ''),
      clientName,
      branchId: String(this.form.value.branchId || ''),
      branchName: branch?.name || String(this.form.value.branchId || 'Branch'),
      staffId: String(this.form.value.staffId || ''),
      staffName: staff?.name || 'Unassigned',
      appointmentId: String(this.form.value.appointmentId || ''),
      invoiceDate: this.invoiceDateValue(),
      items: this.items(),
      tips: this.tips(),
      payments: { ...this.payments },
      discount: this.manualDiscountAmount,
      discountMode: this.discountMode,
      couponCode: this.couponCode,
      creditsUsed: Number(this.creditsUsed || 0),
      membershipId: this.membershipId,
      subtotal: this.subtotal,
      total: this.total,
      balanceDue: this.balanceDue,
      note: this.currentHoldId ? 'Updated held invoice from POS.' : 'Held from POS before final invoice save.',
      createdAt: this.posSettings.getHeldInvoice(id)?.createdAt || now,
      updatedAt: now
    };
  }

  private buildActiveBillingDraft(): PosActiveBillingDraft {
    const client = this.selectedClient();
    return {
      version: 1,
      currentHoldId: this.currentHoldId,
      clientId: String(this.form.value.clientId || ''),
      clientName: client?.name || this.clientSearchText || '',
      branchId: String(this.form.value.branchId || ''),
      staffId: String(this.form.value.staffId || ''),
      appointmentId: String(this.form.value.appointmentId || ''),
      invoiceDate: this.invoiceDateValue(),
      items: this.items(),
      tips: this.tips(),
      payments: { ...this.payments },
      discount: Number(this.discount || 0),
      discountMode: this.discountMode === 'percent' ? 'percent' : 'amount',
      couponCode: this.couponCode || '',
      couponResult: this.couponResult(),
      couponMessage: this.couponMessage(),
      creditsUsed: Number(this.creditsUsed || 0),
      membershipId: this.membershipId || '',
      clientSearchText: this.clientSearchText || '',
      serviceSearchText: this.serviceSearchText || '',
      productSearchText: this.productSearchText || '',
      selectedServiceId: this.selectedServiceId || '',
      selectedServiceIds: [...this.selectedServiceIds],
      selectedProductId: this.selectedProductId || '',
      selectedProductIds: [...this.selectedProductIds],
      tipDraft: { ...this.tipDraft },
      unpaidReceiveAmount: Number(this.unpaidReceiveAmount || 0),
      unpaidReceiveMode: this.unpaidReceiveMode || this.activePaymentModes()[0]?.id || 'cash',
      walletCreditRequested: this.walletCreditRequested(),
      updatedAt: new Date().toISOString()
    };
  }

  private hasActiveBillingDraftDetails(): boolean {
    const paymentTotal = Object.values(this.payments || {}).reduce((sum, amount) => sum + Number(amount || 0), 0);
    const hasBillContent = !!this.currentHoldId
      || !!this.items().length
      || !!this.tips().length
      || paymentTotal > 0
      || Number(this.discount || 0) > 0
      || !!this.couponCode.trim()
      || Number(this.creditsUsed || 0) > 0
      || !!this.membershipId
      || this.selectedServiceIds.length > 0
      || this.selectedProductIds.length > 0;
    if (this.invoice() && !hasBillContent) {
      return false;
    }
    return !!this.currentHoldId
      || !!this.form.value.clientId
      || !!this.items().length
      || !!this.tips().length
      || paymentTotal > 0
      || Number(this.discount || 0) > 0
      || !!this.couponCode.trim()
      || Number(this.creditsUsed || 0) > 0
      || !!this.membershipId
      || !!this.clientSearchText.trim()
      || !!this.serviceSearchText.trim()
      || !!this.productSearchText.trim()
      || this.selectedServiceIds.length > 0
      || this.selectedProductIds.length > 0;
  }

  private restoreActiveBillingDraft(): void {
    if (this.activeDraftRestored || this.pendingHoldId) {
      return;
    }
    this.activeDraftRestored = true;
    const draft = this.posSettings.loadActiveBillingDraft();
    if (!draft) {
      return;
    }
    this.currentHoldId = draft.currentHoldId || '';
    this.form.patchValue({
      clientId: draft.clientId || '',
      branchId: draft.branchId || this.form.value.branchId || '',
      staffId: draft.staffId || '',
      appointmentId: draft.appointmentId || '',
      invoiceDate: draft.invoiceDate || this.todayDateInput()
    }, { emitEvent: false });
    this.items.set((draft.items || []) as SaleItem[]);
    this.tips.set((draft.tips || []) as TipLine[]);
    this.payments = {
      ...Object.fromEntries(this.activePaymentModes().map((mode) => [mode.id, 0])),
      ...(draft.payments || {})
    };
    this.discount = Number(draft.discount || 0);
    this.discountMode = draft.discountMode === 'percent' ? 'percent' : 'amount';
    this.couponCode = draft.couponCode || '';
    this.couponResult.set((draft.couponResult || null) as ApiRecord | null);
    this.couponMessage.set(draft.couponMessage || '');
    this.creditsUsed = Number(draft.creditsUsed || 0);
    this.membershipId = draft.membershipId || '';
    this.clientSearchText = draft.clientSearchText || (draft.clientId
      ? this.clientOption(this.clients().find((client) => client.id === draft.clientId) || { id: draft.clientId, name: draft.clientName })
      : '');
    this.staffSearchText = draft.staffId
      ? this.staffOption(this.staff().find((person) => person.id === draft.staffId) || { id: draft.staffId, name: draft.staffId })
      : '';
    this.serviceSearchText = draft.serviceSearchText || '';
    this.productSearchText = draft.productSearchText || '';
    this.selectedServiceId = draft.selectedServiceId || '';
    this.selectedServiceIds = Array.isArray(draft.selectedServiceIds) ? draft.selectedServiceIds : [];
    this.selectedProductId = draft.selectedProductId || '';
    this.selectedProductIds = Array.isArray(draft.selectedProductIds) ? draft.selectedProductIds : [];
    this.tipDraft = {
      staffId: draft.tipDraft?.staffId || '',
      paymentMode: draft.tipDraft?.paymentMode || this.activePaymentModes()[0]?.id || 'cash',
      amount: Number(draft.tipDraft?.amount || 0),
      note: draft.tipDraft?.note || ''
    };
    this.unpaidReceiveAmount = Number(draft.unpaidReceiveAmount || 0);
    this.unpaidReceiveMode = draft.unpaidReceiveMode || this.activePaymentModes()[0]?.id || 'cash';
    this.walletCreditRequested.set(!!draft.walletCreditRequested);
    if (draft.clientId) this.loadMembershipIntelligence(draft.clientId);
    this.dataHint.set('Unsaved POS bill restore ho gaya. Checkout, Hold invoice, ya clear action ke baad hi ye draft hatega.');
  }

  private restorePendingHold(): void {
    const id = this.pendingHoldId;
    if (!id) return;
    const draft = this.posSettings.getHeldInvoice(id);
    this.pendingHoldId = '';
    if (!draft) {
      this.dataHint.set('Selected held invoice nahi mila. Ho sakta hai delete ya save ho chuka ho.');
      return;
    }
    this.currentHoldId = draft.id;
    this.form.patchValue({
      clientId: draft.clientId || '',
      branchId: draft.branchId || this.form.value.branchId || '',
      staffId: draft.staffId || '',
      appointmentId: draft.appointmentId || '',
      invoiceDate: draft.invoiceDate || this.todayDateInput()
    }, { emitEvent: false });
    this.items.set((draft.items || []) as SaleItem[]);
    this.tips.set((draft.tips || []) as TipLine[]);
    this.payments = {
      ...Object.fromEntries(this.activePaymentModes().map((mode) => [mode.id, 0])),
      ...(draft.payments || {})
    };
    this.walletCreditRequested.set(false);
    this.discount = Number(draft.discount || 0);
    this.discountMode = draft.discountMode === 'percent' ? 'percent' : 'amount';
    this.couponCode = draft.couponCode || '';
    this.creditsUsed = Number(draft.creditsUsed || 0);
    this.membershipId = draft.membershipId || '';
    this.clientSearchText = draft.clientId
      ? this.clientOption(this.clients().find((client) => client.id === draft.clientId) || { id: draft.clientId, name: draft.clientName })
      : draft.clientName || '';
    this.staffSearchText = draft.staffId
      ? this.staffOption(this.staff().find((person) => person.id === draft.staffId) || { id: draft.staffId, name: draft.staffName })
      : '';
    if (draft.clientId) this.loadMembershipIntelligence(draft.clientId);
    this.dataHint.set(`Held invoice resume ho gaya: ${draft.title}`);
  }

  private resetDraftAfterHold(): void {
    this.currentHoldId = '';
    this.items.set([]);
    this.tips.set([]);
    this.payments = Object.fromEntries(this.activePaymentModes().map((mode) => [mode.id, 0]));
    this.walletCreditRequested.set(false);
    this.discount = 0;
    this.discountMode = 'amount';
    this.couponCode = '';
    this.creditsUsed = 0;
    this.membershipId = '';
    this.clientSearchText = '';
    this.staffSearchText = '';
    this.serviceSearchText = '';
    this.productSearchText = '';
    this.selectedServiceId = '';
    this.selectedServiceIds = [];
    this.selectedProductId = '';
    this.selectedProductIds = [];
    this.staffSearchActive = false;
    this.productSearchActive = false;
    this.membershipEligibility.set(null);
    this.membershipSuggestion.set(null);
    this.form.patchValue({ clientId: '', staffId: '', appointmentId: '', invoiceDate: this.todayDateInput() }, { emitEvent: false });
    this.clearCoupon();
  }

  clearCoupon(): void {
    this.couponResult.set(null);
    this.couponMessage.set('');
  }

  validateCoupon(): void {
    const code = this.couponCode.trim();
    if (!code || !this.items().length) return;
    this.couponChecking.set(true);
    this.couponMessage.set('');
    this.api.post<ApiRecord>('sales/coupons/validate', {
      code,
      branchId: this.form.value.branchId || '',
      items: this.items(),
      subtotal: this.subtotal
    }).subscribe({
      next: (result) => {
        this.couponResult.set(result);
        const isGiftCard = result['giftCard'] || result.coupon?.['source'] === 'gift_card';
        this.couponMessage.set(isGiftCard
          ? `Gift card ${result.coupon?.['code'] || code} applied: ${result.discountAmount || 0} redeemable`
          : `Applied ${result.coupon?.['code'] || code}: ${result.discountAmount || 0} discount`);
        this.couponChecking.set(false);
      },
      error: (error) => {
        this.couponResult.set(null);
        this.couponMessage.set(error?.error?.error || 'Coupon could not be applied');
        this.couponChecking.set(false);
      }
    });
  }

  checkout(): void {
    if (this.form.invalid || !this.items().length) {
      this.form.markAllAsTouched();
      return;
    }
    if (this.overPaid > 0 && !this.walletCreditRequested()) {
      this.error.set('Extra payment ko client wallet me add karne ke liye Wallet button click karo.');
      return;
    }
    this.saving.set(true);
    this.error.set('');
    const walletCreditAmount = this.walletCreditRequested() ? this.overPaid : 0;
    const splitPayments = this.invoicePaymentEntries();
    const billingDate = this.invoiceDateValue();
    const billingTimestamp = this.selectedInvoiceTimestamp();
    this.api.post<{ sale: ApiRecord; invoice: ApiRecord; coupon?: ApiRecord | null; invoiceDocument?: ApiRecord }>('sales/checkout', {
      ...this.form.value,
      billingDate,
      invoiceDate: billingDate,
      billingTimestamp,
      items: this.items().map((item) => ({
        ...item,
        lineGross: this.lineGross(item),
        lineDiscountAmount: this.lineDiscountAmount(item),
        lineTaxableSubtotal: this.lineTaxableSubtotal(item)
      })),
      discount: this.money(this.manualDiscountAmount + this.itemManualDiscountTotal),
      discountMode: 'amount',
      discountBreakdown: {
        manualDiscountAmount: this.manualDiscountAmount,
        itemDiscountTotal: this.itemDiscountTotal,
        itemManualDiscountTotal: this.itemManualDiscountTotal,
        membershipAutoDiscount: this.membershipAutoDiscount,
        couponDiscount: this.couponDiscount,
        totalDiscount: this.totalDiscount
      },
      couponCode: this.couponCode.trim(),
      payments: splitPayments,
      tips: this.tips(),
      tipTotal: this.tipTotal,
      membershipRedeem: {
        ...(this.membershipId ? { membershipId: this.membershipId, creditsUsed: Number(this.creditsUsed || 0) } : {}),
        autoDiscountAmount: this.membershipAutoDiscount,
        autoDiscountPercent: this.activeMembershipDiscountPercent(),
        autoDiscountMembershipId: this.activeMembershipForClient()?.id || ''
      }
    }).subscribe({
      next: (result) => {
        if (walletCreditAmount > 0) {
          this.creditOverpayToWallet(result, walletCreditAmount);
          return;
        }
        this.finishCheckout(result);
      },
      error: (error) => {
        this.error.set(error?.error?.error || 'Unable to save sale');
        this.saving.set(false);
      }
    });
  }

  private invoicePaymentEntries(): Array<{ mode: string; amount: number; reference: string; label: string }> {
    let remaining = this.total;
    const entries: Array<{ mode: string; amount: number; reference: string; label: string }> = [];
    for (const [mode, rawAmount] of Object.entries(this.payments)) {
      if (remaining <= 0) break;
      const amount = Math.min(this.money(rawAmount), remaining);
      if (amount <= 0) continue;
      entries.push({
        mode,
        amount,
        reference: mode === 'upi' ? 'UPI collected at counter' : '',
        label: this.paymentModeLabel(mode)
      });
      remaining = this.money(remaining - amount);
    }
    return entries;
  }

  private creditOverpayToWallet(
    result: { sale: ApiRecord; invoice: ApiRecord; coupon?: ApiRecord | null; invoiceDocument?: ApiRecord },
    amount: number
  ): void {
    const clientId = String(this.form.value.clientId || '');
    this.api.post<{ transaction: ApiRecord; client: ApiRecord }>(`clients/${clientId}/wallet`, {
      type: 'credit',
      amount,
      branchId: this.form.value.branchId || '',
      referenceType: 'invoice_overpay',
      referenceId: result.invoice.id,
      notes: `Extra POS payment from invoice ${result.invoice.invoiceNumber || result.invoice.id}`,
      billingDate: this.invoiceDateValue(),
      createdAt: this.selectedInvoiceTimestamp()
    }).subscribe({
      next: (walletResult) => {
        if (walletResult?.client) {
          this.clients.update((clients) => clients.map((client) => client.id === walletResult.client.id ? walletResult.client : client));
        }
        this.finishCheckout(result, `Extra ₹${amount} client wallet me add ho gaya.`);
      },
      error: (error) => {
        this.invoice.set(result.invoice);
        this.error.set(`Invoice save ho gaya, lekin wallet credit fail hua: ${error?.error?.error || error?.message || 'wallet error'}`);
        this.saving.set(false);
      }
    });
  }

  private finishCheckout(
    result: { sale: ApiRecord; invoice: ApiRecord; coupon?: ApiRecord | null; invoiceDocument?: ApiRecord },
    message = ''
  ): void {
    this.invoice.set(result.invoice);
    this.couponResult.set(result.coupon || null);
    if (this.currentHoldId) this.posSettings.deleteHeldInvoice(this.currentHoldId);
    this.posSettings.clearActiveBillingDraft();
    this.currentHoldId = '';
    this.items.set([]);
    this.tips.set([]);
    this.payments = Object.fromEntries(this.activePaymentModes().map((mode) => [mode.id, 0]));
    this.walletCreditRequested.set(false);
    this.discount = 0;
    this.discountMode = 'amount';
    this.couponCode = '';
    this.creditsUsed = 0;
    this.membershipId = '';
    this.staffSearchText = '';
    this.serviceSearchText = '';
    this.productSearchText = '';
    this.selectedServiceId = '';
    this.selectedServiceIds = [];
    this.selectedProductId = '';
    this.selectedProductIds = [];
    this.staffSearchActive = false;
    this.tipDraft = { staffId: '', paymentMode: this.activePaymentModes()[0]?.id || 'cash', amount: 0, note: '' };
    this.unpaidReceiveAmount = 0;
    this.unpaidReceiveMessage.set('');
    this.form.patchValue({ invoiceDate: this.todayDateInput() }, { emitEvent: false });
    this.saving.set(false);
    this.load();
    if (message) window.setTimeout(() => this.dataHint.set(message), 600);
  }

  printInvoice(): void {
    window.print();
  }

  downloadInvoice(): void {
    const invoice = this.invoice();
    if (!invoice) return;
    this.api.post<ApiRecord>(`invoices/${invoice.id}/document`, {}).subscribe({
      next: (documentRecord) => {
        const blob = new Blob([String(documentRecord.content || '')], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${invoice.invoiceNumber}.html`;
        link.click();
        URL.revokeObjectURL(url);
      },
      error: (error) => this.error.set(error?.error?.error || 'Unable to download invoice')
    });
  }

  clientName(id: string): string {
    return this.clients().find((client) => client.id === id)?.name || 'Client';
  }

  activeMembershipForClient(): ApiRecord | undefined {
    const walletMembership = this.membershipEligibility()?.['wallet']?.['activeMembership'];
    if (walletMembership) return walletMembership;
    const eligibilityMembership = this.membershipEligibility()?.activeMembership;
    if (eligibilityMembership) return eligibilityMembership;
    const clientId = this.form.value.clientId;
    return this.activeMembershipForClientId(String(clientId || ''));
  }

  activeMembershipForClientId(clientId: string): ApiRecord | undefined {
    const today = new Date().toISOString().slice(0, 10);
    return this.memberships()
      .filter((membership) => membership.clientId === clientId && membership.status !== 'expired' && (!membership.validityDate || membership.validityDate >= today))
      .sort((a, b) => this.membershipDiscountPercent(b) - this.membershipDiscountPercent(a))[0];
  }

  activeMembershipDiscountPercent(): number {
    const walletBenefits = this.membershipEligibility()?.['wallet']?.['planBenefits'] as ApiRecord | undefined;
    if (walletBenefits) return Number(walletBenefits['serviceDiscountPercent'] || 0);
    return this.membershipDiscountPercent(this.activeMembershipForClient());
  }

  activeMembershipProductDiscountPercent(): number {
    const walletBenefits = this.membershipEligibility()?.['wallet']?.['planBenefits'] as ApiRecord | undefined;
    if (walletBenefits) return Number(walletBenefits['productDiscountPercent'] || 0);
    return this.membershipProductDiscountPercent(this.activeMembershipForClient());
  }

  private money(value: number | string): number {
    return Math.round((Number(value) || 0) * 100) / 100;
  }

  private normalizeSearch(value: unknown): string {
    return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ');
  }

  membershipDiscountPercent(membership?: ApiRecord): number {
    const credits = Array.isArray(membership?.serviceCredits) ? membership?.serviceCredits : [];
    const benefit = credits.find((item: ApiRecord) => item?.type === 'bill_discount');
    return Number(benefit?.percent || 0);
  }

  membershipProductDiscountPercent(membership?: ApiRecord): number {
    const credits = Array.isArray(membership?.serviceCredits) ? membership?.serviceCredits : [];
    const benefit = credits.find((item: ApiRecord) => item?.type === 'product_discount');
    return Number(benefit?.percent || 0);
  }

  private loadMembershipIntelligence(clientId: string): void {
    if (!clientId) {
      this.membershipEligibility.set(null);
      this.membershipSuggestion.set(null);
      return;
    }
    forkJoin({
      eligibility: this.api.list<ApiRecord>(`membership-enterprise/client/${clientId}/eligibility`).pipe(catchError(() => of(null))),
      suggestion: this.api.list<ApiRecord>(`membership-enterprise/client/${clientId}/suggestion`).pipe(catchError(() => of(null)))
    }).subscribe(({ eligibility, suggestion }) => {
      this.membershipEligibility.set(eligibility);
      this.membershipSuggestion.set(suggestion);
      this.applyMembershipDiscountsToEligibleItems();
    });
  }

  private applyMembershipDiscountsToEligibleItems(): void {
    const nextItems = this.items().map((item) => {
      if (!['service', 'product'].includes(item.type)) return item;
      if (item.discountSource === 'manual') return item;
      return {
        ...item,
        ...this.defaultItemDiscount(item.type)
      };
    });
    this.items.set(nextItems);
  }

  private normalizeMembershipPlan(plan: PosMembershipPlan): PosMembershipPlan {
    return {
      ...plan,
      price: Number(plan.price || 0),
      discountPercent: Number(plan.discountPercent || 0),
      productDiscountPercent: Number(plan.productDiscountPercent || 0),
      gstRate: Number(plan.gstRate || 18),
      validityDays: Number(plan.validityDays || 365),
      active: plan.active !== false && plan.status !== 'inactive',
      status: plan.status || (plan.active === false ? 'inactive' : 'active'),
      createdAt: plan.createdAt || new Date().toISOString()
    };
  }

  private membershipDaysLeft(membership: ApiRecord): number {
    if (!membership.validityDate) return 99999;
    const expiry = this.dateMs(membership.validityDate);
    const today = this.dateMs(new Date().toISOString().slice(0, 10));
    if (!expiry) return 99999;
    return Math.ceil((expiry - today) / 86400000);
  }

  private dateLabel(value: unknown): string {
    if (!value) return '-';
    const date = new Date(String(value));
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  private dateMs(value: unknown): number {
    const time = new Date(String(value || '')).getTime();
    return Number.isNaN(time) ? 0 : time;
  }

  private futureDate(days: number): string {
    const date = new Date();
    date.setDate(date.getDate() + Number(days || 0));
    return date.toISOString().slice(0, 10);
  }

  private safeList(resource: string, params: ApiRecord = {}) {
    return this.api.list<ApiRecord[]>(resource, params).pipe(
      catchError((error) => {
        this.loadFailures.add(resource);
        console.warn(`POS ${resource} list failed`, error);
        return of([]);
      })
    );
  }

  private staffQueryParams(branchId = this.posStaffBranchId()): ApiRecord {
    return {
      limit: 200,
      status: 'active',
      branchId
    };
  }

  private posStaffBranchId(): string {
    return String(this.form.value.branchId || this.appState.selectedBranchId() || '');
  }

  currentBranchName(): string {
    const branchId = this.posStaffBranchId();
    if (!branchId) return 'Header branch not selected';
    return this.branches().find((branch) => branch.id === branchId)?.name || branchId;
  }

  private loadStaffForBranch(branchId: string): void {
    this.safeList('staff-os/staff', this.staffQueryParams(branchId)).subscribe((staff) => {
      this.applyStaffRows(staff || [], this.branches());
      this.clearUnavailableStaffSelection();
    });
  }

  private applyStaffRows(staff: ApiRecord[], branches: ApiRecord[]): void {
    this.staff.set(this.activeStaff(this.normalizeStaffRows(staff || [], branches || [])));
  }

  private reloadStaffIfBranchScopeChanged(initialStaff: ApiRecord[]): void {
    const branchId = this.posStaffBranchId();
    if (!branchId || !initialStaff.length) return;
    const hasDifferentBranch = initialStaff.some((person) => String(person.branchId || person.branch_id || '') !== branchId);
    if (hasDifferentBranch) this.loadStaffForBranch(branchId);
  }

  private clearUnavailableStaffSelection(): void {
    const selectedStaffId = String(this.form.value.staffId || '');
    if (!selectedStaffId || this.staff().some((person) => String(person.id || '') === selectedStaffId)) return;
    this.clearStaffSelection();
    for (const item of this.items()) {
      if (item.staffId === selectedStaffId) {
        item.staffId = '';
        item.staffName = '';
      }
      if (item.staffSplits?.length) {
        item.staffSplits = item.staffSplits.filter((split) => split.staffId !== selectedStaffId);
      }
    }
    this.items.set([...this.items()]);
    if (this.tipDraft.staffId === selectedStaffId) this.tipDraft.staffId = '';
  }

  private applyDefaultBranch(branches: ApiRecord[]): void {
    if (!branches.length || this.form.value.branchId) return;
    const selectedBranchId = this.appState.selectedBranchId();
    const selected = branches.find((branch) => branch.id === selectedBranchId) || branches[0];
    if (selected?.id) {
      this.form.patchValue({ branchId: selected.id }, { emitEvent: false });
    }
  }

  private syncHeaderBranchToForm(branchId: string, emitEvent: boolean): void {
    if (!branchId || this.form.get('branchId')?.value === branchId) return;
    this.form.patchValue({ branchId }, { emitEvent });
  }

  private activeStaff(staff: ApiRecord[]): ApiRecord[] {
    const inactiveStatuses = new Set(['archived', 'blocked', 'deleted', 'inactive', 'not active', 'suspended', 'terminated']);
    return staff.filter((person) => {
      if (person.active === false || person.isActive === false || person.is_active === 0 || person.archived === true) {
        return false;
      }
      const status = this.normalizeSearch(person.status || person.state || person.employmentStatus || person.staffStatus || '');
      return !status || !inactiveStatuses.has(status);
    });
  }

  private normalizeStaffRows(staff: ApiRecord[], branches: ApiRecord[]): ApiRecord[] {
    const branchNameById = new Map(branches.map((branch) => [String(branch.id || ''), String(branch.name || branch.branchName || '')]));
    return staff.map((person) => {
      const branchId = String(person.branchId || person.branch_id || '');
      const fullName = String(person.fullName || person.full_name || person.name || '').trim();
      const mobile = String(person.mobile || person.phone || person.contact || '').trim();
      const designation = person.designation || person.role || person.staffCategoryName || person.department || 'Staff';
      const displayName = fullName || String(person.employeeCode || person.id || 'Staff');
      return {
        ...person,
        branchId,
        name: displayName,
        fullName: displayName,
        phone: mobile,
        mobile,
        role: designation,
        designation,
        branchName: person.branchName || person.branch_name || branchNameById.get(branchId) || branchId
      };
    });
  }

  private shouldSwitchToDemoTenant(data: { clients: ApiRecord[]; staff: ApiRecord[]; services: ApiRecord[]; products: ApiRecord[]; branches: ApiRecord[] }): boolean {
    if (this.fallbackTried || this.loadFailures.size) return false;
    if (this.appState.selectedTenantId() === 'tenant_aura') return false;
    return !data.clients.length && !data.staff.length && !data.services.length && !data.products.length && !data.branches.length;
  }

  private setDataHint(data: { clients: ApiRecord[]; staff: ApiRecord[]; services: ApiRecord[]; products: ApiRecord[]; branches: ApiRecord[] }): void {
    if (this.loadFailures.size) {
      this.dataHint.set(`Some POS lists could not load: ${[...this.loadFailures].join(', ')}. Baaki fields usable hain.`);
      return;
    }
    const empty = Object.entries(data)
      .filter(([, rows]) => !rows.length)
      .map(([name]) => name);
    if (empty.length) {
      this.dataHint.set(`No records found for: ${empty.join(', ')}. Selected tenant/branch me seed ya import data check karo.`);
      return;
    }
    if (this.fallbackNotice) {
      this.dataHint.set('Previous tenant me POS data empty tha, isliye Aura demo tenant ka catalog load ho gaya.');
      this.fallbackNotice = false;
      return;
    }
    this.dataHint.set('');
  }
}
