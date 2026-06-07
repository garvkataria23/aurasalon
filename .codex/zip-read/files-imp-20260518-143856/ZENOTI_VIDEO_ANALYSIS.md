# Zenoti Employee & Guest Management — Complete Feature Analysis

> **Source:** Video walkthrough (~5min 20sec) of Zenoti Demo - Hyderabad instance
> **Analysis method:** 33 frame extraction at 10-sec intervals + visual inspection
> **Date analyzed:** May 18, 2026

---

## Video summary

Video shows full walkthrough of two enterprise modules in Zenoti:
- **Part 1 (0:00 – 3:10):** Employee Management module
- **Part 2 (3:20 – 5:20):** Guest Management module

User logged in as "KR" admin at "Zenoti Demo - Hyderabad" branch. Total visible scope: 24 active employees, 270 guests.

---

# PART 1 — Employee Management (in-depth)

## 1.1 Employee List Page

**URL:** `/ListingPages/EmployeeDetailsV2.aspx`
**Title:** "Manage employees"

### Layout
- **Toolbar:** "Jobs" dropdown, "Status (1)" filter, "Filters" button, **Search employees** input, **Add** button
- **Status indicator:** "Status: Active" filter chip with X to remove
- **Results counter:** "24 Results"
- **Action icons (top right):** Export, Import, Column settings

### Table columns
| Column | Type | Example |
|---|---|---|
| Code | Text (employee code) | Emp-Hyd-019, HYD939, 214 |
| First name | Link (clickable to detail) | AKSHAYA, Alifia, Andy |
| Last name | Text | Sonawane, Sharma, Steward |
| Phone number | Text with formatting | (345) 983-4112 |
| Job | Text | THERAPIST, Stylist, Instructor, MANAGER, OWNER, Hair Stylist, Aesthetics |
| Active | Yes/No | Yes |
| Center | Text | Hyderabad |

### Notable patterns
- **Code prefix system:** Multiple formats exist (Emp-Hyd-XXX, HYD939, HYD1828, YM, 214) — no enforced format
- **Job titles uppercase** for some, mixed case for others
- **First name only is clickable** — surprising UX choice (vs whole row clickable)
- **Hover tooltip on names** shows the full first name (seen on "Jarif")

---

## 1.2 Edit Employee — General Tab

**URL:** `/Admin/Employees/Employee.aspx?UserId={guid}&IsConsulta...`
**Breadcrumb:** `Employee > Manage Employees > Jayant Kamle`
**Status badge:** "Active" (green)

### Tab navigation (10 tabs)
1. **GENERAL** (default)
2. **EMPLOYEE ROLES**
3. **SERVICES**
4. **PRODUCTS**
5. **MEMBERSHIPS**
6. **PACKAGES**
7. **COMMISSIONS**
8. **PAYRATES**
9. **CATALOG**
10. **LEAVE POLICIES**

### Action buttons (right rail — sticky)
- **Clone** (blue) — duplicate employee for fast creation
- **Update Password** (blue)
- **Reset Password** (blue)
- **Terminate** (red) — separates termination from deactivation
- **Back To Search** (outlined blue)
- Help link: "Need help? visit help.zenoti.com"

### Personal info fields (General tab)
| Field | Type | Required |
|---|---|---|
| Employee Code | Text | ✓ |
| First Name | Text | ✓ |
| Middle Name | Text | — |
| Last Name | Text | ✓ |
| Nickname | Text | — |
| Name (Appointment emails/messages) | Text | — |
| Email | Email | ✓ |
| Mobile Phone | Phone with country flag (🇺🇸 +1) | — |
| Home Phone | Phone | — |
| Work Phone | Phone | — |

**Key UX details:**
- Country code selector with flag emoji
- Pre-filled "Name (Appointment emails/messages)" — separate from legal name (so messages can use casual name)
- All fields have asterisks for required

---

## 1.3 Edit Employee — Employee Roles Tab

**Critical enterprise feature** — one employee can hold **multiple roles** at **multiple centers**.

### Form structure
- **MAP EMPLOYEE TO APPROPRIATE ROLE(s)** section
- View dropdown: **Center** / Org level
- Center dropdown: Hyderabad / etc.
- Role dropdown: Accountant / Manager / Therapist / etc.
- **Add Role** button

