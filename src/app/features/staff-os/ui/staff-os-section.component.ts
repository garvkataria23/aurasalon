import { CommonModule } from '@angular/common';
import { Component, ElementRef, Input, OnDestroy, OnInit, ViewChild, computed, effect, signal } from '@angular/core';
import { ReactiveFormsModule, UntypedFormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { ApiRecord } from '../../../core/api.service';
import { AppStateService } from '../../../core/state/app-state.service';
import { StaffOsStore } from '../application/staff-os.store';
import { StaffOsBranch, StaffOsStaff, StaffOsStaffCategory } from '../domain/staff-os.models';

type StaffDetailTab = 'core' | 'contact' | 'emergency' | 'native' | 'incentive' | 'attendance' | 'remarks';
type StaffIntegrationLink = { label: string; to: string };
type IncentiveRuleType = 'service_category' | 'service' | 'product' | 'membership' | 'package';
type IncentiveCalcMode = 'percent' | 'fixed';
type IncentiveOption = { id: string; name: string; meta?: string };
type IncentiveRuleDraft = {
  id: string;
  type: IncentiveRuleType;
  targetId: string;
  targetName: string;
  calcMode: IncentiveCalcMode;
  value: number;
  minAmount: number;
  notes: string;
  active: boolean;
};
type IncentiveSlabDraft = {
  id: string;
  fromAmount: number;
  toAmount: number;
  incentivePercent: number;
  incentiveAmount: number;
};
type AttendancePunchType = 'clock_in' | 'clock_out';

@Component({
  selector: 'app-staff-os-section',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  template: `
    <section class="staff-os">
      <header class="topbar">
        <div>
          <p class="eyebrow">Staff Operating System</p>
          <h1>{{ title }}</h1>
        </div>
        <div class="topbar-actions">
          <button type="button" class="primary" *ngIf="section === 'staff-list'" (click)="openAddStaff()">Add Staff</button>
          <a class="refresh" routerLink="/staff-os/employee-masters">Employee Masters</a>
          <a class="refresh" *ngIf="section === 'staff-list'" routerLink="/staff-os/staff-categories">Staff Categories</a>
          <button type="button" class="refresh" (click)="store.load()">Refresh</button>
        </div>
      </header>

      <div class="metrics" aria-label="Staff OS metrics">
        <article *ngFor="let metric of store.metrics()" class="metric" [class]="metric.tone">
          <span>{{ metric.label }}</span>
          <strong>{{ metric.value }}</strong>
        </article>
      </div>

      <div *ngIf="store.loading()" class="state">Loading staff operations...</div>
      <div *ngIf="store.error()" class="state error">{{ store.error() }}</div>

      <section class="panel" *ngIf="section === 'staff-list' || section === 'staff-profile' || section === 'training-center'">
        <div class="panel-heading">
          <h2>Staff Directory</h2>
          <span>{{ store.staff().length }} records</span>
        </div>
        <div class="table">
          <div class="row header"><span>Name</span><span>Branch</span><span>Category</span><span>Live data</span><span>Status</span><span>Links</span><span>Action</span></div>
          <div class="row" *ngFor="let staff of store.staff()">
            <span>
              <strong>{{ staff.fullName }}</strong>
              <small *ngIf="staff.employeeDetails?.shortName || staff.employeeCode">
                {{ staff.employeeDetails?.shortName || 'No short name' }} · {{ staff.employeeCode || 'No code' }}
              </small>
            </span>
            <span>{{ staff.branchId }}</span>
            <span>{{ staff.staffCategoryName || staff.designation || staff.department || 'Staff' }}</span>
            <span class="live-badges">
              <span class="mini-badge" *ngFor="let badge of staffLiveBadges(staff)">{{ badge }}</span>
            </span>
            <span class="badge">{{ staff.status }}</span>
            <span class="row-links">
              <a routerLink="/staff-os/staff-profile" [queryParams]="{ staffId: staff.id }">Profile</a>
              <a routerLink="/staff/my-work" [queryParams]="{ staffId: staff.id }">My Work</a>
              <a routerLink="/staff-os/attendance-dashboard" [queryParams]="{ staffId: staff.id }">Attendance</a>
              <a routerLink="/staff-os/payroll-dashboard" [queryParams]="{ staffId: staff.id }">Payroll</a>
            </span>
            <span>
              <button
                type="button"
                class="row-action"
                [disabled]="statusChanging() === staff.id"
                (click)="toggleStaffStatus(staff)"
              >
                {{ statusChanging() === staff.id ? 'Saving...' : statusActionLabel(staff) }}
              </button>
            </span>
          </div>
          <div *ngIf="!store.staff().length && !store.loading()" class="empty">No staff records found.</div>
        </div>
        <div class="state error" *ngIf="staffActionError()">{{ staffActionError() }}</div>
      </section>

      <div class="drawer-shell" *ngIf="addStaffOpen()" role="dialog" aria-modal="true" aria-label="Add staff">
        <div class="drawer-scrim" (click)="closeAddStaff()"></div>
        <aside class="drawer">
          <header class="drawer-header">
            <div>
              <p class="eyebrow">Staff onboarding</p>
              <h2>Add Staff</h2>
              <span>Creates a real employee master record with branch scope, staff category and audit trail.</span>
            </div>
            <button type="button" class="icon-button" (click)="closeAddStaff()" aria-label="Close add staff">×</button>
          </header>

          <nav class="detail-tabs" aria-label="Employee master sections">
            <button
              type="button"
              *ngFor="let tab of detailTabs"
              [class.active]="detailTab() === tab.id"
              (click)="detailTab.set(tab.id)"
            >
              {{ tab.label }}
            </button>
          </nav>

          <section class="live-context" aria-label="Live staff interconnections">
            <article>
              <span>Branch</span>
              <strong>{{ selectedBranchName() }}</strong>
            </article>
            <article>
              <span>Category</span>
              <strong>{{ selectedCategory()?.name || 'Not selected' }}</strong>
            </article>
            <article>
              <span>Defaults</span>
              <strong>{{ selectedCategoryDefaultsText() }}</strong>
            </article>
            <div class="context-links">
              <a *ngFor="let link of activeIntegrationLinks()" [routerLink]="link.to">{{ link.label }}</a>
            </div>
          </section>

          <form class="staff-form" [formGroup]="staffForm" (ngSubmit)="saveStaff()">
            <ng-container *ngIf="detailTab() === 'core'">
              <label class="field full">
                <span>Branch</span>
                <select formControlName="branchId">
                  <option value="">Select branch</option>
                  <option *ngFor="let branch of branchOptions()" [value]="branch.id">{{ branch.name || branch.id }}</option>
                </select>
                <small *ngIf="fieldInvalid('branchId')">Branch is required.</small>
              </label>

              <label class="field">
                <span>First name</span>
                <input formControlName="firstName" autocomplete="given-name" />
                <small *ngIf="fieldInvalid('firstName')">First name is required.</small>
              </label>

              <label class="field">
                <span>Last name</span>
                <input formControlName="lastName" autocomplete="family-name" />
              </label>

              <label class="field">
                <span>Short name</span>
                <input formControlName="shortName" placeholder="AMITA" />
              </label>

              <label class="field">
                <span>Employee code</span>
                <input formControlName="employeeCode" placeholder="00103895" />
              </label>

              <label class="field">
                <span>Mobile</span>
                <input formControlName="mobile" autocomplete="tel" />
                <small *ngIf="fieldInvalid('mobile')">Enter a valid mobile number.</small>
              </label>

              <label class="field">
                <span>Email</span>
                <input formControlName="email" type="email" autocomplete="email" />
                <small *ngIf="fieldInvalid('email')">Enter a valid email.</small>
              </label>

              <section class="login-provision full">
                <div>
                  <span class="eyebrow">Staff app login</span>
                  <strong>Give this staff their own login ID and password.</strong>
                </div>
                <label class="check-field">
                  <input type="checkbox" formControlName="enableStaffLogin" />
                  <span>Create login for live appointments and own-work report</span>
                </label>
                <label class="field">
                  <span>Login ID</span>
                  <input formControlName="loginId" autocomplete="username" placeholder="aftab01 or mobile/email" />
                </label>
                <label class="field">
                  <span>Password</span>
                  <input formControlName="loginPassword" type="password" autocomplete="new-password" />
                  <small *ngIf="fieldInvalid('loginPassword')">Use at least 6 characters.</small>
                </label>
                <label class="field">
                  <span>Login role</span>
                  <select formControlName="loginRole">
                    <option value="staff">Staff</option>
                    <option value="frontDesk">Front desk</option>
                    <option value="cashier">Cashier</option>
                    <option value="manager">Manager</option>
                  </select>
                </label>
              </section>

              <label class="field">
                <span>Role</span>
                <select formControlName="roleId">
                  <option value="staff">Staff</option>
                  <option value="cashier">Cashier</option>
                  <option value="manager">Manager</option>
                  <option value="frontDesk">Front desk</option>
                  <option value="trainer">Trainer</option>
                </select>
              </label>

              <label class="field">
                <span>Staff Category</span>
                <select formControlName="staffCategoryId" (change)="applySelectedCategoryDefaults()">
                  <option value="">Select category</option>
                  <option *ngFor="let category of activeCategoriesForSelectedBranch()" [value]="category.id">
                    {{ category.name }} · {{ categoryScopeLabel(category.scope) }}
                  </option>
                </select>
                <small *ngIf="!activeCategoriesForSelectedBranch().length">
                  <a routerLink="/staff-os/staff-categories">Create Staff Category</a>
                </small>
              </label>

              <label class="field">
                <span>Employment type</span>
                <select formControlName="employmentType">
                  <option value="full_time">Full time</option>
                  <option value="part_time">Part time</option>
                  <option value="contract">Contract</option>
                  <option value="freelance">Freelance</option>
                  <option value="intern">Intern</option>
                </select>
              </label>

              <label class="field">
                <span>Department</span>
                <input formControlName="department" placeholder="Hair, Skin, Nail, Front desk" />
              </label>

              <label class="field">
                <span>Designation</span>
                <input formControlName="designation" placeholder="Senior stylist, Therapist" />
                <small *ngIf="fieldInvalid('designation')">Designation is required.</small>
              </label>

              <label class="field">
                <span>Joined on</span>
                <input formControlName="joiningDate" type="date" />
              </label>

              <label class="field">
                <span>Last working date</span>
                <input formControlName="lastWorkingDate" type="date" />
              </label>

              <label class="field">
                <span>Birth date</span>
                <input formControlName="birthDate" type="date" />
              </label>

              <label class="field">
                <span>Anniversary date</span>
                <input formControlName="anniversaryDate" type="date" />
              </label>

              <label class="field">
                <span>Gender</span>
                <select formControlName="gender">
                  <option value="">Not set</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </label>

              <label class="field">
                <span>Entry PIN</span>
                <input formControlName="entryPin" type="password" autocomplete="new-password" />
              </label>

              <label class="check-field">
                <input type="checkbox" formControlName="hideFromRoster" />
                <span>Hide / archive from roster</span>
              </label>

              <label class="check-field">
                <input type="checkbox" formControlName="allowSkipOtp" />
                <span>Allow to skip OTP</span>
              </label>

              <label class="field full">
                <span>Skill / license assignment placeholder</span>
                <textarea formControlName="skillLicenseNotes" rows="3" placeholder="Example: Hair color certified, bridal makeup training pending"></textarea>
              </label>
            </ng-container>

            <ng-container *ngIf="detailTab() === 'contact'">
              <label class="field">
                <span>Contact person</span>
                <input formControlName="contactPerson" />
              </label>
              <label class="field">
                <span>Mobile</span>
                <input formControlName="contactMobile" />
              </label>
              <label class="field full">
                <span>Address</span>
                <input formControlName="address" />
              </label>
              <label class="field full">
                <span>Address line 2</span>
                <input formControlName="addressLine2" />
              </label>
              <label class="field">
                <span>Landmark</span>
                <input formControlName="landmark" />
              </label>
              <label class="field">
                <span>Phone</span>
                <input formControlName="phone" />
              </label>
              <label class="field">
                <span>City</span>
                <input formControlName="city" />
              </label>
              <label class="field">
                <span>Pin</span>
                <input formControlName="pincode" />
              </label>
              <label class="field">
                <span>State</span>
                <input formControlName="state" />
              </label>
              <label class="field">
                <span>Country</span>
                <input formControlName="country" />
              </label>
              <label class="field">
                <span>Area</span>
                <input formControlName="area" />
              </label>
              <label class="field">
                <span>Fax</span>
                <input formControlName="fax" />
              </label>
              <label class="field">
                <span>Contact email</span>
                <input formControlName="contactEmail" type="email" />
              </label>
              <label class="field">
                <span>Web</span>
                <input formControlName="web" />
              </label>
            </ng-container>

            <ng-container *ngIf="detailTab() === 'emergency'">
              <label class="field">
                <span>Emergency contact person</span>
                <input formControlName="emergencyContactName" />
              </label>
              <label class="field">
                <span>Emergency mobile</span>
                <input formControlName="emergencyContactMobile" />
              </label>
              <label class="field">
                <span>Emergency phone</span>
                <input formControlName="emergencyContactPhone" />
              </label>
              <label class="field">
                <span>Relation</span>
                <input formControlName="emergencyRelation" />
              </label>
              <label class="field full">
                <span>Emergency address</span>
                <textarea formControlName="emergencyAddress" rows="3"></textarea>
              </label>
              <label class="field">
                <span>City</span>
                <input formControlName="emergencyCity" />
              </label>
              <label class="field">
                <span>State</span>
                <input formControlName="emergencyState" />
              </label>
              <label class="field">
                <span>Country</span>
                <input formControlName="emergencyCountry" />
              </label>
            </ng-container>

            <ng-container *ngIf="detailTab() === 'native'">
              <label class="field">
                <span>Native contact person</span>
                <input formControlName="nativeContactName" />
              </label>
              <label class="field">
                <span>Native mobile</span>
                <input formControlName="nativeContactMobile" />
              </label>
              <label class="field">
                <span>Native phone</span>
                <input formControlName="nativeContactPhone" />
              </label>
              <label class="field full">
                <span>Native address</span>
                <textarea formControlName="nativeAddress" rows="3"></textarea>
              </label>
              <label class="field">
                <span>City</span>
                <input formControlName="nativeCity" />
              </label>
              <label class="field">
                <span>State</span>
                <input formControlName="nativeState" />
              </label>
              <label class="field">
                <span>Country</span>
                <input formControlName="nativeCountry" />
              </label>
            </ng-container>

            <ng-container *ngIf="detailTab() === 'incentive'">
              <section class="incentive-command full">
                <div>
                  <span class="eyebrow">Incentive engine</span>
                  <strong>Compact staff payout profile</strong>
                  <small>{{ incentiveSummaryText() }}</small>
                </div>
                <button type="button" class="primary" (click)="advancedIncentiveOpen.set(true)">Advanced Incentive Rules</button>
              </section>

              <section class="incentive-summary full" aria-label="Incentive rule summary">
                <article>
                  <span>Fixed</span>
                  <strong>{{ staffForm.get('fixedIncentivePercent')?.value || 0 }}% / {{ (staffForm.get('fixedIncentiveAmount')?.value || 0) | currency:'INR':'symbol-narrow':'1.0-0' }}</strong>
                </article>
                <article>
                  <span>Rule builder</span>
                  <strong>{{ incentiveRules().length }} rules</strong>
                </article>
                <article>
                  <span>Target slabs</span>
                  <strong>{{ incentiveSlabs().length }} slabs</strong>
                </article>
                <article>
                  <span>Payroll</span>
                  <strong>{{ staffForm.get('incentivePayrollSync')?.value ? 'Auto add' : 'Manual review' }}</strong>
                </article>
              </section>

              <label class="field">
                <span>Fixed incentive %</span>
                <input formControlName="fixedIncentivePercent" type="number" min="0" step="0.01" />
              </label>
              <label class="field">
                <span>Fixed incentive amount</span>
                <input formControlName="fixedIncentiveAmount" type="number" min="0" step="1" />
              </label>
              <label class="field full">
                <span>Service category incentive rules</span>
                <textarea formControlName="serviceIncentiveRules" rows="4" placeholder="Example: Hair color 8%, Bridal makeup 10%"></textarea>
              </label>
              <label class="field full">
                <span>Incentive notes</span>
                <textarea formControlName="incentiveNotes" rows="3"></textarea>
              </label>

              <div class="subdrawer-shell" *ngIf="advancedIncentiveOpen()" role="dialog" aria-modal="true" aria-label="Advanced incentive rules">
                <div class="subdrawer-scrim" (click)="advancedIncentiveOpen.set(false)"></div>
                <aside class="subdrawer">
                  <header class="drawer-header">
                    <div>
                      <p class="eyebrow">Advanced incentive rules</p>
                      <h2>Commission, target slabs and payroll handoff</h2>
                      <span>Rules save into this staff employee master profile for payroll and commission preview.</span>
                    </div>
                    <button type="button" class="icon-button" (click)="advancedIncentiveOpen.set(false)" aria-label="Close advanced incentive rules">×</button>
                  </header>

                  <section class="advanced-grid">
                    <label class="field">
                      <span>Payout cycle</span>
                      <select formControlName="incentiveCycle">
                        <option value="monthly">Monthly</option>
                        <option value="weekly">Weekly</option>
                        <option value="daily">Daily</option>
                        <option value="custom">Custom</option>
                      </select>
                    </label>
                    <label class="field">
                      <span>Valid from</span>
                      <input formControlName="incentiveStartDate" type="date" />
                    </label>
                    <label class="field">
                      <span>Valid to</span>
                      <input formControlName="incentiveEndDate" type="date" />
                    </label>
                    <label class="field">
                      <span>Monthly cap amount</span>
                      <input formControlName="incentiveCapAmount" type="number" min="0" step="1" />
                    </label>
                    <label class="check-field">
                      <input type="checkbox" formControlName="incentivePayrollSync" />
                      <span>Auto-add approved incentive into payroll</span>
                    </label>
                    <label class="check-field">
                      <input type="checkbox" formControlName="incentiveRequiresApproval" />
                      <span>Owner/manager approval required before payout</span>
                    </label>
                    <label class="field">
                      <span>Approval role</span>
                      <select formControlName="incentiveApprovalRole">
                        <option value="manager">Manager</option>
                        <option value="owner">Owner</option>
                        <option value="admin">Admin</option>
                      </select>
                    </label>
                  </section>

                  <section class="rule-card">
                    <div class="rule-heading">
                      <div>
                        <h2>Service, product and membership rules</h2>
                        <span>Use real service/product/membership/package targets from the database.</span>
                      </div>
                      <div class="rule-actions">
                        <button type="button" class="refresh" (click)="addIncentiveRule('service_category')">+ Service category</button>
                        <button type="button" class="refresh" (click)="addIncentiveRule('product')">+ Product</button>
                        <button type="button" class="refresh" (click)="addIncentiveRule('membership')">+ Membership</button>
                      </div>
                    </div>
                    <div class="rule-table">
                      <div class="rule-row header">
                        <span>Type</span><span>Target</span><span>Mode</span><span>Value</span><span>Min bill</span><span>Action</span>
                      </div>
                      <div class="rule-row" *ngFor="let rule of incentiveRules(); trackBy: trackById">
                        <select [value]="rule.type" (change)="setIncentiveRuleType(rule.id, $any($event.target).value)">
                          <option value="service_category">Service category</option>
                          <option value="service">Service</option>
                          <option value="product">Product</option>
                          <option value="membership">Membership</option>
                          <option value="package">Package</option>
                        </select>
                        <select *ngIf="targetOptionsFor(rule.type).length; else manualTarget" [value]="rule.targetId" (change)="setIncentiveRuleTarget(rule.id, rule.type, $any($event.target).value)">
                          <option value="">Select target</option>
                          <option *ngFor="let option of targetOptionsFor(rule.type)" [value]="option.id">{{ option.name }}{{ option.meta ? ' · ' + option.meta : '' }}</option>
                        </select>
                        <ng-template #manualTarget>
                          <input [value]="rule.targetName" (input)="updateIncentiveRule(rule.id, 'targetName', $any($event.target).value)" placeholder="Enter target name" />
                        </ng-template>
                        <select [value]="rule.calcMode" (change)="updateIncentiveRule(rule.id, 'calcMode', $any($event.target).value)">
                          <option value="percent">Percent</option>
                          <option value="fixed">Fixed amount</option>
                        </select>
                        <input [value]="rule.value" type="number" min="0" step="0.01" (input)="updateIncentiveRule(rule.id, 'value', $any($event.target).value)" />
                        <input [value]="rule.minAmount" type="number" min="0" step="1" (input)="updateIncentiveRule(rule.id, 'minAmount', $any($event.target).value)" />
                        <button type="button" class="row-action danger" (click)="removeIncentiveRule(rule.id)" [disabled]="incentiveRules().length === 1">Remove</button>
                      </div>
                    </div>
                  </section>

                  <section class="rule-card">
                    <div class="rule-heading">
                      <div>
                        <h2>Target slab incentive</h2>
                        <span>Flexi-style revenue slabs for monthly/weekly target calculation.</span>
                      </div>
                      <button type="button" class="refresh" (click)="addIncentiveSlab()">+ Add slab</button>
                    </div>
                    <div class="slab-table">
                      <div class="slab-row header"><span>From amount</span><span>To amount</span><span>Ince. %</span><span>Or amount</span><span></span></div>
                      <div class="slab-row" *ngFor="let slab of incentiveSlabs(); trackBy: trackById">
                        <input [value]="slab.fromAmount" type="number" min="0" step="1" (input)="updateIncentiveSlab(slab.id, 'fromAmount', $any($event.target).value)" />
                        <input [value]="slab.toAmount" type="number" min="0" step="1" (input)="updateIncentiveSlab(slab.id, 'toAmount', $any($event.target).value)" />
                        <input [value]="slab.incentivePercent" type="number" min="0" step="0.01" (input)="updateIncentiveSlab(slab.id, 'incentivePercent', $any($event.target).value)" />
                        <input [value]="slab.incentiveAmount" type="number" min="0" step="1" (input)="updateIncentiveSlab(slab.id, 'incentiveAmount', $any($event.target).value)" />
                        <button type="button" class="row-action danger" (click)="removeIncentiveSlab(slab.id)" [disabled]="incentiveSlabs().length === 1">Remove</button>
                      </div>
                    </div>
                  </section>

                  <section class="rule-card">
                    <div class="rule-heading">
                      <div>
                        <h2>Attendance guard and payout approval</h2>
                        <span>Control late/absent impact before incentive reaches payroll.</span>
                      </div>
                    </div>
                    <div class="advanced-grid">
                      <label class="field">
                        <span>Hold after absent days</span>
                        <input formControlName="incentiveHoldOnAbsentDays" type="number" min="0" step="1" />
                      </label>
                      <label class="field">
                        <span>Reduce after late count</span>
                        <input formControlName="incentiveReduceOnLateCount" type="number" min="0" step="1" />
                      </label>
                      <label class="field">
                        <span>Reduction %</span>
                        <input formControlName="incentiveReducePercent" type="number" min="0" step="0.01" />
                      </label>
                      <label class="field">
                        <span>Payout status</span>
                        <select formControlName="incentivePayoutStatus">
                          <option value="draft">Draft until payroll run</option>
                          <option value="ready">Ready for approval</option>
                          <option value="approved">Pre-approved</option>
                        </select>
                      </label>
                    </div>
                  </section>

                  <footer class="drawer-actions">
                    <button type="button" class="refresh" (click)="advancedIncentiveOpen.set(false)">Done</button>
                  </footer>
                </aside>
              </div>
            </ng-container>

            <ng-container *ngIf="detailTab() === 'attendance'">
              <label class="field">
                <span>Weekly off</span>
                <select formControlName="weeklyOff">
                  <option value="">Select weekly off</option>
                  <option value="monday">Monday</option>
                  <option value="tuesday">Tuesday</option>
                  <option value="wednesday">Wednesday</option>
                  <option value="thursday">Thursday</option>
                  <option value="friday">Friday</option>
                  <option value="saturday">Saturday</option>
                  <option value="sunday">Sunday</option>
                </select>
              </label>
              <label class="field">
                <span>Employee code in device</span>
                <input formControlName="empCodeInDevice" />
              </label>
              <label class="field">
                <span>RFID card no.</span>
                <input formControlName="rfidCardNo" />
              </label>
              <label class="field">
                <span>Attendance category</span>
                <input formControlName="attendanceCategory" placeholder="11 TO 08" />
              </label>
              <label class="field">
                <span>Default shift</span>
                <input formControlName="defaultShift" />
              </label>
              <label class="field">
                <span>Device privilege</span>
                <select formControlName="devicePrivilege">
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                </select>
              </label>
              <label class="field">
                <span>Basic salary</span>
                <input formControlName="basicSalary" type="number" min="0" step="1" />
              </label>
              <label class="field">
                <span>Payment mode</span>
                <select formControlName="paymentMode">
                  <option value="">Not set</option>
                  <option value="cash">Cash</option>
                  <option value="cheque">Cheque</option>
                  <option value="bank_transfer">Bank transfer</option>
                </select>
              </label>
              <label class="field">
                <span>Bank name</span>
                <input formControlName="bankName" />
              </label>
              <label class="field">
                <span>Account number</span>
                <input formControlName="accountNumber" />
              </label>
              <label class="field">
                <span>Loan installment</span>
                <input formControlName="loanInstallment" type="number" min="0" step="1" />
              </label>
              <label class="field">
                <span>Loan balance</span>
                <input formControlName="loanBalance" type="number" min="0" step="1" />
              </label>
              <label class="field">
                <span>OT extra rate</span>
                <input formControlName="otExtraRate" type="number" min="0" step="1" />
              </label>
              <label class="field">
                <span>Less work penalty</span>
                <input formControlName="lessWorkPenalty" type="number" min="0" step="1" />
              </label>
              <label class="check-field">
                <input type="checkbox" formControlName="supportAttendancePayroll" />
                <span>Support in attendance / payroll</span>
              </label>
              <label class="check-field">
                <input type="checkbox" formControlName="weeklyOffOvertime" />
                <span>Weekly off present as overtime</span>
              </label>
              <label class="check-field">
                <input type="checkbox" formControlName="pfApplicable" />
                <span>PF applicable</span>
              </label>
              <label class="field">
                <span>PF no.</span>
                <input formControlName="pfNo" />
              </label>
              <label class="check-field">
                <input type="checkbox" formControlName="ptApplicable" />
                <span>PT applicable</span>
              </label>
              <label class="field">
                <span>PT no.</span>
                <input formControlName="ptNo" />
              </label>
              <label class="check-field">
                <input type="checkbox" formControlName="esicApplicable" />
                <span>ESIC applicable</span>
              </label>
              <label class="field">
                <span>ESIC no.</span>
                <input formControlName="esicNo" />
              </label>
              <label class="check-field">
                <input type="checkbox" formControlName="tdsApplicable" />
                <span>TDS applicable</span>
              </label>
              <label class="field">
                <span>PAN no.</span>
                <input formControlName="panNo" />
              </label>
              <label class="field">
                <span>Aadhaar no.</span>
                <input formControlName="aadhaarNo" />
              </label>
            </ng-container>

            <ng-container *ngIf="detailTab() === 'remarks'">
              <label class="field full">
                <span>Remarks</span>
                <textarea formControlName="remarks" rows="8"></textarea>
              </label>
              <label class="field">
                <span>IMEI no.</span>
                <input formControlName="imeiNo" />
              </label>
            </ng-container>

            <div class="state error" *ngIf="addStaffError()">{{ addStaffError() }}</div>

            <footer class="drawer-actions">
              <button type="button" class="refresh" (click)="closeAddStaff()">Cancel</button>
              <button type="submit" class="primary" [disabled]="staffForm.invalid || addStaffSaving()">
                {{ addStaffSaving() ? 'Saving...' : 'Save Staff' }}
              </button>
            </footer>
          </form>
        </aside>
      </div>

      <section class="panel attendance-command" *ngIf="section === 'attendance-dashboard'">
        <div class="panel-heading">
          <div>
            <h2>Advanced Attendance Control</h2>
            <span>Biometric devices, camera punch and payroll-ready attendance</span>
          </div>
          <div class="attendance-controls">
            <input type="date" [value]="attendanceDate()" (change)="setAttendanceDate($any($event.target).value)" />
            <button type="button" class="refresh" (click)="refreshAttendanceCenter()">Refresh</button>
            <button type="button" class="primary" [disabled]="queueProcessing()" (click)="processBiometricQueue()">
              {{ queueProcessing() ? 'Processing...' : 'Process biometric queue' }}
            </button>
          </div>
        </div>
        <div class="attendance-stats">
          <article><span>Devices</span><strong>{{ attendanceSummary()['activeDevices'] || 0 }}/{{ attendanceSummary()['devices'] || 0 }}</strong><small>active / total</small></article>
          <article><span>Gateway</span><strong>{{ attendanceSummary()['onlineGateways'] || 0 }}/{{ attendanceSummary()['gateways'] || 0 }}</strong><small>Windows sync agents</small></article>
          <article><span>Attendance</span><strong>{{ attendanceSummary()['attendanceEvents'] || 0 }}</strong><small>{{ attendanceDate() }}</small></article>
          <article><span>Camera</span><strong>{{ attendanceSummary()['cameraCaptures'] || 0 }}</strong><small>verified captures</small></article>
          <article><span>Consent</span><strong>{{ attendanceSummary()['consentGranted'] || 0 }}</strong><small>{{ attendanceSummary()['consentPending'] || 0 }} pending</small></article>
          <article><span>Queue</span><strong>{{ attendanceSummary()['queuedEvents'] || 0 }}</strong><small>{{ attendanceSummary()['failedEvents'] || 0 }} failed</small></article>
          <article><span>Suspicious</span><strong>{{ attendanceSummary()['suspiciousEvents'] || 0 }}</strong><small>review required</small></article>
          <article><span>Payroll</span><strong>{{ attendanceSummary()['payrollPreviewRows'] || 0 }}</strong><small>{{ attendanceSummary()['ownerAlerts'] || 0 }} owner alerts</small></article>
        </div>
        <div class="state error" *ngIf="attendanceError()">{{ attendanceError() }}</div>
        <div class="state success" *ngIf="attendanceMessage()">{{ attendanceMessage() }}</div>
      </section>

      <section class="attendance-workspace" *ngIf="section === 'attendance-dashboard'">
        <article class="panel camera-panel">
          <div class="panel-heading">
            <h2>Camera Punch</h2>
            <span>{{ cameraActive() ? 'Camera active' : 'Camera off' }}</span>
          </div>
          <div class="camera-stage">
            <video #attendanceVideo autoplay muted playsinline [class.hidden]="!cameraActive()"></video>
            <div class="camera-placeholder" *ngIf="!cameraActive()">Camera preview</div>
          </div>
          <form class="staff-form camera-form" [formGroup]="cameraForm" (ngSubmit)="submitCameraPunch()">
            <label class="field">
              <span>Branch</span>
              <select formControlName="branchId" (change)="refreshAttendanceCenter()">
                <option value="">Select branch</option>
                <option *ngFor="let branch of branchOptions()" [value]="branch.id">{{ branch.name || branch.id }}</option>
              </select>
            </label>
            <label class="field">
              <span>Staff</span>
              <select formControlName="staffId">
                <option value="">Select staff</option>
                <option *ngFor="let staff of activeStaffForAttendance()" [value]="staff.id">{{ staff.fullName }} {{ staff.employeeCode ? '(' + staff.employeeCode + ')' : '' }}</option>
              </select>
            </label>
            <label class="field">
              <span>Punch</span>
              <select formControlName="punchType">
                <option value="clock_in">Clock in</option>
                <option value="clock_out">Clock out</option>
              </select>
            </label>
            <label class="field">
              <span>Liveness</span>
              <input type="number" min="0" max="1" step="0.01" formControlName="livenessScore" />
            </label>
            <label class="field">
              <span>Face match</span>
              <input type="number" min="0" max="1" step="0.01" formControlName="matchScore" />
            </label>
            <label class="field full">
              <span>Notes</span>
              <input formControlName="notes" placeholder="Gate, reception, mobile punch" />
            </label>
            <div class="drawer-actions">
              <button type="button" class="refresh" [disabled]="cameraStarting()" (click)="startCamera()">{{ cameraStarting() ? 'Opening...' : 'Start camera' }}</button>
              <button type="button" class="refresh" (click)="stopCamera()">Stop</button>
              <button type="submit" class="primary" [disabled]="cameraForm.invalid || cameraSaving() || !cameraActive()">
                {{ cameraSaving() ? 'Saving...' : 'Save camera punch' }}
              </button>
            </div>
          </form>
        </article>

        <article class="panel">
          <div class="panel-heading">
            <h2>Biometric Device Hub</h2>
            <span>{{ store.biometricDevices().length }} devices</span>
          </div>
          <form class="device-form" [formGroup]="deviceForm" (ngSubmit)="registerBiometricDevice()">
            <label class="field">
              <span>Branch</span>
              <select formControlName="branchId">
                <option value="">Select branch</option>
                <option *ngFor="let branch of branchOptions()" [value]="branch.id">{{ branch.name || branch.id }}</option>
              </select>
            </label>
            <label class="field">
              <span>Provider</span>
              <select formControlName="provider">
                <option value="zkteco">ZKTeco</option>
                <option value="essl">eSSL</option>
                <option value="mantra">Mantra</option>
                <option value="suprema">Suprema</option>
                <option value="realtime_biometrics">Realtime Biometrics</option>
                <option value="camera">Camera</option>
                <option value="manual">Manual</option>
              </select>
            </label>
            <label class="field"><span>Device code</span><input formControlName="deviceCode" /></label>
            <label class="field"><span>Name</span><input formControlName="deviceName" /></label>
            <label class="field"><span>Location</span><input formControlName="locationLabel" /></label>
            <label class="field">
              <span>Mode</span>
              <select formControlName="connectionMode">
                <option value="offline_sync">Offline sync</option>
                <option value="api">API</option>
                <option value="webhook">Webhook</option>
                <option value="browser_camera">Browser camera</option>
              </select>
            </label>
            <button type="submit" class="primary" [disabled]="deviceForm.invalid || deviceSaving()">{{ deviceSaving() ? 'Saving...' : 'Add device' }}</button>
          </form>
          <div class="table compact device-table">
            <div class="row header"><span>Device</span><span>Provider</span><span>Mode</span><span>Status</span></div>
            <div class="row" *ngFor="let device of store.biometricDevices()">
              <span><strong>{{ device['deviceName'] || device['deviceCode'] }}</strong><small>{{ device['locationLabel'] || device['deviceCode'] }}</small></span>
              <span>{{ device['provider'] }}</span>
              <span>{{ device['connectionMode'] }}</span>
              <span class="badge">{{ device['lastHealthStatus'] || device['status'] }}</span>
            </div>
            <div *ngIf="!store.biometricDevices().length && !store.loading()" class="empty">No biometric devices registered.</div>
          </div>
        </article>
      </section>

      <section class="attendance-workspace attendance-wide" *ngIf="section === 'attendance-dashboard'">
        <article class="panel">
          <div class="panel-heading">
            <div>
              <h2>Real Biometric Gateway</h2>
              <span>ZKTeco, eSSL, Mantra, Suprema, RFID, QR, NFC and beacon punch sync</span>
            </div>
            <span class="badge">{{ gatewayRows().length }} agents</span>
          </div>
          <form class="device-form gateway-form" [formGroup]="gatewayForm" (ngSubmit)="registerGateway()">
            <label class="field">
              <span>Branch</span>
              <select formControlName="branchId">
                <option value="">Select branch</option>
                <option *ngFor="let branch of branchOptions()" [value]="branch.id">{{ branch.name || branch.id }}</option>
              </select>
            </label>
            <label class="field"><span>Gateway code</span><input formControlName="gatewayCode" placeholder="FRONT-DESK-PC-01" /></label>
            <label class="field"><span>Name</span><input formControlName="displayName" placeholder="Front desk gateway" /></label>
            <label class="field"><span>Machine</span><input formControlName="machineName" /></label>
            <label class="field"><span>Version</span><input formControlName="versionLabel" placeholder="1.0.0" /></label>
            <label class="field"><span>Providers</span><input formControlName="providers" /></label>
            <button type="submit" class="primary" [disabled]="gatewayForm.invalid || gatewaySaving()">{{ gatewaySaving() ? 'Saving...' : 'Register gateway' }}</button>
          </form>
          <div class="table compact device-table">
            <div class="row header"><span>Gateway</span><span>Machine</span><span>Status</span><span>Last seen</span></div>
            <div class="row" *ngFor="let gateway of gatewayRows()">
              <span><strong>{{ gateway['displayName'] || gateway['gatewayCode'] }}</strong><small>{{ gateway['gatewayCode'] }}</small></span>
              <span>{{ gateway['machineName'] || 'Windows gateway' }}</span>
              <span class="badge">{{ gateway['healthStatus'] }}</span>
              <span>{{ timeOnly(gateway['lastSeenAt']) || 'not seen' }}</span>
            </div>
            <div *ngIf="!gatewayRows().length && !store.loading()" class="empty">No gateway registered for selected branch.</div>
          </div>
        </article>

        <article class="panel">
          <div class="panel-heading">
            <div>
              <h2>Staff Mapping UI</h2>
              <span>Map biometric external user IDs to real staff records</span>
            </div>
            <span class="badge">{{ store.biometricMappings().length }} mappings</span>
          </div>
          <form class="device-form mapping-form" [formGroup]="mappingForm" (ngSubmit)="createBiometricMapping()">
            <label class="field">
              <span>Device</span>
              <select formControlName="deviceId">
                <option value="">Select device</option>
                <option *ngFor="let device of store.biometricDevices()" [value]="device['id']">{{ device['deviceName'] || device['deviceCode'] }}</option>
              </select>
            </label>
            <label class="field">
              <span>Staff</span>
              <select formControlName="staffId">
                <option value="">Select staff</option>
                <option *ngFor="let staff of activeStaffForAttendance()" [value]="staff.id">{{ staff.fullName }}</option>
              </select>
            </label>
            <label class="field"><span>External user ID</span><input formControlName="externalUserId" placeholder="Device user id" /></label>
            <label class="field"><span>Notes</span><input formControlName="notes" /></label>
            <button type="submit" class="primary" [disabled]="mappingForm.invalid || mappingSaving()">{{ mappingSaving() ? 'Saving...' : 'Map staff' }}</button>
          </form>
          <div class="table compact mapping-table">
            <div class="row header"><span>Staff</span><span>Device</span><span>External ID</span><span>Status</span><span>Action</span></div>
            <div class="row" *ngFor="let mapping of store.biometricMappings()">
              <span>{{ mapping['staffName'] || mapping['staffId'] }}</span>
              <span>{{ mapping['deviceLabel'] || mapping['deviceId'] }}</span>
              <span>{{ mapping['externalUserId'] }}</span>
              <span class="badge">{{ mapping['status'] }}</span>
              <span>
                <button type="button" class="refresh mini" *ngIf="mapping['status'] !== 'approved'" (click)="approveBiometricMapping(mapping)">Approve</button>
              </span>
            </div>
            <div *ngIf="!store.biometricMappings().length && !store.loading()" class="empty">No staff biometric mappings yet.</div>
          </div>
        </article>
      </section>

      <section class="attendance-workspace attendance-wide" *ngIf="section === 'attendance-dashboard'">
        <article class="panel">
          <div class="panel-heading">
            <div>
              <h2>Privacy And Consent Center</h2>
              <span>DPDP-ready biometric consent, retention and delete request controls</span>
            </div>
            <span class="badge">{{ store.biometricConsents().length }} records</span>
          </div>
          <form class="device-form consent-form" [formGroup]="consentForm" (ngSubmit)="saveBiometricConsent()">
            <label class="field">
              <span>Staff</span>
              <select formControlName="staffId">
                <option value="">Select staff</option>
                <option *ngFor="let staff of activeStaffForAttendance()" [value]="staff.id">{{ staff.fullName }}</option>
              </select>
            </label>
            <label class="field">
              <span>Status</span>
              <select formControlName="consentStatus">
                <option value="granted">Granted</option>
                <option value="pending">Pending</option>
                <option value="revoked">Revoked</option>
              </select>
            </label>
            <label class="field">
              <span>Channel</span>
              <select formControlName="consentChannel">
                <option value="paper">Paper</option>
                <option value="digital">Digital</option>
                <option value="manager_verified">Manager verified</option>
              </select>
            </label>
            <label class="field"><span>Retention days</span><input type="number" min="30" formControlName="retentionDays" /></label>
            <label class="field full"><span>Consent text</span><input formControlName="consentText" /></label>
            <button type="submit" class="primary" [disabled]="consentForm.invalid || consentSaving()">{{ consentSaving() ? 'Saving...' : 'Save consent' }}</button>
          </form>
          <div class="table compact mapping-table">
            <div class="row header"><span>Staff</span><span>Status</span><span>Retention</span><span>Delete</span><span>Action</span></div>
            <div class="row" *ngFor="let consent of store.biometricConsents()">
              <span>{{ consent['staffName'] || consent['staffId'] }}</span>
              <span class="badge">{{ consent['consentStatus'] }}</span>
              <span>{{ consent['retentionDays'] }} days</span>
              <span>{{ consent['deleteRequested'] ? 'requested' : 'no' }}</span>
              <span><button type="button" class="refresh mini" (click)="requestConsentDeletion(consent)">Delete request</button></span>
            </div>
            <div *ngIf="!store.biometricConsents().length && !store.loading()" class="empty">No biometric consent captured yet.</div>
          </div>
        </article>

        <article class="panel">
          <div class="panel-heading">
            <div>
              <h2>Fraud AI And Payroll Autopilot</h2>
              <span>Risk scan, owner alerts and attendance deduction preview from real punches</span>
            </div>
            <button type="button" class="refresh" [disabled]="fraudScanning()" (click)="runFraudScan()">{{ fraudScanning() ? 'Scanning...' : 'Run fraud scan' }}</button>
          </div>
          <form class="device-form payroll-form" [formGroup]="payrollPreviewForm" (ngSubmit)="generatePayrollPreview()">
            <label class="field"><span>From</span><input type="date" formControlName="periodStart" /></label>
            <label class="field"><span>To</span><input type="date" formControlName="periodEnd" /></label>
            <label class="field"><span>Shift start</span><input type="time" formControlName="defaultShiftStart" /></label>
            <label class="field"><span>Late grace</span><input type="number" min="0" formControlName="lateGraceMinutes" /></label>
            <label class="field"><span>Hold absent days</span><input type="number" min="0" formControlName="incentiveHoldAbsentDays" /></label>
            <label class="field"><span>Default gross</span><input type="number" min="0" formControlName="defaultGrossAmount" /></label>
            <button type="submit" class="primary" [disabled]="payrollPreviewForm.invalid || payrollPreviewSaving()">{{ payrollPreviewSaving() ? 'Generating...' : 'Payroll preview' }}</button>
          </form>
          <div class="table compact risk-table">
            <div class="row header"><span>Risk / Payroll</span><span>Score</span><span>Amount</span><span>Status</span></div>
            <div class="row" *ngFor="let risk of store.attendanceRisks()">
              <span><strong>{{ risk['riskType'] }}</strong><small>{{ risk['reason'] }}</small></span>
              <span>{{ risk['riskScore'] }}</span>
              <span>{{ risk['severity'] }}</span>
              <span class="badge">{{ risk['status'] }}</span>
            </div>
            <div class="row" *ngFor="let row of store.attendancePayrollPreview()">
              <span><strong>{{ displayStaffName(row) }}</strong><small>{{ row['presentDays'] || 0 }} present · {{ row['lateCount'] || 0 }} late</small></span>
              <span>{{ row['absentDays'] || 0 }} absent</span>
              <span>₹{{ row['netPreview'] || 0 }}</span>
              <span class="badge">{{ row['incentiveHold'] ? 'hold' : 'draft' }}</span>
            </div>
            <div *ngIf="!store.attendanceRisks().length && !store.attendancePayrollPreview().length && !store.loading()" class="empty">Run fraud scan or payroll preview to see live outputs.</div>
          </div>
        </article>
      </section>

      <section class="panel" *ngIf="section === 'attendance-dashboard'">
        <div class="panel-heading">
          <h2>Live Attendance Evidence</h2>
          <span>{{ attendanceRows().length }} attendance rows</span>
        </div>
        <div class="table compact evidence-table">
          <div class="row header"><span>Staff</span><span>Source</span><span>Clock</span><span>Status</span></div>
          <div class="row" *ngFor="let row of attendanceRows()">
            <span><strong>{{ displayStaffName(row) }}</strong><small>{{ row['businessDate'] || row['business_date'] }}</small></span>
            <span>{{ row['source'] || 'manual' }}</span>
            <span>{{ timeOnly(row['clockInAt'] || row['clock_in_at']) }} - {{ timeOnly(row['clockOutAt'] || row['clock_out_at']) || 'open' }}</span>
            <span class="badge">{{ row['status'] }}</span>
          </div>
          <div *ngIf="!attendanceRows().length && !store.loading()" class="empty">No attendance events for selected date.</div>
        </div>
      </section>

      <section class="panel" *ngIf="section === 'roster-calendar' || section === 'leave-management'">
        <div class="panel-heading">
          <h2>Roster And Attendance</h2>
          <span>{{ store.schedules().length }} shifts</span>
        </div>
        <div class="heatmap" aria-label="Roster heatmap">
          <span *ngFor="let cell of heatmapCells; let index = index" [style.opacity]="opacity(index)"></span>
        </div>
        <div class="table compact">
          <div class="row header"><span>Date</span><span>Staff</span><span>Timing</span><span>Status</span></div>
          <div class="row" *ngFor="let shift of store.schedules()">
            <span>{{ shift.scheduleDate }}</span>
            <span>{{ shift.staffId }}</span>
            <span>{{ shift.startTime }} - {{ shift.endTime }}</span>
            <span class="badge">{{ shift.status }}</span>
          </div>
          <div *ngIf="!store.schedules().length && !store.loading()" class="empty">No roster data for the selected branch.</div>
        </div>
      </section>

      <section class="panel" *ngIf="section === 'performance-dashboard' || section === 'leaderboard' || section === 'commission-dashboard' || section === 'payroll-dashboard'">
        <div class="panel-heading">
          <h2>Performance Intelligence</h2>
          <span>Avg score {{ store.performance().summary.avgScore | number:'1.0-0' }}</span>
        </div>
        <div class="split">
          <article>
            <strong>{{ store.performance().summary.revenue | currency:'INR':'symbol-narrow':'1.0-0' }}</strong>
            <span>Tracked revenue</span>
          </article>
          <article>
            <strong>{{ store.performance().summary.avgUtilization | number:'1.0-0' }}%</strong>
            <span>Avg utilization</span>
          </article>
        </div>
        <div class="table compact">
          <div class="row header"><span>Staff</span><span>Score</span><span>Revenue</span><span>Utilization</span></div>
          <div class="row" *ngFor="let row of store.performance().rows">
            <span>{{ row.staffId }}</span>
            <span>{{ row.productivityScore | number:'1.0-0' }}</span>
            <span>{{ row.revenueGenerated | currency:'INR':'symbol-narrow':'1.0-0' }}</span>
            <span>{{ row.utilizationPct | number:'1.0-0' }}%</span>
          </div>
          <div *ngIf="!store.performance().rows.length && !store.loading()" class="empty">No performance rows yet.</div>
        </div>
      </section>

      <section class="panel" *ngIf="section === 'task-board' || section === 'mobile-staff-dashboard-preview'">
        <div class="panel-heading">
          <h2>Tasks And Mobile Ops</h2>
          <span>{{ store.tasks().length }} open items</span>
        </div>
        <div class="task-grid">
          <article *ngFor="let task of store.tasks()">
            <strong>{{ task.title }}</strong>
            <span>{{ task.priority }} · {{ task.status }}</span>
          </article>
          <div *ngIf="!store.tasks().length && !store.loading()" class="empty">No staff tasks assigned.</div>
        </div>
      </section>
    </section>
  `,
  styles: [`
    .staff-os { display: grid; gap: 18px; padding: 24px; color: #10201a; }
    .topbar { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
    .topbar-actions { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
    .eyebrow { margin: 0 0 4px; color: #547066; font-size: 12px; text-transform: uppercase; letter-spacing: .08em; }
    h1, h2 { margin: 0; letter-spacing: 0; }
    h1 { font-size: 28px; }
    h2 { font-size: 18px; }
    .refresh, .primary, .icon-button { border: 1px solid #cbd8d2; background: #fff; border-radius: 6px; padding: 9px 12px; cursor: pointer; min-height: 38px; font-weight: 700; }
    .primary { background: #0f766e; border-color: #0f766e; color: #fff; }
    .primary:disabled { opacity: .65; cursor: wait; }
    .icon-button { width: 38px; padding: 0; font-size: 22px; }
    .row-action { border: 1px solid #cbd8d2; background: #fff; border-radius: 6px; padding: 7px 10px; cursor: pointer; min-height: 32px; font-weight: 800; color: #0f766e; }
    .row-action:disabled { opacity: .65; cursor: wait; }
    .metrics { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
    .metric, .panel, .state { border: 1px solid #d9e5de; background: #fff; border-radius: 8px; }
    .metric { display: grid; gap: 8px; padding: 14px; min-height: 76px; }
    .metric span { color: #5f746b; font-size: 13px; }
    .metric strong { font-size: 24px; }
    .metric.good { border-color: #bfe1ce; }
    .metric.warning { border-color: #ead28f; }
    .metric.critical { border-color: #e7b1b1; }
    .panel { display: grid; gap: 14px; padding: 16px; }
    .panel-heading, .row, .split { display: grid; align-items: center; gap: 12px; }
    .panel-heading { grid-template-columns: 1fr auto; color: #40544c; }
    .table { display: grid; border-top: 1px solid #edf2ef; }
    .row { grid-template-columns: 1.3fr .8fr 1fr 1fr .65fr 1.1fr .7fr; min-height: 44px; border-bottom: 1px solid #edf2ef; }
    .row strong { display: block; font-size: 14px; }
    .row small { color: #60766d; display: block; font-size: 12px; margin-top: 3px; }
    .row.header { color: #6c8178; font-size: 12px; text-transform: uppercase; }
    .compact .row { grid-template-columns: 1fr 1fr 1fr .8fr; }
    .badge { width: fit-content; border-radius: 999px; background: #eef6f1; color: #286345; padding: 4px 9px; font-size: 12px; }
    .live-badges, .row-links { display: flex; gap: 6px; flex-wrap: wrap; }
    .mini-badge { width: fit-content; border-radius: 999px; background: #f7faf8; border: 1px solid #d9e5de; color: #40544c; padding: 3px 8px; font-size: 11px; font-weight: 800; }
    .row-links a { border-bottom: 1px solid #99c8bd; color: #0f766e; font-size: 12px; font-weight: 800; text-decoration: none; }
    .state, .empty { padding: 14px; color: #61746c; }
    .error { color: #a52828; border-color: #e7b1b1; }
    .split { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .split article, .task-grid article { display: grid; gap: 6px; border: 1px solid #edf2ef; border-radius: 8px; padding: 14px; }
    .split strong { font-size: 24px; }
    .split span, .task-grid span { color: #60766d; }
    .heatmap { display: grid; grid-template-columns: repeat(14, minmax(10px, 1fr)); gap: 4px; }
    .heatmap span { aspect-ratio: 1; border-radius: 3px; background: #23865c; }
    .task-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
    .success { color: #0f766e; border-color: #b6d8cf; background: #f0fbf7; }
    .attendance-command .panel-heading { align-items: end; }
    .attendance-command .panel-heading span { color: #60766d; display: block; margin-top: 4px; }
    .attendance-controls { display: flex; align-items: center; justify-content: flex-end; gap: 10px; flex-wrap: wrap; }
    .attendance-controls input { width: 170px; min-height: 38px; }
    .attendance-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; }
    .attendance-stats article { border: 1px solid #d9e5de; border-radius: 8px; display: grid; gap: 4px; min-height: 78px; padding: 12px; }
    .attendance-stats span { color: #60766d; font-size: 11px; font-weight: 800; text-transform: uppercase; }
    .attendance-stats strong { font-size: 24px; color: #10201a; }
    .attendance-stats small { color: #60766d; }
    .attendance-workspace { display: grid; grid-template-columns: minmax(320px, .9fr) minmax(420px, 1.1fr); gap: 14px; align-items: start; }
    .attendance-wide { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .camera-panel { align-content: start; }
    .camera-stage { border: 1px solid #d9e5de; border-radius: 8px; background: #f7faf8; min-height: 260px; overflow: hidden; display: grid; place-items: center; }
    .camera-stage video { width: 100%; height: 100%; min-height: 260px; object-fit: cover; background: #10201a; }
    .camera-stage .hidden { display: none; }
    .camera-placeholder { color: #60766d; font-weight: 800; }
    .camera-form { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .device-form { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)) auto; gap: 10px; align-items: end; }
    .gateway-form, .mapping-form, .consent-form, .payroll-form { grid-template-columns: repeat(3, minmax(0, 1fr)) auto; }
    .device-form .primary { min-width: 120px; }
    .device-table .row, .evidence-table .row { grid-template-columns: 1.2fr .8fr .9fr .8fr; }
    .mapping-table .row { grid-template-columns: 1fr 1fr .8fr .7fr .7fr; }
    .risk-table .row { grid-template-columns: 1.4fr .5fr .6fr .7fr; }
    .mini { min-height: 34px; padding: 8px 10px; }
    .drawer-shell { position: fixed; inset: 0; z-index: 50; display: grid; justify-items: end; }
    .drawer-scrim { position: absolute; inset: 0; background: rgba(15, 23, 42, .35); }
    .drawer { position: relative; width: min(760px, 100%); height: 100%; overflow-y: auto; background: #fff; border-left: 1px solid #cbd8d2; box-shadow: -30px 0 70px rgba(15, 23, 42, .22); padding: 20px; display: flex; flex-direction: column; gap: 16px; }
    .drawer-header { display: flex; justify-content: space-between; gap: 16px; align-items: flex-start; }
    .drawer-header span { color: #60766d; font-size: 13px; }
    .detail-tabs { display: flex; gap: 6px; flex-wrap: wrap; border-bottom: 1px solid #edf2ef; padding-bottom: 10px; }
    .detail-tabs button { border: 1px solid #cbd8d2; background: #f8fbf9; border-radius: 6px; color: #34483f; cursor: pointer; font-weight: 800; min-height: 34px; padding: 7px 10px; }
    .detail-tabs button.active { background: #0f766e; border-color: #0f766e; color: #fff; }
    .live-context { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)) 1.4fr; gap: 10px; border: 1px solid #d9e5de; border-radius: 8px; background: #f8fbf9; padding: 12px; }
    .live-context article { display: grid; gap: 4px; min-width: 0; }
    .live-context span { color: #60766d; font-size: 11px; font-weight: 800; text-transform: uppercase; }
    .live-context strong { color: #10201a; font-size: 13px; overflow-wrap: anywhere; }
    .context-links { display: flex; align-items: center; justify-content: flex-end; gap: 8px; flex-wrap: wrap; }
    .context-links a { background: #fff; border: 1px solid #cbd8d2; border-radius: 6px; color: #0f766e; font-size: 12px; font-weight: 800; min-height: 30px; padding: 6px 9px; text-decoration: none; }
    .staff-form { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
    .field { display: grid; gap: 6px; font-weight: 800; color: #34483f; font-size: 13px; }
    .field.full, .drawer-actions, .staff-form .state { grid-column: 1 / -1; }
    .login-provision { display: grid; grid-column: 1 / -1; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; padding: 14px; border: 1px solid #b6d8cf; border-radius: 8px; background: #f0fbf7; }
    .login-provision > div, .login-provision .check-field { grid-column: 1 / -1; }
    .check-field { align-items: center; border: 1px solid #edf2ef; border-radius: 8px; color: #34483f; display: grid; font-size: 13px; font-weight: 800; gap: 8px; grid-template-columns: auto 1fr; min-height: 43px; padding: 10px 11px; }
    .check-field input { width: 18px; height: 18px; padding: 0; }
    .incentive-command { align-items: center; background: #f0fbf7; border: 1px solid #b6d8cf; border-radius: 8px; display: grid; gap: 12px; grid-template-columns: 1fr auto; padding: 14px; }
    .incentive-command strong { display: block; font-size: 16px; }
    .incentive-command small { color: #60766d; display: block; margin-top: 4px; }
    .incentive-summary { display: grid; gap: 10px; grid-template-columns: repeat(4, minmax(0, 1fr)); }
    .incentive-summary article { border: 1px solid #d9e5de; border-radius: 8px; display: grid; gap: 5px; min-height: 72px; padding: 12px; }
    .incentive-summary span { color: #60766d; font-size: 12px; font-weight: 800; text-transform: uppercase; }
    .incentive-summary strong { color: #10201a; font-size: 15px; overflow-wrap: anywhere; }
    .subdrawer-shell { position: fixed; inset: 0; z-index: 70; display: grid; justify-items: end; }
    .subdrawer-scrim { position: absolute; inset: 0; background: rgba(15, 23, 42, .22); }
    .subdrawer { position: relative; width: min(860px, 100%); height: 100%; overflow-y: auto; background: #fff; border-left: 1px solid #cbd8d2; box-shadow: -28px 0 70px rgba(15, 23, 42, .22); padding: 20px; display: grid; align-content: start; gap: 16px; }
    .advanced-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
    .rule-card { border: 1px solid #d9e5de; border-radius: 8px; display: grid; gap: 12px; padding: 14px; }
    .rule-heading { align-items: center; display: grid; gap: 12px; grid-template-columns: 1fr auto; }
    .rule-heading span { color: #60766d; display: block; font-size: 13px; margin-top: 3px; }
    .rule-actions { display: flex; flex-wrap: wrap; gap: 8px; justify-content: flex-end; }
    .rule-table, .slab-table { display: grid; gap: 8px; }
    .rule-row, .slab-row { display: grid; gap: 8px; align-items: center; }
    .rule-row { grid-template-columns: 1fr 1.45fr .8fr .75fr .75fr auto; }
    .slab-row { grid-template-columns: 1fr 1fr .8fr .8fr auto; }
    .rule-row.header, .slab-row.header { color: #60766d; font-size: 11px; font-weight: 800; min-height: 0; text-transform: uppercase; }
    .row-action.danger { color: #9f2424; }
    input, select, textarea { width: 100%; border: 1px solid #cbd8d2; border-radius: 8px; padding: 10px 11px; font: inherit; color: #10201a; background: #fff; }
    textarea { resize: vertical; min-height: 88px; }
    .field small { color: #a52828; font-weight: 700; }
    .drawer-actions { display: flex; justify-content: flex-end; gap: 10px; padding-top: 8px; border-top: 1px solid #edf2ef; }
    @media (max-width: 900px) { .metrics, .task-grid, .split, .attendance-stats, .attendance-workspace, .attendance-wide { grid-template-columns: 1fr 1fr; } .device-form, .gateway-form, .mapping-form, .consent-form, .payroll-form { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
    @media (max-width: 640px) {
      .staff-os { padding: 16px; }
      .topbar, .panel-heading { grid-template-columns: 1fr; align-items: start; }
      .metrics, .task-grid, .split, .attendance-stats, .attendance-workspace, .attendance-wide, .camera-form, .device-form, .gateway-form, .mapping-form, .consent-form, .payroll-form { grid-template-columns: 1fr; }
      .row, .compact .row { grid-template-columns: 1fr; padding: 10px 0; }
      .row.header { display: none; }
      .live-context { grid-template-columns: 1fr; }
      .context-links { justify-content: flex-start; }
      .drawer { width: 100%; }
      .staff-form { grid-template-columns: 1fr; }
      .advanced-grid, .incentive-command, .incentive-summary, .rule-heading, .rule-row, .slab-row { grid-template-columns: 1fr; }
      .subdrawer { width: 100%; }
      .login-provision { grid-template-columns: 1fr; }
    }
  `]
})
export class StaffOsSectionComponent implements OnInit, OnDestroy {
  @ViewChild('attendanceVideo') private attendanceVideo?: ElementRef<HTMLVideoElement>;
  @Input({ required: true }) title = 'Staff OS';
  @Input({ required: true }) section = 'staff-list';

  readonly heatmapCells = Array.from({ length: 42 });
  private cameraStream: MediaStream | null = null;
  readonly addStaffOpen = signal(false);
  readonly addStaffSaving = signal(false);
  readonly addStaffError = signal('');
  readonly staffActionError = signal('');
  readonly statusChanging = signal('');
  readonly attendanceDate = signal(new Date().toISOString().slice(0, 10));
  readonly attendanceError = signal('');
  readonly attendanceMessage = signal('');
  readonly cameraActive = signal(false);
  readonly cameraStarting = signal(false);
  readonly cameraSaving = signal(false);
  readonly deviceSaving = signal(false);
  readonly gatewaySaving = signal(false);
  readonly mappingSaving = signal(false);
  readonly consentSaving = signal(false);
  readonly fraudScanning = signal(false);
  readonly payrollPreviewSaving = signal(false);
  readonly queueProcessing = signal(false);
  readonly advancedIncentiveOpen = signal(false);
  readonly incentiveRules = signal<IncentiveRuleDraft[]>([this.defaultIncentiveRule('service_category')]);
  readonly incentiveSlabs = signal<IncentiveSlabDraft[]>([this.defaultIncentiveSlab(0, 25000, 5)]);
  readonly detailTab = signal<StaffDetailTab>('core');
  readonly branchOptions = computed(() => this.orderedBranchOptions());
  readonly detailTabs: Array<{ id: StaffDetailTab; label: string }> = [
    { id: 'core', label: 'Core' },
    { id: 'contact', label: 'Contact' },
    { id: 'emergency', label: 'Emergency' },
    { id: 'native', label: 'Native Contact' },
    { id: 'incentive', label: 'Incentive %' },
    { id: 'attendance', label: 'Attendance / Salary' },
    { id: 'remarks', label: 'Remarks' }
  ];
  readonly integrationLinks: Record<StaffDetailTab, StaffIntegrationLink[]> = {
    core: [
      { label: 'Category Master', to: '/staff-os/staff-categories' },
      { label: 'Staff Profile', to: '/staff-os/staff-profile' },
      { label: 'Roster', to: '/staff-os/roster-calendar' }
    ],
    contact: [
      { label: 'Staff Profile', to: '/staff-os/staff-profile' },
      { label: 'Mobile Preview', to: '/staff-os/mobile-preview' }
    ],
    emergency: [
      { label: 'Staff Profile', to: '/staff-os/staff-profile' },
      { label: 'Leave', to: '/staff-os/leave-management' }
    ],
    native: [
      { label: 'Staff Profile', to: '/staff-os/staff-profile' },
      { label: 'Mobile Preview', to: '/staff-os/mobile-preview' }
    ],
    incentive: [
      { label: 'Commission', to: '/staff-os/commission-dashboard' },
      { label: 'Performance', to: '/staff-os/performance-dashboard' },
      { label: 'Leaderboard', to: '/staff-os/leaderboard' }
    ],
    attendance: [
      { label: 'Attendance', to: '/staff-os/attendance-dashboard' },
      { label: 'Payroll', to: '/staff-os/payroll-dashboard' },
      { label: 'Roster', to: '/staff-os/roster-calendar' }
    ],
    remarks: [
      { label: 'Staff Profile', to: '/staff-os/staff-profile' },
      { label: 'Tasks', to: '/staff-os/task-board' },
      { label: 'Training', to: '/staff-os/training-center' }
    ]
  };
  readonly staffForm = this.fb.group({
    branchId: ['', Validators.required],
    firstName: ['', [Validators.required, Validators.minLength(2)]],
    lastName: [''],
    shortName: [''],
    employeeCode: [''],
    mobile: ['', [Validators.pattern(/^[+0-9\s-]{10,16}$/)]],
    email: ['', Validators.email],
    enableStaffLogin: [false],
    loginId: [''],
    loginPassword: ['', Validators.minLength(6)],
    loginRole: ['staff'],
    roleId: ['staff', Validators.required],
    staffCategoryId: [''],
    employmentType: ['full_time', Validators.required],
    department: [''],
    designation: ['', Validators.required],
    joiningDate: [''],
    lastWorkingDate: [''],
    birthDate: [''],
    anniversaryDate: [''],
    gender: [''],
    entryPin: [''],
    hideFromRoster: [false],
    allowSkipOtp: [false],
    skillLicenseNotes: [''],
    contactPerson: [''],
    contactMobile: [''],
    address: [''],
    addressLine2: [''],
    landmark: [''],
    city: [''],
    pincode: [''],
    state: [''],
    country: [''],
    area: [''],
    phone: [''],
    fax: [''],
    contactEmail: ['', Validators.email],
    web: [''],
    emergencyContactName: [''],
    emergencyContactMobile: [''],
    emergencyContactPhone: [''],
    emergencyRelation: [''],
    emergencyAddress: [''],
    emergencyCity: [''],
    emergencyState: [''],
    emergencyCountry: [''],
    nativeContactName: [''],
    nativeContactMobile: [''],
    nativeContactPhone: [''],
    nativeAddress: [''],
    nativeCity: [''],
    nativeState: [''],
    nativeCountry: [''],
    fixedIncentivePercent: [0],
    fixedIncentiveAmount: [0],
    serviceIncentiveRules: [''],
    incentiveNotes: [''],
    incentiveCycle: ['monthly'],
    incentiveStartDate: [''],
    incentiveEndDate: [''],
    incentiveCapAmount: [0],
    incentivePayrollSync: [true],
    incentiveRequiresApproval: [true],
    incentiveApprovalRole: ['manager'],
    incentiveHoldOnAbsentDays: [2],
    incentiveReduceOnLateCount: [3],
    incentiveReducePercent: [10],
    incentivePayoutStatus: ['draft'],
    weeklyOff: [''],
    empCodeInDevice: [''],
    rfidCardNo: [''],
    attendanceCategory: [''],
    defaultShift: [''],
    devicePrivilege: ['user'],
    basicSalary: [0],
    paymentMode: [''],
    bankName: [''],
    accountNumber: [''],
    loanInstallment: [0],
    loanBalance: [0],
    otExtraRate: [0],
    lessWorkPenalty: [0],
    supportAttendancePayroll: [false],
    weeklyOffOvertime: [false],
    pfApplicable: [false],
    pfNo: [''],
    ptApplicable: [false],
    ptNo: [''],
    esicApplicable: [false],
    esicNo: [''],
    tdsApplicable: [false],
    panNo: [''],
    aadhaarNo: [''],
    remarks: [''],
    imeiNo: ['']
  });
  readonly cameraForm = this.fb.group({
    branchId: [''],
    staffId: ['', Validators.required],
    punchType: ['clock_in'],
    livenessScore: [0.92],
    matchScore: [0.9],
    notes: ['']
  });
  readonly deviceForm = this.fb.group({
    branchId: ['', Validators.required],
    provider: ['zkteco', Validators.required],
    deviceCode: ['', Validators.required],
    deviceName: [''],
    locationLabel: [''],
    connectionMode: ['offline_sync']
  });
  readonly gatewayForm = this.fb.group({
    branchId: ['', Validators.required],
    gatewayCode: ['', Validators.required],
    displayName: [''],
    machineName: [''],
    versionLabel: [''],
    providers: ['zkteco, essl, mantra']
  });
  readonly mappingForm = this.fb.group({
    branchId: ['', Validators.required],
    deviceId: ['', Validators.required],
    staffId: ['', Validators.required],
    externalUserId: ['', Validators.required],
    notes: ['']
  });
  readonly consentForm = this.fb.group({
    branchId: ['', Validators.required],
    staffId: ['', Validators.required],
    consentType: ['biometric_attendance'],
    consentStatus: ['granted'],
    consentChannel: ['paper'],
    retentionDays: [365],
    consentText: ['Staff consent captured for biometric/camera attendance, payroll automation and audit evidence.']
  });
  readonly payrollPreviewForm = this.fb.group({
    branchId: ['', Validators.required],
    periodStart: [new Date().toISOString().slice(0, 10), Validators.required],
    periodEnd: [new Date().toISOString().slice(0, 10), Validators.required],
    defaultShiftStart: ['10:00'],
    lateGraceMinutes: [15],
    incentiveHoldAbsentDays: [2],
    latePenaltyAmount: [0],
    defaultGrossAmount: [0]
  });

  constructor(
    public readonly store: StaffOsStore,
    private readonly fb: UntypedFormBuilder,
    private readonly route: ActivatedRoute,
    private readonly appState: AppStateService
  ) {
    effect(() => {
      const options = this.branchOptions();
      if (!this.addStaffOpen() || this.staffForm.get('branchId')?.value) return;
      const branchId = this.defaultBranchId(options);
      if (branchId) this.staffForm.patchValue({ branchId }, { emitEvent: false });
    });
    effect(() => {
      const branchId = this.defaultBranchId(this.branchOptions());
      if (!branchId) return;
      if (!this.cameraForm.get('branchId')?.value) this.cameraForm.patchValue({ branchId }, { emitEvent: false });
      if (!this.deviceForm.get('branchId')?.value) this.deviceForm.patchValue({ branchId }, { emitEvent: false });
      if (!this.gatewayForm.get('branchId')?.value) this.gatewayForm.patchValue({ branchId }, { emitEvent: false });
      if (!this.mappingForm.get('branchId')?.value) this.mappingForm.patchValue({ branchId }, { emitEvent: false });
      if (!this.consentForm.get('branchId')?.value) this.consentForm.patchValue({ branchId }, { emitEvent: false });
      if (!this.payrollPreviewForm.get('branchId')?.value) this.payrollPreviewForm.patchValue({ branchId }, { emitEvent: false });
    });
  }

  ngOnInit(): void {
    this.store.load();
    if (this.section === 'attendance-dashboard') {
      this.refreshAttendanceCenter();
    }
    if (this.section === 'staff-list' && this.route.snapshot.queryParamMap.get('add') === '1') {
      this.openAddStaff();
    }
  }

  ngOnDestroy(): void {
    this.stopCamera();
  }

  opacity(index: number): number {
    return 0.25 + ((index % 7) / 10);
  }

  setAttendanceDate(value: string): void {
    if (!value) return;
    this.attendanceDate.set(value);
    this.refreshAttendanceCenter();
  }

  refreshAttendanceCenter(): void {
    const branchId = this.attendanceBranchId();
    this.attendanceError.set('');
    this.store.loadAttendanceCenter({ branchId, date: this.attendanceDate() });
  }

  attendanceSummary(): ApiRecord {
    return (this.store.biometricCenter()?.['summary'] || {}) as ApiRecord;
  }

  attendanceRows(): ApiRecord[] {
    const centerRows = this.store.biometricCenter()?.['attendance'];
    return Array.isArray(centerRows) ? centerRows : this.store.attendance();
  }

  activeStaffForAttendance(): StaffOsStaff[] {
    const branchId = this.attendanceBranchId();
    return this.store.staff().filter((staff) => {
      const status = String(staff.status || '').toLowerCase();
      const branchMatches = !branchId || staff.branchId === branchId;
      return branchMatches && (!status || status === 'active' || status === 'working');
    });
  }

  gatewayRows(): ApiRecord[] {
    const rows = this.store.biometricCenter()?.['gateways'];
    return Array.isArray(rows) ? rows : [];
  }

  registerGateway(): void {
    if (this.gatewayForm.invalid) {
      this.gatewayForm.markAllAsTouched();
      return;
    }
    const value = this.gatewayForm.getRawValue() as ApiRecord;
    const providers = String(value['providers'] || '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
    this.attendanceError.set('');
    this.attendanceMessage.set('');
    this.gatewaySaving.set(true);
    this.store.registerGateway({ ...value, providers })
      .pipe(finalize(() => this.gatewaySaving.set(false)))
      .subscribe({
        next: (result) => {
          this.attendanceMessage.set(`Gateway registered. API key generated once: ${result['gatewayApiKey'] || 'stored'}`);
          const branchId = String(value['branchId'] || this.attendanceBranchId());
          this.gatewayForm.patchValue({ branchId, gatewayCode: '', displayName: '', machineName: '', versionLabel: '' });
          this.store.loadAttendanceCenter({ branchId, date: this.attendanceDate() });
        },
        error: (error: { error?: { error?: string; message?: string }; message?: string }) => {
          this.attendanceError.set(error?.error?.error || error?.error?.message || error?.message || 'Unable to register gateway');
        }
      });
  }

  createBiometricMapping(): void {
    if (this.mappingForm.invalid) {
      this.mappingForm.markAllAsTouched();
      return;
    }
    const value = this.mappingForm.getRawValue() as ApiRecord;
    this.attendanceError.set('');
    this.attendanceMessage.set('');
    this.mappingSaving.set(true);
    this.store.createBiometricMapping(value)
      .pipe(finalize(() => this.mappingSaving.set(false)))
      .subscribe({
        next: () => {
          const branchId = String(value['branchId'] || this.attendanceBranchId());
          this.attendanceMessage.set('Staff biometric mapping created.');
          this.mappingForm.patchValue({ branchId, deviceId: '', staffId: '', externalUserId: '', notes: '' });
          this.store.loadAttendanceCenter({ branchId, date: this.attendanceDate() });
        },
        error: (error: { error?: { error?: string; message?: string }; message?: string }) => {
          this.attendanceError.set(error?.error?.error || error?.error?.message || error?.message || 'Unable to create biometric mapping');
        }
      });
  }

  approveBiometricMapping(mapping: ApiRecord): void {
    const id = String(mapping['id'] || '');
    if (!id) return;
    const branchId = String(mapping['branchId'] || this.attendanceBranchId());
    this.attendanceError.set('');
    this.attendanceMessage.set('');
    this.store.approveBiometricMapping(id, { version: mapping['version'] || 1 })
      .subscribe({
        next: () => {
          this.attendanceMessage.set('Biometric mapping approved.');
          this.store.loadAttendanceCenter({ branchId, date: this.attendanceDate() });
        },
        error: (error: { error?: { error?: string; message?: string }; message?: string }) => {
          this.attendanceError.set(error?.error?.error || error?.error?.message || error?.message || 'Unable to approve mapping');
        }
      });
  }

  saveBiometricConsent(): void {
    if (this.consentForm.invalid) {
      this.consentForm.markAllAsTouched();
      return;
    }
    const value = this.consentForm.getRawValue() as ApiRecord;
    this.attendanceError.set('');
    this.attendanceMessage.set('');
    this.consentSaving.set(true);
    this.store.upsertBiometricConsent(value)
      .pipe(finalize(() => this.consentSaving.set(false)))
      .subscribe({
        next: () => {
          const branchId = String(value['branchId'] || this.attendanceBranchId());
          this.attendanceMessage.set('Biometric consent saved.');
          this.consentForm.patchValue({ branchId, staffId: '' });
          this.store.loadAttendanceCenter({ branchId, date: this.attendanceDate() });
        },
        error: (error: { error?: { error?: string; message?: string }; message?: string }) => {
          this.attendanceError.set(error?.error?.error || error?.error?.message || error?.message || 'Unable to save consent');
        }
      });
  }

  requestConsentDeletion(consent: ApiRecord): void {
    const id = String(consent['id'] || '');
    if (!id) return;
    const branchId = String(consent['branchId'] || this.attendanceBranchId());
    this.attendanceError.set('');
    this.attendanceMessage.set('');
    this.store.requestBiometricConsentDeletion(id, { reason: 'Staff requested biometric evidence delete review' })
      .subscribe({
        next: () => {
          this.attendanceMessage.set('Consent delete request recorded.');
          this.store.loadAttendanceCenter({ branchId, date: this.attendanceDate() });
        },
        error: (error: { error?: { error?: string; message?: string }; message?: string }) => {
          this.attendanceError.set(error?.error?.error || error?.error?.message || error?.message || 'Unable to request delete');
        }
      });
  }

  runFraudScan(): void {
    const branchId = this.attendanceBranchId();
    if (!branchId) {
      this.attendanceError.set('Select branch first.');
      return;
    }
    this.attendanceError.set('');
    this.attendanceMessage.set('');
    this.fraudScanning.set(true);
    this.store.runAttendanceFraudScan({ branchId, date: this.attendanceDate() })
      .pipe(finalize(() => this.fraudScanning.set(false)))
      .subscribe({
        next: (result) => {
          const risks = Array.isArray(result['openRisks']) ? result['openRisks'].length : 0;
          this.attendanceMessage.set(`Fraud scan complete. ${risks} open risk event(s).`);
          this.store.loadAttendanceCenter({ branchId, date: this.attendanceDate() });
        },
        error: (error: { error?: { error?: string; message?: string }; message?: string }) => {
          this.attendanceError.set(error?.error?.error || error?.error?.message || error?.message || 'Unable to run fraud scan');
        }
      });
  }

  generatePayrollPreview(): void {
    if (this.payrollPreviewForm.invalid) {
      this.payrollPreviewForm.markAllAsTouched();
      return;
    }
    const value = this.payrollPreviewForm.getRawValue() as ApiRecord;
    const branchId = String(value['branchId'] || this.attendanceBranchId());
    this.attendanceError.set('');
    this.attendanceMessage.set('');
    this.payrollPreviewSaving.set(true);
    this.store.generateAttendancePayrollPreview(value)
      .pipe(finalize(() => this.payrollPreviewSaving.set(false)))
      .subscribe({
        next: (result) => {
          const rows = Array.isArray(result['rows']) ? result['rows'].length : 0;
          this.attendanceMessage.set(`Payroll autopilot preview generated for ${rows} staff.`);
          this.store.loadAttendanceCenter({ branchId, date: this.attendanceDate(), periodStart: value['periodStart'], periodEnd: value['periodEnd'] });
        },
        error: (error: { error?: { error?: string; message?: string }; message?: string }) => {
          this.attendanceError.set(error?.error?.error || error?.error?.message || error?.message || 'Unable to generate payroll preview');
        }
      });
  }

  registerBiometricDevice(): void {
    if (this.deviceForm.invalid) {
      this.deviceForm.markAllAsTouched();
      return;
    }
    const value = this.deviceForm.getRawValue();
    this.attendanceError.set('');
    this.attendanceMessage.set('');
    this.deviceSaving.set(true);
    this.store.registerBiometricDevice(value)
      .pipe(finalize(() => this.deviceSaving.set(false)))
      .subscribe({
        next: () => {
          const branchId = String(value.branchId || this.attendanceBranchId());
          this.deviceForm.patchValue({ branchId, deviceCode: '', deviceName: '', locationLabel: '' });
          this.attendanceMessage.set('Biometric device added.');
          this.store.loadAttendanceCenter({ branchId, date: this.attendanceDate() });
        },
        error: (error: { error?: { error?: string; message?: string }; message?: string }) => {
          this.attendanceError.set(error?.error?.error || error?.error?.message || error?.message || 'Unable to add biometric device');
        }
      });
  }

  processBiometricQueue(): void {
    const branchId = this.attendanceBranchId();
    if (!branchId) {
      this.attendanceError.set('Select branch first.');
      return;
    }
    this.attendanceError.set('');
    this.attendanceMessage.set('');
    this.queueProcessing.set(true);
    this.store.processBiometricQueue({ branchId, limit: 100 })
      .pipe(finalize(() => this.queueProcessing.set(false)))
      .subscribe({
        next: (result) => {
          this.attendanceMessage.set(`Biometric queue processed: ${result['processed'] || 0} ok, ${result['failed'] || 0} failed.`);
          this.store.loadAttendanceCenter({ branchId, date: this.attendanceDate() });
        },
        error: (error: { error?: { error?: string; message?: string }; message?: string }) => {
          this.attendanceError.set(error?.error?.error || error?.error?.message || error?.message || 'Unable to process biometric queue');
        }
      });
  }

  async startCamera(): Promise<void> {
    this.attendanceError.set('');
    this.attendanceMessage.set('');
    if (!globalThis.navigator?.mediaDevices?.getUserMedia) {
      this.attendanceError.set('Camera is not available in this browser.');
      return;
    }
    this.cameraStarting.set(true);
    try {
      this.stopCamera();
      const stream = await globalThis.navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
      this.cameraStream = stream;
      this.cameraActive.set(true);
      await new Promise((resolve) => setTimeout(resolve, 0));
      const video = this.attendanceVideo?.nativeElement;
      if (video) {
        video.srcObject = stream;
        await video.play();
      }
    } catch (error) {
      this.cameraActive.set(false);
      this.attendanceError.set(error instanceof Error ? error.message : 'Unable to open camera');
    } finally {
      this.cameraStarting.set(false);
    }
  }

  stopCamera(): void {
    if (this.cameraStream) {
      for (const track of this.cameraStream.getTracks()) track.stop();
    }
    this.cameraStream = null;
    if (this.attendanceVideo?.nativeElement) {
      this.attendanceVideo.nativeElement.srcObject = null;
    }
    this.cameraActive.set(false);
  }

  submitCameraPunch(): void {
    if (this.cameraForm.invalid) {
      this.cameraForm.markAllAsTouched();
      return;
    }
    const imageDataUrl = this.captureCameraImage();
    if (!imageDataUrl) {
      this.attendanceError.set('Start camera before saving punch.');
      return;
    }
    const value = this.cameraForm.getRawValue() as ApiRecord;
    const branchId = String(value['branchId'] || this.attendanceBranchId());
    const punchType = String(value['punchType'] || 'clock_in') as AttendancePunchType;
    this.attendanceError.set('');
    this.attendanceMessage.set('');
    this.cameraSaving.set(true);
    this.store.cameraPunch({
      ...value,
      branchId,
      punchType,
      businessDate: this.attendanceDate(),
      capturedAt: new Date().toISOString(),
      imageDataUrl
    }).pipe(finalize(() => this.cameraSaving.set(false))).subscribe({
      next: () => {
        this.attendanceMessage.set(punchType === 'clock_in' ? 'Camera clock-in saved.' : 'Camera clock-out saved.');
        this.store.loadAttendanceCenter({ branchId, date: this.attendanceDate() });
      },
      error: (error: { error?: { error?: string; message?: string }; message?: string }) => {
        this.attendanceError.set(error?.error?.error || error?.error?.message || error?.message || 'Unable to save camera attendance');
      }
    });
  }

  displayStaffName(row: ApiRecord): string {
    const name = String(row['staffName'] || row['staff_name'] || '').trim();
    if (name) return name;
    const staff = this.store.staff().find((item) => item.id === row['staffId'] || item.id === row['staff_id']);
    return staff?.fullName || String(row['staffId'] || row['staff_id'] || 'Staff');
  }

  timeOnly(value: unknown): string {
    if (!value) return '';
    const date = new Date(String(value));
    if (Number.isNaN(date.getTime())) return String(value).slice(11, 16);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  openAddStaff(): void {
    const branchId = this.staffForm.get('branchId')?.value || this.defaultBranchId(this.branchOptions());
    this.addStaffError.set('');
    this.staffForm.patchValue({ branchId });
    this.detailTab.set('core');
    this.addStaffOpen.set(true);
  }

  private attendanceBranchId(): string {
    return String(
      this.cameraForm.get('branchId')?.value
      || this.deviceForm.get('branchId')?.value
      || this.gatewayForm.get('branchId')?.value
      || this.mappingForm.get('branchId')?.value
      || this.consentForm.get('branchId')?.value
      || this.payrollPreviewForm.get('branchId')?.value
      || this.appState.selectedBranchId()
      || this.branchOptions()[0]?.id
      || ''
    );
  }

  private captureCameraImage(): string {
    const video = this.attendanceVideo?.nativeElement;
    if (!video || !this.cameraActive()) return '';
    const width = video.videoWidth || 640;
    const height = video.videoHeight || 480;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) return '';
    context.drawImage(video, 0, 0, width, height);
    return canvas.toDataURL('image/jpeg', 0.72);
  }

  closeAddStaff(): void {
    if (this.addStaffSaving()) return;
    this.addStaffOpen.set(false);
    this.addStaffError.set('');
  }

  fieldInvalid(name: string): boolean {
    const control = this.staffForm.get(name);
    return Boolean(control && control.invalid && (control.dirty || control.touched));
  }

  saveStaff(): void {
    if (this.staffForm.invalid) {
      this.staffForm.markAllAsTouched();
      return;
    }
    const value = this.staffForm.getRawValue() as Record<string, unknown>;
    const loginEnabled = Boolean(value.enableStaffLogin || value.loginId || value.loginPassword);
    if (loginEnabled && (!String(value.loginId || '').trim() || !String(value.loginPassword || '').trim())) {
      this.addStaffError.set('Login ID and password are required when staff login is enabled.');
      this.detailTab.set('core');
      return;
    }
    const skillNotes = String(value.skillLicenseNotes || '').trim();
    const notes = skillNotes ? `Skill/license notes: ${skillNotes}` : '';
    const employeeDetails = this.buildEmployeeDetails(value);
    this.addStaffSaving.set(true);
    this.addStaffError.set('');
    this.store.createStaff({
      branchId: value.branchId,
      employeeCode: value.employeeCode,
      firstName: value.firstName,
      lastName: value.lastName,
      mobile: value.mobile || value.contactMobile,
      email: value.email || value.contactEmail,
      gender: value.gender,
      dob: value.birthDate,
      joiningDate: value.joiningDate,
      roleId: value.roleId,
      staffCategoryId: value.staffCategoryId,
      employmentType: value.employmentType,
      department: value.department,
      designation: value.designation,
      emergencyContactName: value.emergencyContactName,
      emergencyContactMobile: value.emergencyContactMobile,
      address: value.address,
      city: value.city,
      state: value.state,
      pincode: value.pincode,
      employeeDetails,
      staffLogin: loginEnabled ? {
        enabled: true,
        loginId: value.loginId,
        email: value.email || value.contactEmail,
        password: value.loginPassword,
        role: value.loginRole || 'staff'
      } : undefined,
      notes
    }).pipe(finalize(() => this.addStaffSaving.set(false))).subscribe({
      next: () => {
        const branchId = String(value.branchId || '');
        this.staffForm.reset(this.defaultStaffFormValue(branchId));
        this.resetIncentiveProfile();
        this.detailTab.set('core');
        this.addStaffOpen.set(false);
        this.store.load();
      },
      error: (error: { error?: { error?: string; message?: string }; message?: string }) => {
        this.addStaffError.set(error?.error?.error || error?.error?.message || error?.message || 'Unable to save staff');
      }
    });
  }

  activeCategoriesForSelectedBranch(): StaffOsStaffCategory[] {
    const branchId = this.staffForm.get('branchId')?.value || '';
    return this.store.staffCategories().filter((category) => {
      const branchMatches = !category.branchId || !branchId || category.branchId === branchId;
      return category.status === 'active' && branchMatches;
    });
  }

  applySelectedCategoryDefaults(): void {
    const categoryId = this.staffForm.get('staffCategoryId')?.value;
    const category = this.store.staffCategories().find((item) => item.id === categoryId);
    if (!category) return;
    this.staffForm.patchValue({
      department: category.department || this.staffForm.get('department')?.value || '',
      designation: category.defaultDesignation || this.staffForm.get('designation')?.value || '',
      employmentType: category.defaultEmploymentType || this.staffForm.get('employmentType')?.value || 'full_time',
      fixedIncentivePercent: category.fixedIncentivePercent ?? this.staffForm.get('fixedIncentivePercent')?.value ?? 0,
      fixedIncentiveAmount: category.fixedIncentiveAmount ?? this.staffForm.get('fixedIncentiveAmount')?.value ?? 0,
      serviceIncentiveRules: category.serviceEligibility?.length
        ? category.serviceEligibility.join(', ')
        : this.staffForm.get('serviceIncentiveRules')?.value || '',
      skillLicenseNotes: category.skillLicenses?.length
        ? category.skillLicenses.join(', ')
        : this.staffForm.get('skillLicenseNotes')?.value || ''
    });
  }

  selectedCategory(): StaffOsStaffCategory | undefined {
    const categoryId = this.staffForm.get('staffCategoryId')?.value;
    return this.store.staffCategories().find((item) => item.id === categoryId);
  }

  selectedBranchName(): string {
    const branchId = this.staffForm.get('branchId')?.value || '';
    const branch = this.branchOptions().find((item) => item.id === branchId);
    return branch?.name || branchId || 'Select branch';
  }

  private orderedBranchOptions(): StaffOsBranch[] {
    const selectedBranchId = this.appState.selectedBranchId();
    const seen = new Set<string>();
    const rows = this.store.branches()
      .filter((branch) => {
        const id = String(branch.id || '').trim();
        if (!id || seen.has(id)) return false;
        seen.add(id);
        return !branch.status || branch.status === 'active' || id === selectedBranchId;
      })
      .sort((left, right) => {
        if (left.id === selectedBranchId) return -1;
        if (right.id === selectedBranchId) return 1;
        return String(left.name || left.id).localeCompare(String(right.name || right.id));
      });
    if (selectedBranchId && !seen.has(selectedBranchId)) {
      return [{ id: selectedBranchId, name: selectedBranchId, status: 'active' }, ...rows];
    }
    return rows;
  }

  private defaultBranchId(options: StaffOsBranch[]): string {
    return this.appState.selectedBranchId() || options[0]?.id || '';
  }

  private serviceCategoryOptions(): IncentiveOption[] {
    const seen = new Set<string>();
    return this.store.services()
      .map((service) => String(service.category || '').trim())
      .filter((category) => {
        if (!category || seen.has(category)) return false;
        seen.add(category);
        return true;
      })
      .sort((left, right) => left.localeCompare(right))
      .map((category) => ({ id: category, name: category, meta: 'category' }));
  }

  private recordOptions(rows: Array<Record<string, unknown>>): IncentiveOption[] {
    return rows
      .filter((row) => !row['status'] || row['status'] === 'active')
      .map((row) => ({
        id: String(row['id'] || ''),
        name: String(row['name'] || row['title'] || row['sku'] || row['id'] || ''),
        meta: [row['category'], row['price'] ? `₹${row['price']}` : '', row['status']].filter(Boolean).join(' · ')
      }))
      .filter((row) => row.id && row.name)
      .sort((left, right) => left.name.localeCompare(right.name));
  }

  private defaultIncentiveRule(type: IncentiveRuleType): IncentiveRuleDraft {
    return {
      id: this.makeDraftId('rule'),
      type,
      targetId: '',
      targetName: '',
      calcMode: type === 'product' ? 'fixed' : 'percent',
      value: type === 'product' ? 50 : 5,
      minAmount: 0,
      notes: '',
      active: true
    };
  }

  private defaultIncentiveSlab(fromAmount: number, toAmount: number, incentivePercent: number): IncentiveSlabDraft {
    return {
      id: this.makeDraftId('slab'),
      fromAmount,
      toAmount,
      incentivePercent,
      incentiveAmount: 0
    };
  }

  private resetIncentiveProfile(): void {
    this.advancedIncentiveOpen.set(false);
    this.incentiveRules.set([this.defaultIncentiveRule('service_category')]);
    this.incentiveSlabs.set([this.defaultIncentiveSlab(0, 25000, 5)]);
  }

  private makeDraftId(prefix: string): string {
    return `${prefix}_${globalThis.crypto?.randomUUID?.() || `${Date.now()}_${Math.random().toString(16).slice(2)}`}`;
  }

  selectedCategoryDefaultsText(): string {
    const category = this.selectedCategory();
    if (!category) return 'Waiting for category';
    const parts = [
      category.department,
      category.defaultDesignation,
      category.defaultEmploymentType,
      category.fixedIncentivePercent ? `${category.fixedIncentivePercent}% incentive` : '',
      category.fixedIncentiveAmount ? `₹${category.fixedIncentiveAmount} fixed` : ''
    ].filter(Boolean);
    return parts.join(' · ') || 'No defaults set';
  }

  incentiveSummaryText(): string {
    const rules = this.incentiveRules().length;
    const slabs = this.incentiveSlabs().length;
    const payroll = this.staffForm.get('incentivePayrollSync')?.value ? 'payroll auto-sync' : 'manual payroll review';
    const approval = this.staffForm.get('incentiveRequiresApproval')?.value ? 'approval required' : 'no approval gate';
    return `${rules} rule${rules === 1 ? '' : 's'} · ${slabs} slab${slabs === 1 ? '' : 's'} · ${payroll} · ${approval}`;
  }

  targetOptionsFor(type: IncentiveRuleType): IncentiveOption[] {
    if (type === 'service_category') return this.serviceCategoryOptions();
    if (type === 'service') {
      return this.store.services()
        .filter((service) => !service.status || service.status === 'active')
        .map((service) => ({
          id: service.id,
          name: service.name,
          meta: [service.category, service.price ? `₹${service.price}` : ''].filter(Boolean).join(' · ')
        }));
    }
    if (type === 'product') return this.recordOptions(this.store.products());
    if (type === 'membership') return this.recordOptions(this.store.memberships());
    if (type === 'package') return this.recordOptions(this.store.packages());
    return [];
  }

  addIncentiveRule(type: IncentiveRuleType = 'service_category'): void {
    this.incentiveRules.update((rules) => [...rules, this.defaultIncentiveRule(type)]);
  }

  removeIncentiveRule(id: string): void {
    this.incentiveRules.update((rules) => rules.length === 1 ? rules : rules.filter((rule) => rule.id !== id));
  }

  setIncentiveRuleType(id: string, type: IncentiveRuleType): void {
    this.incentiveRules.update((rules) => rules.map((rule) => rule.id === id ? {
      ...rule,
      type,
      targetId: '',
      targetName: '',
      calcMode: type === 'product' ? 'fixed' : 'percent'
    } : rule));
  }

  setIncentiveRuleTarget(id: string, type: IncentiveRuleType, targetId: string): void {
    const option = this.targetOptionsFor(type).find((item) => item.id === targetId);
    this.incentiveRules.update((rules) => rules.map((rule) => rule.id === id ? {
      ...rule,
      targetId,
      targetName: option?.name || targetId
    } : rule));
  }

  updateIncentiveRule(id: string, key: keyof IncentiveRuleDraft, value: string): void {
    const numericKeys = new Set<keyof IncentiveRuleDraft>(['value', 'minAmount']);
    const booleanKeys = new Set<keyof IncentiveRuleDraft>(['active']);
    this.incentiveRules.update((rules) => rules.map((rule) => {
      if (rule.id !== id) return rule;
      const nextValue = numericKeys.has(key)
        ? Number(value || 0)
        : booleanKeys.has(key)
          ? value === 'true'
          : value;
      return { ...rule, [key]: nextValue };
    }));
  }

  addIncentiveSlab(): void {
    const slabs = this.incentiveSlabs();
    const last = slabs[slabs.length - 1];
    const nextFrom = Number(last?.toAmount || 0) + 1;
    const nextTo = nextFrom + 25000;
    this.incentiveSlabs.update((slabs) => [...slabs, this.defaultIncentiveSlab(nextFrom, nextTo, Number(last?.incentivePercent || 5) + 2)]);
  }

  removeIncentiveSlab(id: string): void {
    this.incentiveSlabs.update((slabs) => slabs.length === 1 ? slabs : slabs.filter((slab) => slab.id !== id));
  }

  updateIncentiveSlab(id: string, key: keyof IncentiveSlabDraft, value: string): void {
    this.incentiveSlabs.update((slabs) => slabs.map((slab) => slab.id === id ? { ...slab, [key]: Number(value || 0) } : slab));
  }

  trackById(_index: number, item: { id: string }): string {
    return item.id;
  }

  activeIntegrationLinks(): StaffIntegrationLink[] {
    return this.integrationLinks[this.detailTab()];
  }

  staffLiveBadges(staff: StaffOsStaff): string[] {
    const details = staff.employeeDetails;
    const salary = (details?.attendanceSalary || {}) as Record<string, unknown>;
    const badges = [];
    if (details?.contact && Object.keys(details.contact).length) badges.push('Contact');
    if (details?.emergencyContact && Object.keys(details.emergencyContact).length) badges.push('Emergency');
    if (details?.incentive && Object.keys(details.incentive).length) badges.push('Incentive');
    if (Number(salary['basicSalary'] || 0) > 0) badges.push('Salary');
    if (staff.staffCategoryName) badges.push('Category');
    if (staff.loginPasswordSet) badges.push('Login');
    return badges.length ? badges : ['Core only'];
  }

  categoryScopeLabel(scope: string): string {
    const labels: Record<string, string> = {
      operator: 'Operator',
      helper: 'Helper',
      admin: 'Admin',
      staff: 'Staff',
      contract_operator: 'Contract Operator'
    };
    return labels[scope] || scope;
  }

  statusActionLabel(staff: StaffOsStaff): string {
    return staff.status === 'archived' || staff.status === 'inactive' ? 'Restore' : 'Archive';
  }

  toggleStaffStatus(staff: StaffOsStaff): void {
    const status = staff.status === 'archived' || staff.status === 'inactive' ? 'active' : 'archived';
    this.staffActionError.set('');
    this.statusChanging.set(staff.id);
    this.store.updateStaffStatus(staff, status)
      .pipe(finalize(() => this.statusChanging.set('')))
      .subscribe({
        next: () => this.store.load(),
        error: (error: { error?: { error?: string; message?: string }; message?: string }) => {
          this.staffActionError.set(error?.error?.error || error?.error?.message || error?.message || 'Unable to update staff status');
        }
      });
  }

  private buildEmployeeDetails(value: Record<string, unknown>): Record<string, unknown> {
    return {
      shortName: value.shortName,
      lastWorkingDate: value.lastWorkingDate,
      anniversaryDate: value.anniversaryDate,
      hideFromRoster: value.hideFromRoster,
      allowSkipOtp: value.allowSkipOtp,
      entryPin: value.entryPin,
      contact: {
        contactPerson: value.contactPerson,
        mobile: value.contactMobile,
        address: value.address,
        addressLine2: value.addressLine2,
        landmark: value.landmark,
        city: value.city,
        pincode: value.pincode,
        state: value.state,
        country: value.country,
        area: value.area,
        phone: value.phone,
        fax: value.fax,
        email: value.contactEmail,
        web: value.web
      },
      emergencyContact: {
        name: value.emergencyContactName,
        mobile: value.emergencyContactMobile,
        phone: value.emergencyContactPhone,
        relation: value.emergencyRelation,
        address: value.emergencyAddress,
        city: value.emergencyCity,
        state: value.emergencyState,
        country: value.emergencyCountry
      },
      nativeContact: {
        name: value.nativeContactName,
        mobile: value.nativeContactMobile,
        phone: value.nativeContactPhone,
        address: value.nativeAddress,
        city: value.nativeCity,
        state: value.nativeState,
        country: value.nativeCountry
      },
      incentive: {
        fixedIncentivePercent: Number(value.fixedIncentivePercent || 0),
        fixedIncentiveAmount: Number(value.fixedIncentiveAmount || 0),
        serviceIncentiveRules: value.serviceIncentiveRules,
        ruleBuilder: this.incentiveRules().map((rule) => ({
          type: rule.type,
          targetId: rule.targetId,
          targetName: rule.targetName,
          calcMode: rule.calcMode,
          value: Number(rule.value || 0),
          minAmount: Number(rule.minAmount || 0),
          notes: rule.notes,
          active: rule.active
        })),
        targetSlabs: this.incentiveSlabs().map((slab, index) => ({
          sNo: index + 1,
          fromAmount: Number(slab.fromAmount || 0),
          toAmount: Number(slab.toAmount || 0),
          incentivePercent: Number(slab.incentivePercent || 0),
          incentiveAmount: Number(slab.incentiveAmount || 0)
        })),
        cycle: value.incentiveCycle,
        validity: {
          startDate: value.incentiveStartDate,
          endDate: value.incentiveEndDate
        },
        capAmount: Number(value.incentiveCapAmount || 0),
        payrollSync: Boolean(value.incentivePayrollSync),
        approval: {
          required: Boolean(value.incentiveRequiresApproval),
          role: value.incentiveApprovalRole,
          payoutStatus: value.incentivePayoutStatus
        },
        attendanceRule: {
          holdAfterAbsentDays: Number(value.incentiveHoldOnAbsentDays || 0),
          reduceAfterLateCount: Number(value.incentiveReduceOnLateCount || 0),
          reductionPercent: Number(value.incentiveReducePercent || 0)
        },
        notes: value.incentiveNotes
      },
      attendanceSalary: {
        weeklyOff: value.weeklyOff,
        empCodeInDevice: value.empCodeInDevice,
        rfidCardNo: value.rfidCardNo,
        attendanceCategory: value.attendanceCategory,
        defaultShift: value.defaultShift,
        devicePrivilege: value.devicePrivilege,
        basicSalary: Number(value.basicSalary || 0),
        paymentMode: value.paymentMode,
        bankName: value.bankName,
        accountNumber: value.accountNumber,
        loanInstallment: Number(value.loanInstallment || 0),
        loanBalance: Number(value.loanBalance || 0),
        otExtraRate: Number(value.otExtraRate || 0),
        lessWorkPenalty: Number(value.lessWorkPenalty || 0),
        supportAttendancePayroll: value.supportAttendancePayroll,
        weeklyOffOvertime: value.weeklyOffOvertime,
        pfApplicable: value.pfApplicable,
        pfNo: value.pfNo,
        ptApplicable: value.ptApplicable,
        ptNo: value.ptNo,
        esicApplicable: value.esicApplicable,
        esicNo: value.esicNo,
        tdsApplicable: value.tdsApplicable,
        panNo: value.panNo,
        aadhaarNo: value.aadhaarNo
      },
      remarks: value.remarks,
      imeiNo: value.imeiNo
    };
  }

  private defaultStaffFormValue(branchId = ''): Record<string, unknown> {
    return {
      branchId,
      firstName: '',
      lastName: '',
      shortName: '',
      employeeCode: '',
      mobile: '',
      email: '',
      enableStaffLogin: false,
      loginId: '',
      loginPassword: '',
      loginRole: 'staff',
      roleId: 'staff',
      staffCategoryId: '',
      employmentType: 'full_time',
      department: '',
      designation: '',
      joiningDate: '',
      lastWorkingDate: '',
      birthDate: '',
      anniversaryDate: '',
      gender: '',
      entryPin: '',
      hideFromRoster: false,
      allowSkipOtp: false,
      skillLicenseNotes: '',
      contactPerson: '',
      contactMobile: '',
      address: '',
      addressLine2: '',
      landmark: '',
      city: '',
      pincode: '',
      state: '',
      country: '',
      area: '',
      phone: '',
      fax: '',
      contactEmail: '',
      web: '',
      emergencyContactName: '',
      emergencyContactMobile: '',
      emergencyContactPhone: '',
      emergencyRelation: '',
      emergencyAddress: '',
      emergencyCity: '',
      emergencyState: '',
      emergencyCountry: '',
      nativeContactName: '',
      nativeContactMobile: '',
      nativeContactPhone: '',
      nativeAddress: '',
      nativeCity: '',
      nativeState: '',
      nativeCountry: '',
      fixedIncentivePercent: 0,
      fixedIncentiveAmount: 0,
      serviceIncentiveRules: '',
      incentiveNotes: '',
      incentiveCycle: 'monthly',
      incentiveStartDate: '',
      incentiveEndDate: '',
      incentiveCapAmount: 0,
      incentivePayrollSync: true,
      incentiveRequiresApproval: true,
      incentiveApprovalRole: 'manager',
      incentiveHoldOnAbsentDays: 2,
      incentiveReduceOnLateCount: 3,
      incentiveReducePercent: 10,
      incentivePayoutStatus: 'draft',
      weeklyOff: '',
      empCodeInDevice: '',
      rfidCardNo: '',
      attendanceCategory: '',
      defaultShift: '',
      devicePrivilege: 'user',
      basicSalary: 0,
      paymentMode: '',
      bankName: '',
      accountNumber: '',
      loanInstallment: 0,
      loanBalance: 0,
      otExtraRate: 0,
      lessWorkPenalty: 0,
      supportAttendancePayroll: false,
      weeklyOffOvertime: false,
      pfApplicable: false,
      pfNo: '',
      ptApplicable: false,
      ptNo: '',
      esicApplicable: false,
      esicNo: '',
      tdsApplicable: false,
      panNo: '',
      aadhaarNo: '',
      remarks: '',
      imeiNo: ''
    };
  }
}