### Defined Roles table
| Column | Example |
|---|---|
| View | Hyderabad |
| Type | Center |
| Role | Manager / Therapist |

- Checkbox column for bulk **Delete**
- "View 1-2 of 2" pagination
- **Cancel** button

**Why this matters:** Salon owners with multi-branch setups need staff who can wear multiple hats. Same person can be **Manager at Bandra** + **Therapist at Andheri**. Most CRMs (including Aura currently) don't support this.

---

## 1.4 Edit Employee — Services Tab

Granular service-level configuration per employee. This is **THE most powerful feature** in Zenoti's employee module.

### Top alert banner
> "To ensure that services are performed only by the assigned employee, please select the 'Service Assignment' checkbox for the employee at the service level. Note that if no association or selection is made at the category/subcategory level, the service can be performed by any employee."

### Center scope dropdown
"Current Center" filter — affects which services display

### Table structure
| Column | Type | Purpose |
|---|---|---|
| Name | Text (hierarchical) | Service / Category name with expand chevron |
| Shop Cost | Number | Cost overhead for this employee performing this service |
| Labour Cost | Number | Labour component |
| Commission | Percentage | Per-service commission % (e.g. 10%) |
| Price Scaling Factor % | Number | Adjusts price (premium stylist charges more) |
| Service Time | Time | Custom duration per employee |
| Commission Deductions | Number | Specific deductions |
| **Service Assignment** | Checkbox | Master toggle — can this employee perform this service |
| **Available Online** | Checkbox | Show this employee for online booking of this service |

### Service categories (visible)
- Add On
- Body Services
- Consultation
- Cryo
- Eyes
- Facial
- (more — scrollable list)

### Why this is genius
- **Different employees can have different prices for the same service** (senior stylist premium)
- **Service Assignment** ensures only qualified staff can be booked
- **Available Online** lets you hide an employee from online booking but keep them for walk-ins
- **Custom service time per employee** — a senior therapist might finish facials in 45 min vs trainee's 60 min
- **Hierarchical expansion** keeps the UI manageable across 100+ services

---

## 1.5 Edit Employee — Commissions Tab

### Top fields
- "Default commission scaling factor" — 100%
- "Booking commission scaling factor" — 100%

### Behaviour text
- "If a slab is deleted, choose how past pay periods should be calculated"
- Radio options:
  - "Use slabs active in the pay period for past pay periods (Default)" (selected)
  - "Use existing slabs for past pay periods"
- Explanatory note: "Once deleted, For current and future pay period calculations performed after slab deletion, the system will always use only the active slabs at either the employee or job level."

### Service commission
- "Use default configuration (Cumulative commission level)" (radio selected)
- "Highest Qualified Commission" alternative
- **Revenue Range (₹)** + **Commission %** slabs — Add button
  - Example: ₹0.00 to ₹99.99, Commission %, Add

### Why this is brilliant
- **Tiered slab commissions** — staff get higher % as they earn more
- **Two modes:**
  - **Cumulative** — each slab applies to its range
  - **Highest qualified** — once you hit a slab, that % applies to total
- **Versioned slabs** — changing slabs doesn't retroactively rewrite past payroll (huge audit/compliance feature)

---

## 1.6 Employee Sidebar Navigation

When expanded (frame 9 captured this):

### Employee submenu
1. **Dashboard** — employee module overview
2. **Employees** — list (current page)
3. **Schedule** — shift planning
4. **Check In** — clock in/out
5. **Jobs** — job titles and definitions
6. **Deputation** — temporary cross-branch deployment ⭐ (rare feature)
7. **Attendance** — attendance summary
8. **Payroll** — payroll runs
9. **Zenoti Integrated Payroll** ⭐ — separate integrated payroll engine

**Sidebar icons (left rail, narrow):**
- Search/explore
- Home/dashboard
- Employee (tree icon) — active
- Customers/People
- Discounts/offers
- Calendar
- Reports/analytics
- Tasks
- Catalog
- Inventory
- Settings
- "..." overflow

---

## 1.7 Employee Schedule — Week View

**URL:** `/Admin/Employees/EmployeeSchedule.aspx?View=Week&date=03-11-2025`

### Layout
- **Page title:** "Employee Schedule"
- **Copy button** (top-left)
- **Date range navigator:** `< Nov 02 - Nov 08 >` with calendar picker
- **Save button** (top-right, disabled until changes)

### Grid structure
- **Column 1:** Employee name + hours summary (e.g. "AKSHAYA S — 56.00 Hrs", "Alifia S — 15.00 Hrs")
- **Bulk checkbox** for multi-select
- **Columns 2-8:** Days of the week (Sun-Sat) with date

### Cell states (color-coded)
| State | Color | Text |
|---|---|---|
| Scheduled | Green pill | "10:00 AM - 6:00 PM" |
| Not scheduled | Light gray pill | "Not Scheduled" |
| Different time | Green | "7:00 AM - 10:00 PM" |

- Click cell → edit shift
- Drag/copy supported (Copy button at top)

---

## 1.8 Employee Schedule — Day View

**URL:** `/Admin/Employees/EmpSchedule.aspx`

### Filters (4 dropdowns)
1. **Center** — All
2. **Role** — All
3. **Job** — All
4. **Employee** — Select

### View toggle
**DAY** (selected) / WEEK / MONTH

### Action buttons
- **Copy schedule** — duplicate from previous day/week
- **Update bulk status** — set multiple employees' status at once

### Date selector
`< Monday, Nov 03 >` with calendar icon

### Per-employee row
| Column | Purpose |
|---|---|
| Checkbox | Bulk action select |
| Employees | Name |
| **SHIFT 1** | Start time + End time (To...) |
| **SHIFT 2** | Start time + End time (To...) — **split shifts supported!** |
| Status | Dropdown: Working / Not Set / etc |
| Notes | Edit icon |

**Time pickers:** Hour / Minutes / AM-PM (granular control)

**Critical insight:** Zenoti supports **dual shifts per day per employee** — important for Indian salons where staff often do morning 10am-2pm then evening 5pm-9pm.

---

## 1.9 Employee Attendance Summary

**URL:** `/Admin/Employees/EmployeeAttendanceSummary.aspx`
**Breadcrumb:** `Employee > Attendance Summary`

### Filters
- Cycle: **Monthly** dropdown
- Month: Sep
- Year: 2025
- **Refresh** button

### Columns (very detailed payroll-grade)
| Column | Purpose |
|---|---|
| Name | Employee name |
| Code | Employee code |
| **Salary** | Base salary |
| **Working Days** | Days worked |
| **Leave Balance** | Available leaves |
| **Spl Leave Balance** | Special leave (maternity/paternity/etc) |
| **Leave Availed** | Leaves taken this period |
| **Special Leave Availed** | Special leave taken |
| **Penalty** | Deductions |
| **Leaves Accrued** | New leaves earned this period |
| **Weekly Off Adjustment** | Weekend pay adjustments |
| **Spl Leave Adjustment** | Manual special leave adjustments |
| **Revised Leave Balance** | After all adjustments |
| **Revised Spl Leave Balance** | Special leave after adjustments |
| **Comments** | Manager notes |

### Action buttons
- **Recalculate** (blue) — re-run calculations
- **Save** (blue)
- **Cancel** (outlined)

### Export options
3 icons (top right): likely Excel, PDF, CSV export

**Indian payroll context:** This page handles **leave accrual + statutory leave (maternity etc) + adjustments**. Comments field critical for audit trail of manual overrides.

---

## 1.10 Reports — Employee Payroll

**URL:** `/Admin/Reports/ReportData.aspx?Report=payroll_summary&report_title=Employee%20Payroll`

### Page elements
- **"Switch to classic payroll report"** link — old version still accessible (smart UX)
- Period: **(Oct 01, 2025 - Oct 31, 2025)** in title
- View dropdown: **Summary** (vs Detail)
- Tab: **Default View** (saved view system)

### Filters
- Cycles: Monthly
- Month: Oct
- Year: 2025
- **Refresh** button
- **Recalculate Commissions Now** button (orange/prominent)

### Status banner (green)
> "Report was last calculated on 20-10-2025 10:55:33 AM."

### Drag-to-group
> "Drag here to set row groups" — **pivot-table style group-by drag zone** ⭐

### Columns
| Column | Type |
|---|---|
| Employee Code | Text |
| First Name | Text |
| Last Name | Text |
| Job | Text |
| **Invoice Wise Details** | Download button (per row) |
| **Employee Wise Details** | Download button (per row) |
| Salary | Currency |
| Total Hours | Number |
| **Work Task Wise Details** | Download button (per row) |
| Total Hourly Pay | Currency |

### Row data examples
- Emp-Hyd-019 AKSHAYA Sonawane THERAPIST — Salary ₹40,000 — 0 hrs
- Emp-Hyd-015 Alifia Sharma Stylist — Salary ₹35,000 — 10.45 hrs
- Emp-Hyd-011 Franklin Tirlotkar Aesthetics — Salary ₹20,000
- Emp-Hyd-009 Jayant Kamle THERAPIST — Salary ₹40,000

### Footer
- **Total: ₹6,15,000** (Salary column total)
- Page 1 of 2 / 1 to 20 of 24
- **Definitions** floating tab (right side) — explains each column

### Top right icons
- Refresh (curved arrow)
- Column visibility settings
- Export
- Help/info

---

# PART 2 — Guest Management (in-depth)

## 2.1 Guest List Page

**URL:** `/ListingPages/GuestV2.aspx`
**Title:** "Manage guests"

### Toolbar
- **Search** input with placeholder
- **Add new** button (top-right)
- **Reset** link (when search is active)
- Search chips: "Search : Urshitha" (X to remove)

### Counter
"3 Results" (when searching) or "Showing 1-20 of 270" (default)

### Pagination
- 20 results per page (configurable)
- "Page 1 of 14"
- First/Prev/Next/Last buttons

### Top right icons
- Export
- Column settings
- Overflow menu (3 dots)

### Table columns
| Column | Type | Example |
|---|---|---|
| Code | Text | HYD002, HYD006, HYD045 |
| First name | Link (clickable) | Urshitha, Aditya, Amit |
| Last name | Text | Ramesh, Barve |
| Phone no. | Masked | (xxx) xxx-7890 |
| Last visit | Date | 11-01-2024 |
| Membership | Text/truncated | "Annual 10% Discount M..." "Freedom Credit Membe..." |
| **Categories** | Icons (3-4 visible per guest) | 👤👤 🔵 🔴 (avatar variants) |
| Center | Text | Hyderabad |

### Category icons (the key UX innovation)
At-a-glance visual indicators per guest:
- **Silhouette icon (red/orange)** — VIP / Premium / High spender
- **G1 circle (blue/teal)** — Loyalty tier 1
- **Red dot (filled)** — Alert / Note flag attached
- **Yellow star** — Favourite / Starred
- **Avatar icon variants** — Member type

**Mobile-first detail:** This category icon row replaces what would normally be 4-5 separate columns — saves horizontal space.

---

## 2.2 Edit Guest — Overview Tab

**URL:** `/Guests/GuestProfileV2/GuestProfileV2.aspx?UserId={guid}`
**Title:** "Edit Guest"
**Breadcrumb:** `Loyalty > Manage Guests >` (note: Guest Management is under "Loyalty" parent!)

### Top action area
- 5 status badges (small icons in row)
- **New** button with dropdown (create new appointment, invoice, etc.)
- **3-dot overflow menu**

### Tab navigation (6 visible + "More (19)" dropdown = **25 tabs total!**)
**Always visible:**
1. **Overview** (default)
2. **Profile**
3. **Notes**
4. **Appointment**
5. **Form Records**
6. **Gallery**
7. **Products**
8. **Packages**

**In "More (19)" dropdown:**
9. Memberships
10. Referral History
11. Wallet
12. Issues
13. Loyalty Points
14. Coupons
15. Payments
16. Notifications
17. Guest Pass
18. Adjustments
19. Campaigns
20. Quotes
21. **Medical Record** ⭐

---

## 2.3 Overview Tab — Left Panel (guest snapshot)

### Profile card
- **Avatar circle:** "UR" (initials) — purple background
- **Name:** Urshitha Ramesh
- **Phone:** xxxxx0000
- **Email:** xxxxxxxhar@zen.com (masked for privacy)

### Status chips (under name)
- **🟢 "High Spender"** (green)
- **🟢 "Packages"** (green with package icon)
- **⚠️ "Du..."** (truncated — likely "Due") (red)
- **+3** (more chips overflow)

### Loyalty
- **Points: 0.00 / ₹0.00** (current points / cash equivalent)

### Period filter
- "Last 1 Month" dropdown (Last 1 Month / 3 Months / 6 Months / Year / All Time / Custom)

### KPI tiles (2×2 grid)
| KPI | Value |
|---|---|
| **Total visits** | 3 |
| **Total open Appointments** | 2 |
| **Amount due** | ₹477.90 |
| **Current membership balance** | ₹0.00 |

---

## 2.4 Overview Tab — Right Panel

### Packages section
Each package shown as a card:

**Card 1: Hair Trichology Package**
- Price: ₹23,600.00
- Expiration: "Calculates at first redemption"
- **4 Services Available** — Hair Loss Treatment (4 Available)
- Empty state: "No products available for this package"

**Card 2: SR_OfferPackage_Hyderabad**
- Price: ₹16,800.00
- Expiration: 24/6/2026
- **2 Services Available** — Ayurvedic Massages (0 Available), Hair Styling (1 Available)
- **1 Products Available** — Shampoo (1 Available)

**More** link top-right to see all packages

### Memberships section
**Card 1: All Inclusive Annual - Dessange**
- Enrollment Date: 4 Jun 2025
- Services: Massages (11 Available), Cryo (11 Available), **+1 more**

**Card 2: Annual 10% Discount Membership**
- Enrollment Date: 4 May 2025
- Empty: "No services available for this membership"

---

## 2.5 Profile Tab

### Top section
- **Referral** source dropdown (where did this guest come from)
- **Primary Provider** dropdown (preferred therapist)
- **Referral code:** `Urshitha3120` (auto-generated, unique per guest)
- Checkbox: **"Block edit guest custom data"** (lock down record from staff edits)

### Contact info section
- Address (Street address)
- Apartment, suite, unit etc.
- City, Zip Code, State
- State (Other) — for non-standard
- Country or Territory: India (default)
- Nationality

### Login info
(Cut off in frame — visible heading)

### Action buttons (bottom)
- **Print** (outlined)
- **Save** (blue, primary)

---

## 2.6 Notes Tab

### Header
- "Notes" title
- Filter dropdown: **All** (filter by note type)
- **+ Note** button (blue, primary)

### Note structure (each note is a card)
| Field | Content |
|---|---|
| **Title** | "Enquired about gifting options" |
| Created | "9/10/2025 01:27 pm" |
| **Note Type** | "Payment alert" / "Check-in alert" / "None" |
| Created by | Avatar + Name (Sirisha Rao Rambhatla) or "Auto Generated" |
| Center | "Hyderabad" |
| Actions | Edit (pencil) / Delete (trash) icons |

### Note types observed
1. **Payment alert** — shows on payment screens
2. **Check-in alert** — shows when guest checks in
3. **None** — plain note for staff reference
4. **Auto Generated** — system notes ("Multiple guests found while booking. Please check if this guest can be merged.")

### Auto-merge intelligence
Zenoti automatically detects potential duplicate guests during booking and adds a system note for manual review.

---

## 2.7 Appointment Tab

### Collapsible sections
- **Upcoming Appointments** (expandable, with "Open" filter)
- **Past Appointments** (expandable, with "All" filter)

### Action icons per section (top-right)
- Calendar icon (view on calendar)
- Print icon
- Export icon
- Filter dropdown

### Past appointments table
| Column | Type | Example |
|---|---|---|
| **Invoice no** | Link | RHyd15759 (clickable, opens invoice) |
| Date | Date | 16/10/2025 |
| Services | Text | Gel Manicure |
| **Status** | Badge | OPEN (green) / CLOSED (gray) / DELETED (red) |
| Price | Currency | ₹477.90 |
| Provider | Avatar + Name | "Jayant Kamle" with circular avatar |

### Per-row actions (right side)
- 3-dot menu
- Expand toggle

### Status semantics
- **OPEN** — invoice not yet finalized (services done, payment pending)
- **CLOSED** — fully paid and closed
- **DELETED** — voided

---

## 2.8 Form Records Tab

### Header
- **Medical Record [NEW]** button (orange, prominent — new feature)
- **Expand All** button
- Search & Filter icons

### Collapsible sections
- Upcoming Appointment
- Past Appointment

### Table columns
| Column | Example |
|---|---|
| Service | Gel Manicure / Aromatherapy Massage 45 / Basic Manicure |
| **Form status** | "0/2" or "1/2" — forms completed out of required |
| Date | 16/10/2025 02:45 pm |
| **Appointment status** | OPEN / CLOSED badge |
| Actions | Eye (view) / 3-dot menu / Expand toggle |

### Why this matters
- **Different services require different consent/intake forms**
- "0/2" = 2 required forms, 0 filled
- Click eye → view filled forms
- **Medical Record** is a new compliance feature (probably for clinical/aesthetic procedures)

---

## 2.9 More (19) Dropdown — Full menu

When "More" clicked, dropdown lists:

### Loyalty & Rewards
- **Referral History** — who they referred, who referred them
- **Loyalty Points** — points balance & history
- **Coupons** — coupons issued to this guest
- **Guest Pass** — premium passes (gym-like access)
- **Campaigns** — marketing campaigns this guest is in

### Financial
- **Wallet** — wallet balance & transactions
- **Payments** — payment history
- **Adjustments** — manual corrections
- **Quotes** — price quotes given but not yet purchased

### Operational
- **Issues** — complaints / support tickets
- **Notifications** — communication log (SMS/email/WhatsApp)
- **Medical Record** — clinical history (NEW)

---

# Aura — Gap Analysis & Implementation Recommendations

## Employee Management — Aura vs Zenoti

| Feature | Zenoti | Aura status (current) |
|---|---|---|
| Employee list with filters | ✅ Status, Job, custom filters | ⚠️ Basic list |
| **Multi-role per employee** | ✅ Multiple roles at multiple centers | ❌ Single role |
| **Per-service custom pricing** | ✅ Price scaling factor | ❌ Flat service price |
| **Per-service custom duration** | ✅ | ❌ |
| **Service Assignment toggle** | ✅ Restricts who can perform | ⚠️ Partial |
| **Available Online toggle** | ✅ Hide from online booking | ❌ |
| **Tiered commission slabs** | ✅ Revenue-range based | ❌ Flat % |
| **Commission slab versioning** | ✅ Historical accuracy | ❌ |
| **Dual-shift scheduling** | ✅ Shift 1 + Shift 2 | ❌ |
| Week/Day/Month schedule | ✅ All 3 views | ⚠️ Day only |
| **Copy schedule** | ✅ One-click duplicate | ❌ |
| **Bulk shift update** | ✅ Multi-select + status change | ❌ |
| **Attendance with leave types** | ✅ Regular + Special leave | ⚠️ Basic |
| **Leave accrual** | ✅ Automatic | ❌ |
| **Recalculate commissions** | ✅ One-button | ❌ |
| **Drag-to-group payroll report** | ✅ Pivot-table UI | ❌ |
| **Invoice/Employee/Task drill-down** | ✅ Per-row download | ❌ |
| **Integrated Payroll** | ✅ Built-in | ❌ |
| **Deputation (cross-branch)** | ✅ | ❌ |

## Guest Management — Aura vs Zenoti

| Feature | Zenoti | Aura status |
|---|---|---|
| Guest list with category icons | ✅ At-a-glance visual | ❌ Text columns |
| **25-tab guest profile** | ✅ Massive depth | ⚠️ ~6 tabs |
| Status chip overview | ✅ High Spender / Due / Packages | ⚠️ Basic |
| KPI tiles with date filter | ✅ Last 1 Month / 3 / 6 / Year / All / Custom | ❌ |
| Packages with services breakdown | ✅ "X Available" counters | ⚠️ Partial |
| Memberships with services breakdown | ✅ | ⚠️ Partial |
| **Note types (Payment/Check-in alerts)** | ✅ Context-aware notes | ❌ Plain notes |
| **Auto-generated system notes** | ✅ Duplicate detection | ❌ |
| **Form records per service** | ✅ "0/2" tracking | ❌ |
| Auto **referral code generation** | ✅ "Urshitha3120" format | ✅ (We just built this!) |
| Multi-status invoice (Open/Closed/Deleted) | ✅ | ⚠️ Partial |
| **Medical Record module** | ✅ NEW | ❌ |
| Coupons / Guest Pass / Quotes | ✅ | ❌ |
| Wallet with transaction history | ✅ | ⚠️ Balance only |
| Notification log per guest | ✅ All channels (SMS/email/WA) | ⚠️ WhatsApp only |
| **Block edit (data lock)** | ✅ Per-guest | ❌ |

---

## Recommended priorities for Aura

### 🔴 P0 — Critical (build now)

1. **Multi-role employee** (Employee Roles tab)
   - One employee → multiple roles → multiple branches
   - Already proposed in our Codex prompt; bump to P0

2. **Per-service custom pricing & duration per employee**
   - Premium stylist auto-charges 20% more
   - Different staff have different speeds

3. **Service Assignment + Available Online flags**
   - Critical for online booking quality
   - Prevents under-trained staff being booked

4. **Tiered commission slabs**
   - Indian salons love this — staff motivation
   - Versioned (don't rewrite past payroll)

5. **Dual-shift scheduling**
   - 50% of Indian salon staff do split shifts
   - Current Aura schedule needs upgrade

### 🟠 P1 — Important (next sprint)

6. **Guest profile re-architecture**
   - Tab-based (Overview, Profile, Notes, Appointments, Forms, Gallery, Products, Packages + More dropdown)
   - 25 tabs is overkill but 12-15 is right

7. **Note types (Payment alert / Check-in alert / Plain)**
   - Surfaces important info at right moment

8. **Form records per service**
   - "0/2 forms filled" badge
   - Consent management for aesthetic procedures

9. **Category icons in guest list**
   - Visual chip row instead of text columns
   - VIP / Member / Risk / Note-flag

10. **Leave accrual + Special leave**
    - Indian statutory requirement (maternity etc)

### 🟡 P2 — Differentiation (3-6 months)

11. **Recalculate commissions on demand** (button)
12. **Drag-to-group payroll pivot table**
13. **Per-row drill-down exports** (Invoice/Employee/Task)
14. **Medical Record module** (clinical procedures)
15. **Auto guest-merge detection** with system notes
16. **Deputation** (cross-branch temporary assignment)

---

## What Aura should NOT copy from Zenoti

These exist in Zenoti but are anti-patterns:

1. **25 tabs in guest profile** — overwhelming. Use 8 visible + "More" dropdown like Zenoti, but limit More to 5-7 items
2. **Multiple guest list columns** showing categories as text — Zenoti themselves use icons here; copy that
3. **"Classic payroll report" toggle** — symptom of unfinished migration
4. **Old `.aspx` URLs everywhere** — Aura is modern Angular, leverage that
5. **No keyboard shortcuts** — major omission Aura can win on with Cmd+K

---

## Visual / UI patterns to steal

### From Employee module
- **Sticky right-rail action buttons** (Clone, Update Password, Reset Password, Terminate, Back To Search)
- **Hierarchical service table with expand chevrons**
- **Color-coded shift cells** (green = scheduled, gray = empty)
- **Recalculate button** (orange, prominent) on reports
- **"Switch to classic" link** for legacy users during migration

### From Guest module
- **Category icon row** (instead of text columns)
- **Avatar with initials + colored background** (Zenoti uses purple "UR" for Urshitha)
- **KPI tiles in profile** (visits, appointments, due, balance)
- **Period filter on KPIs** (Last 1 Month / 3 / 6 / Year / Custom)
- **Status chips under name** (High Spender, Packages, Due)
- **Package/Membership cards** with services breakdown ("X Available")
- **Empty state messages** ("No products available for this package")
- **"More (19)"** dropdown for overflow tabs

---

## Final assessment

**Zenoti is genuinely deep on enterprise features** — multi-role staff, granular per-service per-employee configuration, tiered commissions with versioning, integrated payroll. Most salon CRMs in India don't come close.

**But Zenoti's UI is dated** — `.aspx` URLs, "switch to classic" toggles, text-heavy tables, 25-tab guest profiles. Aura can leverage **modern Angular + signals + Cmd+K + clean component library** to deliver Zenoti's depth with a **2026-grade UX**.

**Indian salon market positioning:**
- Zenoti targets enterprise chains (Lakme, Bblunt, VLCC, Naturals)
- Aura should target **growing mid-size chains (3-15 branches)** — the segment that finds Zenoti too expensive and too complex
- Aura's edge: **Zenoti's features at 1/5 the price, with modern UX**

Build the P0 list. Skip the P2 dead-weight. Stop overthinking — the gap is execution speed, not feature spec.
