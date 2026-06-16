import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { catchError, firstValueFrom, of } from 'rxjs';
import { ApiService } from '../core/api.service';

type Section = { code: string; name: string; accountSubType: string; balance: number };
type BalanceSheet = {
  asOfDate: string;
  productionReady: boolean;
  productionReadinessReason: string;
  balanced: boolean;
  totals: { assets: number; liabilities: number; equity: number; accountingEquationDifference: number };
  sections: Record<'assets' | 'liabilities' | 'equity', Section[]>;
  workingCapital: { currentAssets: number; currentLiabilities: number; workingCapital: number; currentRatio: number | null; quickRatio: number | null; cashRatio: number | null; cashRunwayDays: number | null };
  alerts: Array<{ severity: string; title: string; message: string }>;
};
type TrialBalance = { balanced: boolean; debitTotal: number; creditTotal: number; difference: number; rows: Array<{ accountId: string; code: string; name: string; accountType: string; debit: number; credit: number; balance: number }> };
type HardeningStatus = { productionReady: boolean; productionReadinessReason: string; stages: Array<{ stage: number; label: string; done: boolean; healthy: boolean; note: string }>; latestReconciliation: { asOfDate: string; status: string; checks: Array<{ key: string; label: string; ok: boolean; severity: string; detail: string }> } | null };
type CostCenterPnl = { fromDate: string; toDate: string; costCenters: Array<{ code: string; name: string; type: string; income: number; expense: number; netProfit: number }> };
type DeferredList = { deferredLiability: number; schedules: Array<{ id: string; sourceType: string; sourceId: string; customerId: string; total: number; recognized: number; deferredBalance: number; method: string; periods: number; startDate: string; status: string }> };
type AssetRegister = { grossBlock: number; accumulatedDepreciation: number; netBlock: number; assets: Array<{ code: string; name: string; category: string; method: string; cost: number; accumulatedDepreciation: number; netBookValue: number; status: string }> };
type CostStructure = { fromDate: string; toDate: string; revenue: number; variableCost: number; fixedCost: number; salaryCost: number; contributionMargin: number; contributionMarginRatioPct: number; salaryToRevenuePct: number | null; breakEvenRevenue: number | null; breakEvenClients: number | null; netProfit: number; marginOfSafetyPct: number | null; lines: Array<{ code: string; name: string; behavior: string; category: string; amount: number }> };
type DailyOperations = { businessDate: string; invoiceCount: number; sales: number; paid: number; discount: number; gst: number; productConsumption: number; dailyRent: number; salary: number; commission: number; directCost: number; netAfterTrackedCost: number; staff: Array<{ staffId: string; name: string; role: string; attendance: string; minutesWorked: number; revenue: number; dailySalary: number; commission: number; totalStaffCost: number; netContribution: number }>; products: Array<{ sku: string; qty: number; cost: number }> };
type FinanceOs = {
  asOfDate: string;
  month: string;
  outgoingImpact: { total: number; cash: number; bank: number; profitAfterOutgoing: number; recent: Array<{ id: string; entryNo: string; category: string; payee: string; mode: string; amount: number; status: string }> };
  todayTimeline: Array<{ at: string; type: string; title: string; amount: number }>;
  ownerDailyClose: { ready: boolean; warnings: number; checklist: Array<{ key: string; label: string; done: boolean }> };
  cashBankReconciliation: { cashCollection: number; bankCollection: number; cashOutgoing: number; bankOutgoing: number; expectedCash: number; expectedBankNet: number; paymentRows: number; outgoingRows: number };
  expenseCategoryProfit: Array<{ category: string; amount: number; netAfterCategory: number; sources: string[] }>;
  branchWiseBalanceSheet: Array<{ branchId: string; branchName: string; cash: number; receivable: number; payable: number; stock: number; profit: number }>;
  invoiceDrilldown: Array<{ invoiceId: string; invoiceNumber: string; revenue: number; gst: number; glStatus: string }>;
  gstPayableControl: { todayCollected: number; monthEstimate: number; postedOrQueued: number; payablePaise: number };
  livePosToGl: { posSales: number; glRevenue: number; difference: number; outboxPending: number; outboxFailed: number; outboxPosted: number };
  dailyProfit: { sales: number; gst: number; discount: number; salary: number; commission: number; rent: number; productConsumption: number; netAfterTrackedCost: number };
  staffProfitability: DailyOperations['staff'];
  serviceMargins: Array<{ name: string; type: string; count: number; revenue: number; productCost: number; staffCommission: number; margin: number; marginPct: number }>;
  inventoryConsumption: { total: number; products: DailyOperations['products']; wmaInventory: number; glInventory: number; difference: number };
  fixedCostAllocation: { dailyRent: number; dailySalary: number; fixedCostMonth: number; salaryCostMonth: number };
  journalSuggestions: Array<{ severity: string; title: string; text: string; action: string }>;
  reconciliation: { posVsGlRevenueDifference: number; inventoryDifference: number; balanced: boolean; accountingEquationDifference: number };
  copilotPrompts: string[];
  monthEndClose: { month: string; checklist: Array<{ key: string; label: string; done: boolean; amount: number }> };
};
type PosGlSyncResult = { fromDate: string; toDate: string; scanned: number; enqueued: number; duplicate: number; skipped: number };
type CopilotAnswer = { question: string; answer: string; actions: string[]; asOfDate: string; reportVersion: string };
type InventoryCogsSyncResult = { fromDate: string; toDate: string; scanned: number; enqueued: number; duplicate: number; skipped: number; cogs: number };
type DailyAccrualResult = { businessDate: string; posted: number; entries: Array<{ key: string; memo: string; amount: number; journalEntryId: string }> };
type MonthCloseAutomationResult = { period: string; fromDate: string; toDate: string; posToGl: PosGlSyncResult; inventoryCogs: InventoryCogsSyncResult; accruals: DailyAccrualResult; snapshotId: string; nextSteps: string[] };
type OwnerDailyCloseResult = { asOfDate: string; ready: boolean; warnings: number; posToGl: PosGlSyncResult; cogs: InventoryCogsSyncResult; accruals: DailyAccrualResult };
type DrillNode = { id: string; label: string; type: 'root' | 'group' | 'ledger' | 'voucher'; amount: number; level: number; children?: DrillNode[] };
type GraphPoint = { label: string; revenue: number; profit: number; cash: number };
type ForecastPoint = { month: string; assets: number; liabilities: number; netWorth: number; expectedInflow: number; expectedOutflow: number; closingCash: number };
type AiInsight = { severity: 'ok' | 'warn' | 'critical'; title: string; text: string; action: string };

type LedgerSide = 'asset' | 'liability' | 'capital' | 'income' | 'expense' | 'unknown';
type LedgerGroupingSuggestion = { group: string; side: LedgerSide; hint: string; confidence: number; source: 'exact' | 'smart' | 'review' };

export const TALLY_STYLE_GROUPS = [
  'Capital Account', 'Fixed Asset', 'Current Asset', 'Bank Account', 'Cash In Hand',
  'Sundry Debtors', 'Sundry Creditors', 'Current Liabilities', 'Secured Loans',
  'Loan Liabilities', 'Bank OD', 'Indirect Expenses', 'Indirect Income',
  'Sales Account', 'Purchase Account', 'Stock In Hand', 'Investments', 'Deposits',
  'Direct Expenses', 'Suspense / Review Required'
] as const;

export const LEDGER_GROUPING: Record<string, LedgerGroupingSuggestion> = {
  'opening stock': { group: 'Stock In Hand', side: 'asset', hint: 'Opening inventory / stock balance', confidence: 100, source: 'exact' },
  'purchase': { group: 'Purchase Account', side: 'expense', hint: 'Direct purchase ledger. No purchase screen is added; only grouping suggestion.', confidence: 100, source: 'exact' },
  'purchase return': { group: 'Purchase Account', side: 'expense', hint: 'Return outward adjustment. No purchase screen is added.', confidence: 100, source: 'exact' },
  'freight charges': { group: 'Direct Expenses', side: 'expense', hint: 'Direct cost on purchase/production', confidence: 100, source: 'exact' },
  'carriage inward': { group: 'Direct Expenses', side: 'expense', hint: 'Direct purchase expense', confidence: 100, source: 'exact' },
  'carriage outward': { group: 'Indirect Expenses', side: 'expense', hint: 'Selling/distribution expense', confidence: 100, source: 'exact' },
  'manufacturing wages': { group: 'Direct Expenses', side: 'expense', hint: 'Factory/direct wages', confidence: 100, source: 'exact' },
  'gas water electric charges': { group: 'Direct Expenses', side: 'expense', hint: 'Factory utility if production related', confidence: 100, source: 'exact' },
  'factory rent insurance electricity lighting heating': { group: 'Direct Expenses', side: 'expense', hint: 'Factory overhead reference from Tally-style mapping', confidence: 100, source: 'exact' },
  'sales': { group: 'Sales Account', side: 'income', hint: 'Primary revenue ledger. No sales screen is added; only grouping suggestion.', confidence: 100, source: 'exact' },
  'salary': { group: 'Indirect Expenses', side: 'expense', hint: 'Office/admin staff cost', confidence: 100, source: 'exact' },
  'postage and telegrams': { group: 'Indirect Expenses', side: 'expense', hint: 'Office communication cost', confidence: 100, source: 'exact' },
  'telephone charges': { group: 'Indirect Expenses', side: 'expense', hint: 'Office communication cost', confidence: 100, source: 'exact' },
  'rent paid': { group: 'Indirect Expenses', side: 'expense', hint: 'Administrative rent', confidence: 100, source: 'exact' },
  'rates and taxes': { group: 'Indirect Expenses', side: 'expense', hint: 'Administrative statutory cost', confidence: 100, source: 'exact' },
  'insurance': { group: 'Indirect Expenses', side: 'expense', hint: 'General insurance expense', confidence: 100, source: 'exact' },
  'audit fees': { group: 'Indirect Expenses', side: 'expense', hint: 'Professional/admin expense', confidence: 100, source: 'exact' },
  'interest on bank loan': { group: 'Indirect Expenses', side: 'expense', hint: 'Finance cost', confidence: 100, source: 'exact' },
  'interest on loans paid': { group: 'Indirect Expenses', side: 'expense', hint: 'Finance cost', confidence: 100, source: 'exact' },
  'bank charges': { group: 'Indirect Expenses', side: 'expense', hint: 'Bank service cost', confidence: 100, source: 'exact' },
  'legal charges': { group: 'Indirect Expenses', side: 'expense', hint: 'Professional/admin expense', confidence: 100, source: 'exact' },
  'printing and stationery': { group: 'Indirect Expenses', side: 'expense', hint: 'Office expense', confidence: 100, source: 'exact' },
  'general expenses': { group: 'Indirect Expenses', side: 'expense', hint: 'General admin cost', confidence: 100, source: 'exact' },
  'discount allowed': { group: 'Indirect Expenses', side: 'expense', hint: 'Selling/collection discount', confidence: 100, source: 'exact' },
  'travelling expenses': { group: 'Indirect Expenses', side: 'expense', hint: 'Administrative travel', confidence: 100, source: 'exact' },
  'advertisement': { group: 'Indirect Expenses', side: 'expense', hint: 'Marketing cost', confidence: 100, source: 'exact' },
  'bad debts': { group: 'Indirect Expenses', side: 'expense', hint: 'Receivable write-off', confidence: 100, source: 'exact' },
  'repairs': { group: 'Indirect Expenses', side: 'expense', hint: 'Maintenance cost', confidence: 100, source: 'exact' },
  'depreciation on assets': { group: 'Indirect Expenses', side: 'expense', hint: 'Non-cash fixed asset expense', confidence: 100, source: 'exact' },
  'interest on investment received': { group: 'Indirect Income', side: 'income', hint: 'Other income', confidence: 100, source: 'exact' },
  'interest on deposit received': { group: 'Indirect Income', side: 'income', hint: 'Other income', confidence: 100, source: 'exact' },
  'commission received': { group: 'Indirect Income', side: 'income', hint: 'Other income', confidence: 100, source: 'exact' },
  'discount received': { group: 'Indirect Income', side: 'income', hint: 'Other income', confidence: 100, source: 'exact' },
  'rent received': { group: 'Indirect Income', side: 'income', hint: 'Other income', confidence: 100, source: 'exact' },
  'dividend received': { group: 'Indirect Income', side: 'income', hint: 'Other income', confidence: 100, source: 'exact' },
  'profit by sale of assets': { group: 'Indirect Income', side: 'income', hint: 'Capital profit routed as other income', confidence: 100, source: 'exact' },
  'sundry income': { group: 'Indirect Income', side: 'income', hint: 'Other income', confidence: 100, source: 'exact' },
  'loan from others': { group: 'Loan Liabilities', side: 'liability', hint: 'Unsecured/other borrowing', confidence: 100, source: 'exact' },
  'bank loan': { group: 'Loan Liabilities', side: 'liability', hint: 'Borrowed capital / secured loan', confidence: 100, source: 'exact' },
  'bank overdraft': { group: 'Bank OD', side: 'liability', hint: 'Current liability / overdraft', confidence: 100, source: 'exact' },
  'bills payable': { group: 'Current Liabilities', side: 'liability', hint: 'Payable instrument', confidence: 100, source: 'exact' },
  'sundry creditors': { group: 'Sundry Creditors', side: 'liability', hint: 'Trade payable', confidence: 100, source: 'exact' },
  'mortgage loans': { group: 'Secured Loans', side: 'liability', hint: 'Long-term secured borrowing', confidence: 100, source: 'exact' },
  'expense outstanding': { group: 'Current Liabilities', side: 'liability', hint: 'Accrued expenses', confidence: 100, source: 'exact' },
  'income received in advance': { group: 'Current Liabilities', side: 'liability', hint: 'Unearned revenue', confidence: 100, source: 'exact' },
  'other liabilities': { group: 'Current Liabilities', side: 'liability', hint: 'Other payable', confidence: 100, source: 'exact' },
  'capital': { group: 'Capital Account', side: 'capital', hint: 'Owner capital', confidence: 100, source: 'exact' },
  'drawings': { group: 'Capital Account', side: 'capital', hint: 'Owner withdrawal', confidence: 100, source: 'exact' },
  'cash in hand': { group: 'Cash In Hand', side: 'asset', hint: 'Physical cash', confidence: 100, source: 'exact' },
  'cash at bank': { group: 'Bank Account', side: 'asset', hint: 'Bank balance', confidence: 100, source: 'exact' },
  'fixed deposit at bank': { group: 'Deposits', side: 'asset', hint: 'Deposit asset', confidence: 100, source: 'exact' },
  'investments': { group: 'Investments', side: 'asset', hint: 'Investment asset', confidence: 100, source: 'exact' },
  'bills receivable': { group: 'Current Asset', side: 'asset', hint: 'Receivable instrument', confidence: 100, source: 'exact' },
  'sundry debtors': { group: 'Sundry Debtors', side: 'asset', hint: 'Trade receivable', confidence: 100, source: 'exact' },
  'closing stock': { group: 'Stock In Hand', side: 'asset', hint: 'Inventory closing balance', confidence: 100, source: 'exact' },
  'stock of stationery': { group: 'Current Asset', side: 'asset', hint: 'Consumable current asset', confidence: 100, source: 'exact' },
  'loose tools': { group: 'Fixed Asset', side: 'asset', hint: 'Fixed asset', confidence: 100, source: 'exact' },
  'fixtures and fittings': { group: 'Fixed Asset', side: 'asset', hint: 'Fixed asset', confidence: 100, source: 'exact' },
  'furniture': { group: 'Fixed Asset', side: 'asset', hint: 'Fixed asset', confidence: 100, source: 'exact' },
  'motor vehicles': { group: 'Fixed Asset', side: 'asset', hint: 'Fixed asset', confidence: 100, source: 'exact' },
  'plant and machinery': { group: 'Fixed Asset', side: 'asset', hint: 'Fixed asset', confidence: 100, source: 'exact' },
  'land and building': { group: 'Fixed Asset', side: 'asset', hint: 'Fixed asset', confidence: 100, source: 'exact' },
  'leasehold property': { group: 'Fixed Asset', side: 'asset', hint: 'Fixed asset', confidence: 100, source: 'exact' },
  'patents': { group: 'Fixed Asset', side: 'asset', hint: 'Intangible/fixed asset', confidence: 100, source: 'exact' },
  'goodwill': { group: 'Fixed Asset', side: 'asset', hint: 'Intangible/fixed asset', confidence: 100, source: 'exact' },
  'prepaid expenses': { group: 'Current Asset', side: 'asset', hint: 'Prepaid current asset', confidence: 100, source: 'exact' },
  'income outstanding': { group: 'Current Asset', side: 'asset', hint: 'Accrued income', confidence: 100, source: 'exact' }
};


@Component({
  selector: 'app-balance-sheet',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <section class="bs">
      <!-- Signature: the accounting-equation ribbon — the single truth of a balance sheet -->
      <header class="masthead">
        <div class="brand">
          <span class="kicker">Finance · Owner Command Center</span>
          <h1>Balance Sheet</h1>
          <p class="sub">Live financial position, statutory-grade controls, and per-chair profitability — as of {{ asOfDate() }}.</p>
        </div>
        <div class="equation" [class.ok]="sheet()?.balanced" [class.bad]="sheet() && !sheet()?.balanced">
          <div class="eq-cell"><span>Assets</span><strong>{{ fmt(sheet()?.totals?.assets) }}</strong></div>
          <span class="eq-op">=</span>
          <div class="eq-cell"><span>Liabilities</span><strong>{{ fmt(sheet()?.totals?.liabilities) }}</strong></div>
          <span class="eq-op">+</span>
          <div class="eq-cell"><span>Equity</span><strong>{{ fmt(sheet()?.totals?.equity) }}</strong></div>
          <div class="eq-flag">{{ sheet()?.balanced ? 'Balanced' : 'Out of balance' }}</div>
        </div>
      </header>

      <div class="controls">
        <div class="dates">
          <label><span>As of</span><input type="date" [ngModel]="asOfDate()" (ngModelChange)="asOfDate.set($event); load()" /></label>
          <div class="presets">
            <button type="button" (click)="preset('today')">Today</button>
            <button type="button" (click)="preset('month')">Month end</button>
            <button type="button" (click)="preset('fy')">FY end</button>
          </div>
        </div>
        <div class="spacer"></div>
        <span class="ready-chip" [class.on]="hardening()?.productionReady">{{ hardening()?.productionReady ? 'Production ready' : 'Hardening pending' }}</span>
        <button class="ghost" type="button" (click)="exportCsv()">Export CSV</button>
        <button class="ghost" type="button" (click)="print()">Print</button>
        <button class="solid" type="button" [disabled]="loading()" (click)="load()">Refresh</button>
      </div>

      <p class="banner err" *ngIf="error()">{{ error() }}</p>
      <p class="banner ok" *ngIf="message()">{{ message() }}</p>

      <nav class="tabs">
        <button *ngFor="let t of tabs" type="button" [class.active]="tab() === t.key" (click)="tab.set(t.key)">{{ t.label }}</button>
      </nav>

      <div class="loading" *ngIf="loading()">Loading the latest figures…</div>

      <ng-container *ngIf="!loading()" [ngSwitch]="tab()">

        <!-- OVERVIEW -->
        <ng-container *ngSwitchCase="'overview'">
          <section class="cockpit" *ngIf="healthScore() as hs">
            <article class="panel score">
              <h2>Financial health</h2>
              <svg class="gauge" viewBox="0 0 200 116" aria-hidden="true">
                <path d="M20,100 A80,80 0 0 1 180,100" fill="none" stroke="var(--soft)" stroke-width="16" stroke-linecap="round" pathLength="100"></path>
                <path d="M20,100 A80,80 0 0 1 180,100" fill="none" [attr.stroke]="scoreColor(hs.overall)" stroke-width="16" stroke-linecap="round" pathLength="100" [attr.stroke-dasharray]="hs.overall + ',100'"></path>
                <text x="100" y="88" text-anchor="middle" class="g-num">{{ hs.overall }}</text>
                <text x="100" y="106" text-anchor="middle" class="g-band" [attr.fill]="scoreColor(hs.overall)">{{ hs.band }}</text>
              </svg>
              <div class="vitals">
                <div class="vital" *ngFor="let p of hs.parts"><span>{{ p.label }}</span><div class="vbar"><div class="vfill" [style.width.%]="p.score" [style.background]="scoreColor(p.score)"></div></div></div>
              </div>
            </article>
            <article class="panel advisor">
              <h2>What this means</h2>
              <p class="muted small">Numbers ko plain action me badla — sabse zaroori sabse upar.</p>
              <div class="insight" *ngFor="let i of insights()" [attr.data-sev]="i.severity">
                <strong>{{ i.title }}</strong><span>{{ i.text }}</span>
              </div>
            </article>
          </section>

          <section class="cards" *ngIf="sheet() as s">
            <article class="card"><span>Total assets</span><strong>{{ fmt(s.totals.assets) }}</strong></article>
            <article class="card"><span>Liabilities</span><strong>{{ fmt(s.totals.liabilities) }}</strong></article>
            <article class="card"><span>Equity</span><strong>{{ fmt(s.totals.equity) }}</strong></article>
            <article class="card" [class.flag]="s.totals.accountingEquationDifference"><span>Difference</span><strong>{{ fmt(s.totals.accountingEquationDifference) }}</strong></article>
          </section>

          <section class="panel" *ngIf="dailyOps() as d">
            <div class="panel-head">
              <h2>Today live operating breakup</h2>
              <span class="muted small">{{ d.businessDate }} · invoices {{ d.invoiceCount }}</span>
            </div>
            <section class="cards mini">
              <article class="card"><span>Aaj ki sale</span><strong>{{ fmt(d.sales) }}</strong></article>
              <article class="card"><span>Staff salary today</span><strong>{{ fmt(d.salary) }}</strong></article>
              <article class="card"><span>Commission today</span><strong>{{ fmt(d.commission) }}</strong></article>
              <article class="card"><span>Product consumed</span><strong>{{ fmt(d.productConsumption) }}</strong></article>
              <article class="card"><span>Daily rent</span><strong>{{ fmt(d.dailyRent) }}</strong></article>
              <article class="card" [class.flag]="d.netAfterTrackedCost < 0"><span>After tracked cost</span><strong>{{ fmt(d.netAfterTrackedCost) }}</strong></article>
            </section>
            <div class="split tight">
              <article>
                <h3>Staff earning and attendance</h3>
                <div class="scroll"><table><thead><tr><th>Staff</th><th>Attendance</th><th class="r">Sale</th><th class="r">Salary</th><th class="r">Commission</th><th class="r">Net</th></tr></thead>
                  <tbody><tr *ngFor="let r of d.staff"><td>{{ r.name }}</td><td class="muted">{{ r.attendance }}</td><td class="r">{{ fmt(r.revenue) }}</td><td class="r">{{ fmt(r.dailySalary) }}</td><td class="r">{{ fmt(r.commission) }}</td><td class="r">{{ fmt(r.netContribution) }}</td></tr></tbody>
                </table></div>
              </article>
              <article>
                <h3>Product consumption</h3>
                <div class="empty" *ngIf="!d.products.length">Aaj inventory issue/consume entry nahi mili.</div>
                <div class="scroll" *ngIf="d.products.length"><table><thead><tr><th>SKU</th><th class="r">Qty</th><th class="r">Cost</th></tr></thead>
                  <tbody><tr *ngFor="let p of d.products"><td>{{ p.sku }}</td><td class="r">{{ p.qty }}</td><td class="r">{{ fmt(p.cost) }}</td></tr></tbody>
                </table></div>
              </article>
            </div>
          </section>

          <section class="panel finance-os" *ngIf="financeOs() as f">
            <div class="panel-head">
              <h2>AI Growth Finance OS</h2>
              <span class="muted small">10 advanced controls · {{ f.asOfDate }}</span>
            </div>
            <div class="row-controls">
              <button class="solid" type="button" [disabled]="busy()" (click)="syncPosToGl()">Sync POS to GL</button>
              <button class="solid" type="button" [disabled]="busy()" (click)="ownerDailyClose()">Owner daily close</button>
              <button class="ghost" type="button" [disabled]="busy()" (click)="syncInventoryCogs()">Sync COGS</button>
              <button class="ghost" type="button" [disabled]="busy()" (click)="postDailyAccruals()">Post daily accruals</button>
              <button class="solid" type="button" [disabled]="busy()" (click)="runMonthCloseAutomation()">One-click month close</button>
              <span class="muted small" *ngIf="posGlSync() as s">Scanned {{ s.scanned }} · Enqueued {{ s.enqueued }} · Duplicate {{ s.duplicate }}</span>
            </div>
            <div class="row-controls muted small">
              <span *ngIf="inventoryCogsSync() as c">COGS: {{ c.scanned }} scanned · {{ c.enqueued }} queued · {{ fmt(c.cogs) }}</span>
              <span *ngIf="dailyAccruals() as a">Accruals: {{ a.posted }} journals posted</span>
              <span *ngIf="monthCloseAutomation() as m">Month close: {{ m.period }} · snapshot {{ m.snapshotId }}</span>
            </div>
            <section class="cards mini">
              <article class="card"><span>1. POS → GL sync</span><strong>{{ fmt(f.livePosToGl.difference) }}</strong><span class="small muted">gap · pending {{ f.livePosToGl.outboxPending }}</span></article>
              <article class="card"><span>2. Daily profit</span><strong>{{ fmt(f.dailyProfit.netAfterTrackedCost) }}</strong><span class="small muted">after tracked costs</span></article>
              <article class="card"><span>3. Staff profitability</span><strong>{{ f.staffProfitability.length }}</strong><span class="small muted">staff rows live</span></article>
              <article class="card"><span>4. Service margin</span><strong>{{ f.serviceMargins.length }}</strong><span class="small muted">services/items analyzed</span></article>
              <article class="card"><span>5. Inventory consume</span><strong>{{ fmt(f.inventoryConsumption.total) }}</strong><span class="small muted">WMA vs GL {{ fmt(f.inventoryConsumption.difference) }}</span></article>
              <article class="card"><span>6. Fixed cost/day</span><strong>{{ fmt(f.fixedCostAllocation.dailyRent + f.fixedCostAllocation.dailySalary) }}</strong><span class="small muted">rent + salary</span></article>
              <article class="card"><span>7. Journal alerts</span><strong>{{ f.journalSuggestions.length }}</strong><span class="small muted">auto suggestions</span></article>
              <article class="card"><span>8. Reconciliation</span><strong>{{ f.reconciliation.balanced ? 'OK' : 'Check' }}</strong><span class="small muted">diff {{ fmt(f.reconciliation.accountingEquationDifference) }}</span></article>
              <article class="card"><span>9. AI copilot</span><strong>{{ f.copilotPrompts.length }}</strong><span class="small muted">owner questions ready</span></article>
              <article class="card"><span>10. Month close</span><strong>{{ doneCount(f.monthEndClose.checklist) }}/{{ f.monthEndClose.checklist.length }}</strong><span class="small muted">{{ f.monthEndClose.month }}</span></article>
              <article class="card"><span>Outgoing impact</span><strong>{{ fmt(f.outgoingImpact.total) }}</strong><span class="small muted">profit after {{ fmt(f.outgoingImpact.profitAfterOutgoing) }}</span></article>
              <article class="card"><span>Daily close</span><strong>{{ f.ownerDailyClose.ready ? 'Ready' : 'Check' }}</strong><span class="small muted">{{ f.ownerDailyClose.warnings }} warnings</span></article>
              <article class="card"><span>Cash expected</span><strong>{{ fmt(f.cashBankReconciliation.expectedCash) }}</strong><span class="small muted">bank net {{ fmt(f.cashBankReconciliation.expectedBankNet) }}</span></article>
              <article class="card"><span>GST payable</span><strong>{{ fmt(f.gstPayableControl.todayCollected) }}</strong><span class="small muted">month {{ fmt(f.gstPayableControl.monthEstimate) }}</span></article>
            </section>
            <div class="split tight">
              <article>
                <h3>Today finance timeline</h3>
                <div class="stage" *ngFor="let e of f.todayTimeline"><span class="dot" [attr.data-state]="e.type === 'gl' ? 'ok' : 'warn'"></span><span class="st-label">{{ e.type }} · {{ e.title }}</span><span class="st-note muted small">{{ e.at }} · {{ fmt(e.amount) }}</span></div>
                <div class="empty" *ngIf="!f.todayTimeline.length">Aaj timeline activity nahi mili.</div>
              </article>
              <article>
                <h3>Owner daily close checklist</h3>
                <div class="stage" *ngFor="let c of f.ownerDailyClose.checklist"><span class="dot" [attr.data-state]="c.done ? 'ok' : 'warn'"></span><span class="st-label">{{ c.label }}</span><span class="st-note muted small">{{ c.done ? 'done' : 'pending' }}</span></div>
              </article>
            </div>
            <div class="split tight">
              <article>
                <h3>Outgoing fund live impact</h3>
                <div class="scroll"><table><thead><tr><th>Entry</th><th>Payee</th><th>Mode</th><th class="r">Amount</th></tr></thead>
                  <tbody><tr *ngFor="let o of f.outgoingImpact.recent"><td>{{ o.entryNo || o.category }}</td><td>{{ o.payee }}</td><td>{{ o.mode }}</td><td class="r">{{ fmt(o.amount) }}</td></tr></tbody>
                </table></div>
                <div class="empty" *ngIf="!f.outgoingImpact.recent.length">Aaj outgoing fund entry nahi mili.</div>
              </article>
              <article>
                <h3>Cash / Bank reconciliation</h3>
                <div class="metric"><span>Cash collection</span><strong>{{ fmt(f.cashBankReconciliation.cashCollection) }}</strong></div>
                <div class="metric"><span>Cash outgoing</span><strong>{{ fmt(f.cashBankReconciliation.cashOutgoing) }}</strong></div>
                <div class="metric"><span>Expected cash</span><strong>{{ fmt(f.cashBankReconciliation.expectedCash) }}</strong></div>
                <div class="metric"><span>Expected bank net</span><strong>{{ fmt(f.cashBankReconciliation.expectedBankNet) }}</strong></div>
              </article>
            </div>
            <div class="split tight">
              <article>
                <h3>Expense category profit view</h3>
                <div class="scroll"><table><thead><tr><th>Category</th><th class="r">Cost</th><th class="r">Net after</th><th>Source</th></tr></thead>
                  <tbody><tr *ngFor="let e of f.expenseCategoryProfit"><td>{{ e.category }}</td><td class="r">{{ fmt(e.amount) }}</td><td class="r">{{ fmt(e.netAfterCategory) }}</td><td>{{ e.sources.join(', ') }}</td></tr></tbody>
                </table></div>
              </article>
              <article>
                <h3>Invoice to Balance Sheet drilldown</h3>
                <div class="scroll"><table><thead><tr><th>Invoice</th><th class="r">Revenue</th><th class="r">GST</th><th>GL</th></tr></thead>
                  <tbody><tr *ngFor="let i of f.invoiceDrilldown"><td>{{ i.invoiceNumber }}</td><td class="r">{{ fmt(i.revenue) }}</td><td class="r">{{ fmt(i.gst) }}</td><td>{{ i.glStatus }}</td></tr></tbody>
                </table></div>
              </article>
            </div>
            <article>
              <h3>Branch wise Balance Sheet</h3>
              <div class="scroll"><table><thead><tr><th>Branch</th><th class="r">Cash/Bank</th><th class="r">Receivable</th><th class="r">Payable</th><th class="r">Stock</th><th class="r">Profit</th></tr></thead>
                <tbody><tr *ngFor="let b of f.branchWiseBalanceSheet"><td>{{ b.branchName }}</td><td class="r">{{ fmt(b.cash) }}</td><td class="r">{{ fmt(b.receivable) }}</td><td class="r">{{ fmt(b.payable) }}</td><td class="r">{{ fmt(b.stock) }}</td><td class="r">{{ fmt(b.profit) }}</td></tr></tbody>
              </table></div>
            </article>
            <div class="split tight">
              <article>
                <h3>Auto journal suggestions</h3>
                <div class="insight" *ngFor="let s of f.journalSuggestions" [attr.data-sev]="s.severity">
                  <strong>{{ s.title }}</strong><span>{{ s.text }}</span><small>{{ s.action }}</small>
                </div>
                <div class="empty" *ngIf="!f.journalSuggestions.length">No pending journal suggestion.</div>
              </article>
              <article>
                <h3>Owner AI copilot prompts</h3>
                <div class="ledger-preview" *ngFor="let p of f.copilotPrompts"><strong>{{ p }}</strong><span>Ready from live finance data</span></div>
                <div class="form-row copilot-row">
                  <input placeholder="Ask: Aaj profit kam kyu hai?" [ngModel]="copilotQuestion()" (ngModelChange)="copilotQuestion.set($event)" />
                  <button class="solid" type="button" [disabled]="busy() || !copilotQuestion()" (click)="askFinanceCopilot()">Ask</button>
                </div>
                <div class="insight" *ngIf="copilotAnswer() as a" data-sev="ok">
                  <strong>{{ a.question }}</strong><span>{{ a.answer }}</span><small>{{ a.actions.join(' · ') }}</small>
                </div>
              </article>
            </div>
            <div class="split tight">
              <article>
                <h3>Service wise true margin</h3>
                <div class="scroll"><table><thead><tr><th>Service / item</th><th class="r">Revenue</th><th class="r">Product</th><th class="r">Comm.</th><th class="r">Margin</th></tr></thead>
                  <tbody><tr *ngFor="let s of f.serviceMargins"><td>{{ s.name }}</td><td class="r">{{ fmt(s.revenue) }}</td><td class="r">{{ fmt(s.productCost) }}</td><td class="r">{{ fmt(s.staffCommission) }}</td><td class="r">{{ fmt(s.margin) }} · {{ s.marginPct }}%</td></tr></tbody>
                </table></div>
              </article>
              <article>
                <h3>Month-end close checklist</h3>
                <div class="stage" *ngFor="let c of f.monthEndClose.checklist"><span class="dot" [attr.data-state]="c.done ? 'ok' : 'warn'"></span><span class="st-label">{{ c.label }}</span><span class="st-note muted small">{{ fmt(c.amount) }}</span></div>
              </article>
            </div>
          </section>

          <section class="split" *ngIf="sheet() as s">
            <article class="panel">
              <h2>Composition</h2>
              <p class="muted small">Where the money sits and how it's funded.</p>
              <svg class="bars" viewBox="0 0 320 120" preserveAspectRatio="none" aria-hidden="true">
                <g *ngFor="let b of compositionBars(); let i = index">
                  <rect [attr.x]="0" [attr.y]="i*40+8" [attr.width]="b.width" height="22" [attr.fill]="b.color" rx="3"></rect>
                  <text [attr.x]="6" [attr.y]="i*40+23" class="bar-label">{{ b.label }}</text>
                  <text [attr.x]="314" [attr.y]="i*40+23" class="bar-value" text-anchor="end">{{ fmt(b.value) }}</text>
                </g>
              </svg>
            </article>
            <article class="panel">
              <h2>Liquidity</h2>
              <div class="metric"><span>Working capital</span><strong>{{ fmt(s.workingCapital.workingCapital) }}</strong></div>
              <div class="metric"><span>Current ratio</span><strong>{{ s.workingCapital.currentRatio ?? '—' }}</strong></div>
              <div class="metric"><span>Quick ratio</span><strong>{{ s.workingCapital.quickRatio ?? '—' }}</strong></div>
              <div class="metric"><span>Cash runway</span><strong>{{ s.workingCapital.cashRunwayDays ?? '—' }} days</strong></div>
            </article>
          </section>

          <section class="panel" *ngIf="(sheet()?.alerts || []).length">
            <h2>Needs attention</h2>
            <div class="alert" *ngFor="let a of sheet()?.alerts" [attr.data-sev]="a.severity"><strong>{{ a.title }}</strong><span>{{ a.message }}</span></div>
          </section>
        </ng-container>

        <!-- TRIAL BALANCE -->
        <section class="panel" *ngSwitchCase="'trial'">
          <div class="panel-head"><h2>Trial balance</h2><span class="pill" [class.bad]="!trial()?.balanced">{{ trial()?.balanced ? 'Balanced' : ('Diff ' + fmt(trial()?.difference)) }}</span></div>
          <div class="scroll"><table><thead><tr><th>Account</th><th>Type</th><th class="r">Debit</th><th class="r">Credit</th><th class="r">Balance</th></tr></thead>
            <tbody><tr *ngFor="let r of trial()?.rows || []"><td>{{ r.code }} · {{ r.name }}</td><td class="muted">{{ r.accountType }}</td><td class="r">{{ fmt(r.debit) }}</td><td class="r">{{ fmt(r.credit) }}</td><td class="r">{{ fmt(r.balance) }}</td></tr></tbody>
            <tfoot><tr><td colspan="2">Totals</td><td class="r">{{ fmt(trial()?.debitTotal) }}</td><td class="r">{{ fmt(trial()?.creditTotal) }}</td><td></td></tr></tfoot>
          </table></div>
        </section>

        <!-- WORKING CAPITAL -->
        <ng-container *ngSwitchCase="'working'">
          <section class="cards" *ngIf="sheet()?.workingCapital as w">
            <article class="card"><span>Current assets</span><strong>{{ fmt(w.currentAssets) }}</strong></article>
            <article class="card"><span>Current liabilities</span><strong>{{ fmt(w.currentLiabilities) }}</strong></article>
            <article class="card"><span>Working capital</span><strong>{{ fmt(w.workingCapital) }}</strong></article>
            <article class="card"><span>Current ratio</span><strong>{{ w.currentRatio ?? '—' }}</strong></article>
          </section>
          <section class="panel" *ngIf="sheet()?.workingCapital as w">
            <h2>Solvency ratios</h2>
            <div class="metric"><span>Quick ratio (acid test)</span><strong>{{ w.quickRatio ?? '—' }}</strong></div>
            <div class="metric"><span>Cash ratio</span><strong>{{ w.cashRatio ?? '—' }}</strong></div>
            <div class="metric"><span>Estimated cash runway</span><strong>{{ w.cashRunwayDays ?? '—' }} days</strong></div>
          </section>
        </ng-container>

        <!-- LEDGER -->
        <section class="panel" *ngSwitchCase="'ledger'">
          <div class="panel-head"><h2>Ledger</h2></div>
          <div class="row-controls">
            <select [ngModel]="ledgerAccount()" (ngModelChange)="ledgerAccount.set($event)">
              <option value="">Choose an account</option>
              <option *ngFor="let r of trial()?.rows || []" [value]="r.accountId">{{ r.code }} · {{ r.name }}</option>
            </select>
            <button class="solid" type="button" [disabled]="!ledgerAccount()" (click)="loadLedger()">View entries</button>
          </div>
          <div class="empty" *ngIf="!ledgerRows().length">Pick an account to trace every posting behind its balance.</div>
          <div class="scroll" *ngIf="ledgerRows().length"><table><thead><tr><th>Date</th><th>Source</th><th>Memo</th><th class="r">Debit</th><th class="r">Credit</th><th class="r">Balance</th></tr></thead>
            <tbody><tr *ngFor="let r of ledgerRows()"><td>{{ r.businessDate }}</td><td class="muted">{{ r.sourceType }}</td><td>{{ r.memo }}</td><td class="r">{{ fmt(r.debit) }}</td><td class="r">{{ fmt(r.credit) }}</td><td class="r">{{ fmt(r.balance) }}</td></tr></tbody>
          </table></div>
        </section>

        <!-- LEDGER MASTER AUTO GROUPING -->
        <ng-container *ngSwitchCase="'ledgerMaster'">
          <section class="split ledger-master-grid">
            <article class="panel">
              <div class="panel-head"><h2>Auto ledger grouping</h2><span class="muted small">Tally-style master engine</span></div>
              <p class="muted small">Ledger name type karo. System group, side, hint aur confidence auto suggest karega. Manual override bhi available hai.</p>
              <div class="form-col">
                <label><span>Ledger name</span><input placeholder="e.g. Salary, Furniture, Cash at Bank" [ngModel]="ledgerDraftName()" (ngModelChange)="onLedgerDraftName($event)" /></label>
                <label><span>Suggested group</span>
                  <select [ngModel]="ledgerDraftGroup()" (ngModelChange)="ledgerDraftGroup.set($event); ledgerManualOverride.set(true)">
                    <option *ngFor="let g of tallyGroups" [value]="g">{{ g }}</option>
                  </select>
                </label>
                <label><span>Side</span>
                  <select [ngModel]="ledgerDraftSide()" (ngModelChange)="ledgerDraftSide.set($event); ledgerManualOverride.set(true)">
                    <option value="asset">Asset</option>
                    <option value="liability">Liability</option>
                    <option value="capital">Capital</option>
                    <option value="income">Income</option>
                    <option value="expense">Expense</option>
                    <option value="unknown">Unknown / Review</option>
                  </select>
                </label>
                <div class="ledger-suggestion" *ngIf="ledgerSuggestion() as sg" [attr.data-sev]="sg.side === 'unknown' ? 'warn' : 'ok'">
                  <strong>{{ sg.side === 'unknown' ? '⚠ Review Required' : 'Suggested' }}</strong>
                  <span>Group: {{ ledgerDraftGroup() }} · Side: {{ ledgerDraftSide() | titlecase }} · Confidence: {{ sg.confidence }}%</span>
                  <small>{{ sg.hint }}</small>
                </div>
                <div class="row-controls">
                  <button class="solid" type="button" [disabled]="!ledgerDraftName()" (click)="addLedgerDraft()">Add to preview</button>
                  <button class="ghost" type="button" (click)="resetLedgerDraft()">Reset</button>
                </div>
              </div>
            </article>
            <article class="panel">
              <div class="panel-head"><h2>Ledger preview</h2><span class="muted small">No report screen added</span></div>
              <div class="empty" *ngIf="!ledgerDrafts().length">Abhi koi ledger preview nahi hai.</div>
              <div class="ledger-preview" *ngFor="let l of ledgerDrafts()">
                <strong>{{ l.name }}</strong>
                <span>{{ l.group }} · {{ l.side | titlecase }}</span>
                <small>{{ l.confidence }}% · {{ l.hint }}</small>
              </div>
            </article>
          </section>

          <section class="panel">
            <div class="panel-head"><h2>Ledger & group mapping</h2><span class="muted small">Images se added Tally-style mapping</span></div>
            <div class="scroll"><table><thead><tr><th>Ledger</th><th>Group</th><th>Side</th><th>Hint</th></tr></thead>
              <tbody><tr *ngFor="let m of ledgerMappingRows()"><td>{{ m.ledger }}</td><td>{{ m.group }}</td><td>{{ m.side }}</td><td class="muted">{{ m.hint }}</td></tr></tbody>
            </table></div>
          </section>
        </ng-container>

        <!-- COST CENTERS -->
        <ng-container *ngSwitchCase="'centers'">
          <section class="panel">
            <div class="panel-head"><h2>Profit by cost center</h2><span class="muted small">{{ pnl()?.fromDate }} → {{ pnl()?.toDate }}</span></div>
            <div class="empty" *ngIf="!(pnl()?.costCenters || []).length">No tagged activity yet. Add a cost center, then tag sale and cost lines with it to see per-chair or per-stylist profit.</div>
            <div class="cc-rows" *ngIf="(pnl()?.costCenters || []).length">
              <div class="cc-row" *ngFor="let c of pnl()?.costCenters">
                <div class="cc-name"><strong>{{ c.name }}</strong><span class="tag">{{ c.type }}</span></div>
                <div class="cc-bar"><div class="fill" [class.neg]="c.netProfit < 0" [style.width.%]="ccWidth(c.netProfit)"></div></div>
                <div class="cc-val" [class.neg]="c.netProfit < 0">{{ fmt(c.netProfit) }}</div>
              </div>
            </div>
          </section>
          <section class="panel">
            <h2>Add cost center</h2>
            <div class="form-row">
              <input placeholder="Code (e.g. CHAIR-1)" [ngModel]="ccCode()" (ngModelChange)="ccCode.set($event)" />
              <input placeholder="Name" [ngModel]="ccName()" (ngModelChange)="ccName.set($event)" />
              <select [ngModel]="ccType()" (ngModelChange)="ccType.set($event)">
                <option value="chair">Chair</option><option value="stylist">Stylist</option><option value="category">Category</option><option value="department">Department</option>
              </select>
              <button class="solid" type="button" [disabled]="busy() || !ccCode() || !ccName()" (click)="addCostCenter()">Create</button>
            </div>
          </section>
        </ng-container>

        <!-- DEFERRED REVENUE -->
        <ng-container *ngSwitchCase="'deferred'">
          <section class="cards">
            <article class="card wide"><span>Deferred revenue liability (unearned)</span><strong>{{ fmt(deferred()?.deferredLiability) }}</strong></article>
            <article class="card"><button class="solid full" type="button" [disabled]="busy()" (click)="recognizeDue()">Recognize due revenue</button></article>
          </section>
          <section class="panel">
            <div class="panel-head"><h2>Schedules</h2></div>
            <div class="empty" *ngIf="!(deferred()?.schedules || []).length">No packages, memberships, or gift cards booked yet. Selling one creates a deferred-revenue schedule here.</div>
            <div class="scroll" *ngIf="(deferred()?.schedules || []).length"><table><thead><tr><th>Type</th><th>Ref</th><th>Method</th><th class="r">Total</th><th>Recognized</th><th class="r">Unearned</th><th>Status</th></tr></thead>
              <tbody><tr *ngFor="let s of deferred()?.schedules">
                <td>{{ s.sourceType }}</td><td class="muted">{{ s.sourceId }}</td><td class="muted">{{ s.method === 'straight_line' ? 'Straight line' : 'On usage' }}</td>
                <td class="r">{{ fmt(s.total) }}</td>
                <td><div class="prog"><div class="prog-fill" [style.width.%]="pct(s.recognized, s.total)"></div></div><span class="small muted">{{ fmt(s.recognized) }} of {{ fmt(s.total) }}</span></td>
                <td class="r">{{ fmt(s.deferredBalance) }}</td>
                <td><span class="pill" [class.done]="s.status === 'completed'">{{ s.status }}</span></td>
              </tr></tbody>
            </table></div>
          </section>
        </ng-container>

        <!-- FIXED ASSETS -->
        <ng-container *ngSwitchCase="'assets'">
          <section class="cards">
            <article class="card"><span>Gross block</span><strong>{{ fmt(assets()?.grossBlock) }}</strong></article>
            <article class="card"><span>Accumulated depreciation</span><strong>{{ fmt(assets()?.accumulatedDepreciation) }}</strong></article>
            <article class="card"><span>Net block</span><strong>{{ fmt(assets()?.netBlock) }}</strong></article>
            <article class="card">
              <span>Run depreciation</span>
              <div class="inline-run"><input type="month" [ngModel]="depMonth()" (ngModelChange)="depMonth.set($event)" /><button class="solid" type="button" [disabled]="busy()" (click)="runDepreciation()">Run</button></div>
            </article>
          </section>
          <section class="panel">
            <div class="panel-head"><h2>Asset register</h2></div>
            <div class="empty" *ngIf="!(assets()?.assets || []).length">No assets recorded. Add equipment to track its book value and post monthly depreciation automatically.</div>
            <div class="scroll" *ngIf="(assets()?.assets || []).length"><table><thead><tr><th>Code</th><th>Name</th><th>Method</th><th class="r">Cost</th><th class="r">Accum. dep.</th><th class="r">Net book value</th><th>Status</th></tr></thead>
              <tbody><tr *ngFor="let a of assets()?.assets"><td>{{ a.code }}</td><td>{{ a.name }}</td><td class="muted">{{ a.method }}</td><td class="r">{{ fmt(a.cost) }}</td><td class="r">{{ fmt(a.accumulatedDepreciation) }}</td><td class="r">{{ fmt(a.netBookValue) }}</td><td><span class="pill" [class.bad]="a.status === 'disposed'">{{ a.status }}</span></td></tr></tbody>
            </table></div>
          </section>
        </ng-container>

        <!-- MANUAL ENTRY -->
        <ng-container *ngSwitchCase="'manual'">
          <section class="split manual-entry">
            <article class="panel">
              <div class="panel-head">
                <div>
                  <h2>Manual live entry</h2>
                  <p class="muted small">Rent, salary, opening balance aur custom journal post hote hi Balance Sheet refresh hoti hai.</p>
                </div>
                <button class="ghost" type="button" [disabled]="busy()" (click)="reopenSelectedPeriod()">Unlock {{ asOfDate().slice(0, 7) }}</button>
              </div>
              <div class="manual-grid">
                <label><span>Entry type</span>
                  <select [ngModel]="manualType()" (ngModelChange)="manualType.set($event)">
                    <option value="rent">Rent expense</option>
                    <option value="salary">Salary expense</option>
                    <option value="opening">Opening balance</option>
                    <option value="custom">Custom journal</option>
                  </select>
                </label>
                <label><span>Date</span><input type="date" [ngModel]="manualDate()" (ngModelChange)="manualDate.set($event)" /></label>
                <label><span>Amount ₹</span><input type="number" min="1" step="1" [ngModel]="manualAmount()" (ngModelChange)="manualAmount.set(+$event)" /></label>
                <label *ngIf="manualType() !== 'custom' && manualType() !== 'opening'"><span>Credit account</span>
                  <select [ngModel]="manualCreditCode()" (ngModelChange)="manualCreditCode.set($event)">
                    <option value="1000">Cash</option>
                    <option value="1010">Bank</option>
                    <option value="2000">Payable</option>
                  </select>
                </label>
                <label *ngIf="manualType() === 'opening'"><span>Credit account</span><input value="Owner Capital" disabled /></label>
                <label *ngIf="manualType() === 'opening'"><span>Debit account</span>
                  <select [ngModel]="manualDebitCode()" (ngModelChange)="manualDebitCode.set($event)">
                    <option value="1000">Cash</option>
                    <option value="1010">Bank</option>
                    <option value="1500">Fixed Assets</option>
                  </select>
                </label>
                <label *ngIf="manualType() === 'custom'"><span>Debit ledger</span>
                  <select [ngModel]="customDebitAccountId()" (ngModelChange)="customDebitAccountId.set($event)">
                    <option value="">Select debit ledger</option>
                    <option *ngFor="let r of trial()?.rows || []" [value]="r.accountId">{{ r.code }} · {{ r.name }}</option>
                  </select>
                </label>
                <label *ngIf="manualType() === 'custom'"><span>Credit ledger</span>
                  <select [ngModel]="customCreditAccountId()" (ngModelChange)="customCreditAccountId.set($event)">
                    <option value="">Select credit ledger</option>
                    <option *ngFor="let r of trial()?.rows || []" [value]="r.accountId">{{ r.code }} · {{ r.name }}</option>
                  </select>
                </label>
                <label class="wide"><span>Memo</span><input [ngModel]="manualMemo()" (ngModelChange)="manualMemo.set($event)" placeholder="e.g. June rent paid from bank" /></label>
              </div>
              <button class="solid full" type="button" [disabled]="busy()" (click)="postManualJournal()">Post entry and refresh live sheet</button>
            </article>

            <article class="panel">
              <div class="panel-head">
                <div>
                  <h2>Add fixed asset</h2>
                  <p class="muted small">Asset save karte hi Dr Fixed Assets / Cr Cash-Bank-Payable journal post hota hai.</p>
                </div>
              </div>
              <div class="manual-grid">
                <label><span>Asset code</span><input [ngModel]="assetCode()" (ngModelChange)="assetCode.set($event)" placeholder="AC-01" /></label>
                <label><span>Name</span><input [ngModel]="assetName()" (ngModelChange)="assetName.set($event)" placeholder="AC machine" /></label>
                <label><span>Category</span><input [ngModel]="assetCategory()" (ngModelChange)="assetCategory.set($event)" placeholder="equipment" /></label>
                <label><span>Date</span><input type="date" [ngModel]="assetDate()" (ngModelChange)="assetDate.set($event)" /></label>
                <label><span>Cost ₹</span><input type="number" min="1" step="1" [ngModel]="assetCost()" (ngModelChange)="assetCost.set(+$event)" /></label>
                <label><span>Payment</span>
                  <select [ngModel]="assetPaymentMode()" (ngModelChange)="assetPaymentMode.set($event)">
                    <option value="bank">Bank</option>
                    <option value="cash">Cash</option>
                    <option value="payable">Payable</option>
                  </select>
                </label>
                <label><span>Life months</span><input type="number" min="1" step="1" [ngModel]="assetLifeMonths()" (ngModelChange)="assetLifeMonths.set(+$event)" /></label>
              </div>
              <button class="solid full" type="button" [disabled]="busy()" (click)="addFixedAsset()">Add asset and refresh live sheet</button>
            </article>
          </section>
        </ng-container>

        <!-- COST STRUCTURE -->
        <ng-container *ngSwitchCase="'costs'">
          <section class="cards" *ngIf="costs() as c">
            <article class="card"><span>Revenue ({{ c.fromDate }} → {{ c.toDate }})</span><strong>{{ fmt(c.revenue) }}</strong></article>
            <article class="card"><span>Variable cost</span><strong>{{ fmt(c.variableCost) }}</strong></article>
            <article class="card"><span>Fixed cost</span><strong>{{ fmt(c.fixedCost) }}</strong><span class="small muted">incl. salary {{ fmt(c.salaryCost) }}</span></article>
            <article class="card" [class.flag]="c.netProfit < 0"><span>Net profit</span><strong>{{ fmt(c.netProfit) }}</strong></article>
          </section>

          <section class="split" *ngIf="costs() as c">
            <article class="panel">
              <h2>Break-even</h2>
              <p class="muted small">Har mahine itna kamana zaroori hai costs cover karne ke liye.</p>
              <div class="metric"><span>Break-even revenue</span><strong>{{ c.breakEvenRevenue === null ? '—' : fmt(c.breakEvenRevenue) }}</strong></div>
              <div class="metric"><span>Break-even clients / month</span><strong>{{ c.breakEvenClients ?? '—' }}</strong></div>
              <div class="metric"><span>Margin of safety</span><strong>{{ c.marginOfSafetyPct === null ? '—' : (c.marginOfSafetyPct + '%') }}</strong></div>
              <div class="row-controls" style="margin-top:12px">
                <label class="ticket"><span>Avg ticket ₹</span><input type="number" min="1" [ngModel]="avgTicket()" (ngModelChange)="avgTicket.set($event)" (change)="load()" /></label>
              </div>
            </article>
            <article class="panel">
              <h2>Cost split</h2>
              <div class="stack" *ngIf="(c.variableCost + c.fixedCost) > 0">
                <div class="seg var" [style.width.%]="splitPct(c.variableCost, c)"><span>Variable</span></div>
                <div class="seg fix" [style.width.%]="splitPct(c.fixedCost, c)"><span>Fixed</span></div>
              </div>
              <div class="metric"><span>Contribution margin</span><strong>{{ fmt(c.contributionMargin) }} · {{ c.contributionMarginRatioPct }}%</strong></div>
              <div class="metric"><span>Salary cost</span><strong>{{ fmt(c.salaryCost) }}</strong></div>
              <div class="metric" [class.warn-row]="(c.salaryToRevenuePct || 0) > 40"><span>Salary as % of revenue</span><strong>{{ c.salaryToRevenuePct === null ? '—' : (c.salaryToRevenuePct + '%') }}</strong></div>
            </article>
          </section>

          <section class="panel" *ngIf="(costs()?.lines || []).length">
            <div class="panel-head"><h2>Cost breakdown</h2><span class="muted small">Behavior badal ke reclassify karo</span></div>
            <div class="scroll"><table><thead><tr><th>Account</th><th>Category</th><th>Behavior</th><th class="r">Amount</th></tr></thead>
              <tbody><tr *ngFor="let l of costs()?.lines">
                <td>{{ l.code }} · {{ l.name }}</td><td class="muted">{{ l.category }}</td>
                <td><select [ngModel]="l.behavior" (ngModelChange)="reclassify(l.code, $event)"><option value="fixed">Fixed</option><option value="variable">Variable</option><option value="excluded">Excluded</option></select></td>
                <td class="r">{{ fmt(l.amount) }}</td>
              </tr></tbody>
            </table></div>
          </section>
        </ng-container>

        <!-- SIMULATOR -->
        <ng-container *ngSwitchCase="'simulator'">
          <section class="panel">
            <div class="panel-head"><h2>Profit simulator</h2><button class="ghost" type="button" (click)="resetSim()">Reset</button></div>
            <p class="muted small">Aaj ke numbers pe "what-if" chalao — kuch bhi save nahi hota, sirf preview.</p>
            <div class="sliders">
              <label class="sl"><span>Price uplift <b>{{ simPrice() }}%</b></span><input type="range" min="-30" max="50" [ngModel]="simPrice()" (ngModelChange)="simPrice.set(+$event)" /></label>
              <label class="sl"><span>Footfall change <b>{{ simVolume() }}%</b></span><input type="range" min="-50" max="100" [ngModel]="simVolume()" (ngModelChange)="simVolume.set(+$event)" /></label>
              <label class="sl"><span>Product cost change <b>{{ simProduct() }}%</b></span><input type="range" min="-50" max="50" [ngModel]="simProduct()" (ngModelChange)="simProduct.set(+$event)" /></label>
              <label class="sl"><span>Fixed cost change (₹/month)</span><input type="number" step="1000" [ngModel]="simFixed()" (ngModelChange)="simFixed.set(+$event)" placeholder="e.g. 25000 for a new stylist" /></label>
            </div>
          </section>

          <section class="cards" *ngIf="simResult() as r">
            <article class="card"><span>Revenue</span><strong>{{ fmt(r.revenue) }}</strong><span class="small muted">now {{ fmt(costs()?.revenue) }}</span></article>
            <article class="card" [class.flag]="r.net < 0"><span>Net profit</span><strong>{{ fmt(r.net) }}</strong><span class="small" [class.up]="r.deltaNet >= 0" [class.down]="r.deltaNet < 0">{{ r.deltaNet >= 0 ? '▲ +' : '▼ ' }}{{ fmt(r.deltaNet) }}</span></article>
            <article class="card"><span>Break-even revenue</span><strong>{{ r.breakEven === null ? '—' : fmt(r.breakEven) }}</strong><span class="small muted">now {{ fmt(costs()?.breakEvenRevenue) }}</span></article>
            <article class="card"><span>Break-even clients</span><strong>{{ r.beClients ?? '—' }}</strong><span class="small muted">now {{ costs()?.breakEvenClients ?? '—' }}</span></article>
          </section>

          <section class="panel" *ngIf="simResult() as r">
            <h2>Now → Simulated</h2>
            <div class="cmp"><span>Contribution margin</span><b>{{ fmt(costs()?.contributionMargin) }}</b><i>→</i><b [class.up]="r.cm >= (costs()?.contributionMargin || 0)">{{ fmt(r.cm) }}</b><span class="muted small">{{ r.cmRatioPct }}%</span></div>
            <div class="cmp"><span>Fixed cost</span><b>{{ fmt(costs()?.fixedCost) }}</b><i>→</i><b>{{ fmt(r.fixed) }}</b></div>
            <div class="cmp"><span>Net profit</span><b [class.neg]="(costs()?.netProfit || 0) < 0">{{ fmt(costs()?.netProfit) }}</b><i>→</i><b [class.up]="r.net >= 0" [class.neg]="r.net < 0">{{ fmt(r.net) }}</b></div>
            <p class="sim-note">{{ simNote() }}</p>
          </section>
        </ng-container>


        <!-- TALLY STYLE DRILL DOWN -->
        <ng-container *ngSwitchCase="'drilldown'">
          <section class="panel">
            <div class="panel-head"><h2>Tally Prime style drill down</h2><span class="muted small">Group → Ledger → Voucher</span></div>
            <p class="muted small">Kisi bhi group par click karo. Ledger par click karne se original postings ledger tab me open ho jayengi.</p>
            <div class="drill-tree" *ngIf="drillTree() as tree">
              <ng-container *ngFor="let n of tree">
                <button type="button" class="drill-row" [style.paddingLeft.px]="n.level * 18 + 12" (click)="onDrill(n)">
                  <span><b>{{ n.label }}</b><small>{{ n.type }}</small></span><strong>{{ fmt(n.amount) }}</strong>
                </button>
                <ng-container *ngIf="expandedDrill()[n.id]">
                  <button *ngFor="let c of n.children || []" type="button" class="drill-row child" [style.paddingLeft.px]="c.level * 18 + 12" (click)="onDrill(c)">
                    <span>{{ c.label }}<small>{{ c.type }}</small></span><strong>{{ fmt(c.amount) }}</strong>
                  </button>
                </ng-container>
              </ng-container>
            </div>
          </section>
        </ng-container>

        <!-- ZOHO + POWER BI STYLE DASHBOARD -->
        <ng-container *ngSwitchCase="'analytics'">
          <section class="cards" *ngIf="executiveDashboard() as d">
            <article class="card"><span>Owner score</span><strong>{{ d.score }}/100</strong><span class="small muted">{{ d.status }}</span></article>
            <article class="card"><span>Debt to equity</span><strong>{{ d.debtToEquity }}</strong></article>
            <article class="card"><span>Net margin</span><strong>{{ d.netMarginPct }}%</strong></article>
            <article class="card"><span>Cash runway</span><strong>{{ d.cashRunwayDays ?? '—' }} days</strong></article>
          </section>
          <section class="split">
            <article class="panel">
              <h2>Power BI style trend</h2>
              <svg class="line-chart" viewBox="0 0 420 180" preserveAspectRatio="none" aria-hidden="true">
                <polyline [attr.points]="linePoints('revenue')" fill="none" stroke="var(--brand)" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"></polyline>
                <polyline [attr.points]="linePoints('profit')" fill="none" stroke="var(--good)" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"></polyline>
              </svg>
              <div class="legend"><span><i class="brand-dot"></i>Revenue</span><span><i class="good-dot"></i>Profit</span></div>
            </article>
            <article class="panel">
              <h2>Asset funding mix</h2>
              <div class="donut" [style.background]="donutGradient()"><span>{{ executiveDashboard()?.equitySharePct }}%</span></div>
              <p class="muted small">Center number equity funding share hai. High equity share matlab risk kam.</p>
            </article>
          </section>
        </ng-container>

        <!-- AI INSIGHTS -->
        <ng-container *ngSwitchCase="'ai'">
          <section class="panel">
            <div class="panel-head"><h2>AI finance advisor</h2><span class="muted small">Rule-based local insights</span></div>
            <div class="ai-card" *ngFor="let i of advancedAiInsights()" [attr.data-sev]="i.severity">
              <strong>{{ i.title }}</strong><span>{{ i.text }}</span><em>{{ i.action }}</em>
            </div>
          </section>
        </ng-container>

        <!-- FORECASTING -->
        <ng-container *ngSwitchCase="'forecast'">
          <section class="panel">
            <div class="panel-head"><h2>12 month balance-sheet forecast</h2><span class="muted small">Assets, liabilities, net worth</span></div>
            <div class="forecast-grid">
              <div class="forecast-card" *ngFor="let f of forecast()"><span>{{ f.month }}</span><b>{{ fmt(f.netWorth) }}</b><small>Assets {{ fmt(f.assets) }} · Liabilities {{ fmt(f.liabilities) }}</small></div>
            </div>
          </section>
        </ng-container>

        <!-- CASH FLOW PREDICTION -->
        <ng-container *ngSwitchCase="'cashflow'">
          <section class="cards" *ngIf="cashPrediction() as cp">
            <article class="card"><span>Expected inflow</span><strong>{{ fmt(cp.expectedInflow) }}</strong></article>
            <article class="card"><span>Expected outflow</span><strong>{{ fmt(cp.expectedOutflow) }}</strong></article>
            <article class="card"><span>Closing cash</span><strong>{{ fmt(cp.closingCash) }}</strong></article>
            <article class="card" [class.flag]="cp.risk !== 'Low'"><span>Cash runway days</span><strong>{{ cp.runwayDays }}</strong><span class="small muted">Risk: {{ cp.risk }}</span></article>
          </section>
          <section class="panel">
            <h2>Cash runway projection</h2>
            <div class="cash-row" *ngFor="let f of forecast()"><span>{{ f.month }}</span><div><i [style.width.%]="cashBarWidth(f.closingCash)"></i></div><b>{{ fmt(f.closingCash) }}</b></div>
          </section>
        </ng-container>

        <!-- HARDENING -->
        <ng-container *ngSwitchCase="'hardening'">
          <section class="split">
            <article class="panel">
              <h2>Production readiness</h2>
              <div class="ready" [class.on]="hardening()?.productionReady"><strong>{{ hardening()?.productionReady ? 'Certified' : 'Not certified' }}</strong><span>{{ hardening()?.productionReadinessReason }}</span></div>
              <div class="stage" *ngFor="let st of stages()"><span class="dot" [attr.data-state]="st.done ? (st.healthy ? 'ok' : 'warn') : 'pending'"></span><span class="st-label">Stage {{ st.stage }} · {{ st.label }}</span><span class="st-note muted small">{{ st.note }}</span></div>
            </article>
            <article class="panel">
              <h2>Controls</h2>
              <div class="ctl"><button class="solid" type="button" [disabled]="busy()" (click)="reconcile()">Run reconciliation</button><button class="ghost" type="button" [disabled]="busy()" (click)="processOutbox()">Process GL outbox</button></div>
              <div class="ctl"><input type="month" [ngModel]="lockMonth()" (ngModelChange)="lockMonth.set($event)" /><button class="ghost" type="button" [disabled]="busy() || !lockMonth()" (click)="closePeriod()">Lock period</button></div>
              <div class="recon" *ngIf="hardening()?.latestReconciliation as r">
                <div class="panel-head"><h3>Last check · {{ r.asOfDate }}</h3><span class="pill" [class.bad]="r.status !== 'ok'">{{ r.status }}</span></div>
                <div class="stage" *ngFor="let c of r.checks"><span class="dot" [attr.data-state]="c.ok ? 'ok' : (c.severity === 'critical' ? 'pending' : 'warn')"></span><span class="st-label">{{ c.label }}</span><span class="st-note muted small">{{ c.detail }}</span></div>
              </div>
            </article>
          </section>
        </ng-container>
      </ng-container>
    </section>
  `,
  styles: [`
    :host { --ink:#0f1b2d; --muted:#5b6b82; --line:#e3eaf3; --bg:#ffffff; --soft:#f5f9ff; --brand:#1d4ed8; --brandink:#152033; --good:#0f9d58; --warn:#e8910c; --bad:#d6453d; --asset:#1d4ed8; --liab:#e8910c; --equity:#0f9d58; }
    .bs { padding: 20px; display: grid; gap: 16px; color: var(--ink); font-feature-settings: "tnum" 1; }
    .masthead { display: grid; grid-template-columns: minmax(0,1fr) auto; gap: 18px; align-items: center; padding: 22px 24px; border: 1px solid var(--line); border-radius: 14px; background: linear-gradient(135deg, #f7faff, #ffffff 60%); }
    .kicker { text-transform: uppercase; letter-spacing: .14em; font-size: 11px; font-weight: 800; color: var(--brand); }
    h1 { margin: 6px 0 4px; font-size: 30px; letter-spacing: -.02em; }
    h2 { margin: 0 0 10px; font-size: 16px; }
    h3 { margin: 0; font-size: 13px; color: var(--muted); }
    .sub { margin: 0; color: var(--muted); max-width: 52ch; }
    .equation { display: flex; align-items: center; gap: 12px; padding: 14px 16px; border-radius: 12px; background: var(--soft); border: 1px solid var(--line); position: relative; }
    .equation.ok { box-shadow: inset 3px 0 0 var(--good); } .equation.bad { box-shadow: inset 3px 0 0 var(--bad); }
    .eq-cell { display: grid; gap: 2px; min-width: 96px; } .eq-cell span { font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: .06em; }
    .eq-cell strong { font-size: 18px; } .eq-op { font-size: 20px; color: var(--muted); font-weight: 700; }
    .eq-flag { position: absolute; top: -10px; right: 12px; font-size: 11px; font-weight: 800; padding: 2px 10px; border-radius: 999px; background: var(--good); color: #fff; }
    .equation.bad .eq-flag { background: var(--bad); }
    .controls { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
    .dates { display: flex; align-items: end; gap: 12px; } .spacer { flex: 1; }
    .presets { display: flex; gap: 6px; } .presets button { font-size: 12px; padding: 6px 10px; border-radius: 8px; border: 1px solid var(--line); background: #fff; cursor: pointer; }
    label { display: grid; gap: 4px; font-size: 11px; font-weight: 800; color: var(--muted); text-transform: uppercase; letter-spacing: .05em; }
    input, select { min-height: 40px; border: 1px solid #cdd9e8; border-radius: 9px; padding: 0 12px; font: inherit; background: #fff; color: var(--ink); }
    button { font: inherit; cursor: pointer; } button:disabled { opacity: .5; cursor: not-allowed; }
    .solid { min-height: 40px; padding: 0 16px; border-radius: 9px; border: 0; background: var(--brandink); color: #fff; font-weight: 800; }
    .solid.full, .full { width: 100%; } .ghost { min-height: 40px; padding: 0 14px; border-radius: 9px; border: 1px solid #cdd9e8; background: #fff; color: var(--brand); font-weight: 800; }
    .ready-chip { font-size: 12px; font-weight: 800; padding: 7px 12px; border-radius: 999px; background: #fff4e0; color: #9a6207; border: 1px solid #f3d9a6; }
    .ready-chip.on { background: #e6f7ee; color: #0a7a44; border-color: #b9e7cd; }
    .banner { margin: 0; padding: 10px 14px; border-radius: 10px; font-weight: 700; } .banner.err { background: #fdecea; color: #a4271f; } .banner.ok { background: #e7f7ee; color: #0a7a44; }
    .tabs { display: flex; gap: 6px; flex-wrap: wrap; border-bottom: 1px solid var(--line); padding-bottom: 2px; }
    .tabs button { padding: 9px 14px; border: 0; background: transparent; color: var(--muted); font-weight: 800; border-radius: 8px 8px 0 0; border-bottom: 2px solid transparent; }
    .tabs button.active { color: var(--brandink); border-bottom-color: var(--brand); background: var(--soft); }
    .loading, .empty { padding: 28px; text-align: center; color: var(--muted); border: 1px dashed var(--line); border-radius: 12px; background: var(--soft); }
    .cards { display: grid; grid-template-columns: repeat(4, minmax(0,1fr)); gap: 12px; }
    .card { border: 1px solid var(--line); border-radius: 12px; padding: 16px; background: #fff; display: grid; gap: 6px; align-content: start; }
    .card.wide { grid-column: span 3; } .card span { font-size: 12px; color: var(--muted); } .card strong { font-size: 24px; letter-spacing: -.01em; }
    .card.flag strong { color: var(--bad); }
    .split { display: grid; grid-template-columns: 1.3fr 1fr; gap: 12px; }
    .panel { border: 1px solid var(--line); border-radius: 12px; padding: 18px; background: #fff; }
    .panel-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
    .metric { display: flex; justify-content: space-between; padding: 11px 0; border-top: 1px solid var(--line); }
    .metric:first-of-type { border-top: 0; }
    .muted { color: var(--muted); } .small { font-size: 12px; }
    .bars { width: 100%; height: 130px; } .bar-label { font-size: 10px; fill: #fff; font-weight: 700; } .bar-value { font-size: 10px; fill: var(--ink); font-weight: 700; }
    .alert { display: grid; gap: 2px; padding: 11px 0; border-top: 1px solid var(--line); } .alert:first-of-type { border-top: 0; }
    .alert[data-sev='critical'] strong { color: var(--bad); } .alert[data-sev='warning'] strong { color: var(--warn); }
    .scroll { overflow: auto; } table { width: 100%; border-collapse: collapse; min-width: 640px; }
    th, td { text-align: left; padding: 10px 12px; border-bottom: 1px solid var(--line); font-size: 14px; } th { color: var(--muted); font-size: 12px; text-transform: uppercase; letter-spacing: .04em; }
    td.r, th.r { text-align: right; font-variant-numeric: tabular-nums; } tfoot td { font-weight: 800; border-top: 2px solid var(--ink); }
    .pill { font-size: 12px; font-weight: 800; padding: 4px 10px; border-radius: 999px; background: #e6f0ff; color: var(--brand); } .pill.bad { background: #fdecea; color: var(--bad); } .pill.done { background: #e7f7ee; color: var(--good); }
    .row-controls, .form-row, .ctl, .inline-run { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; margin-bottom: 12px; } .inline-run { margin: 0; } .inline-run input { min-width: 0; flex: 1; }
    .cc-rows { display: grid; gap: 10px; } .cc-row { display: grid; grid-template-columns: 160px 1fr 120px; gap: 12px; align-items: center; }
    .cc-name { display: flex; flex-direction: column; } .tag { font-size: 11px; color: var(--muted); } .cc-bar { height: 14px; background: var(--soft); border-radius: 999px; overflow: hidden; }
    .cc-bar .fill { height: 100%; background: var(--equity); border-radius: 999px; } .cc-bar .fill.neg, .cc-val.neg { background: var(--bad); color: var(--bad); } .cc-val { text-align: right; font-weight: 800; font-variant-numeric: tabular-nums; }
    .prog { height: 8px; background: var(--soft); border-radius: 999px; overflow: hidden; margin-bottom: 4px; } .prog-fill { height: 100%; background: var(--brand); }
    .stack { display: flex; height: 26px; border-radius: 8px; overflow: hidden; margin-bottom: 12px; background: var(--soft); }
    .stack .seg { display: flex; align-items: center; justify-content: center; color: #fff; font-size: 11px; font-weight: 800; min-width: 0; overflow: hidden; white-space: nowrap; }
    .stack .seg.var { background: var(--liab); } .stack .seg.fix { background: var(--brand); }
    .warn-row strong { color: var(--warn); } .ticket { flex-direction: row; align-items: center; gap: 8px; } .ticket input { width: 130px; }
    .cockpit { display: grid; grid-template-columns: 320px 1fr; gap: 12px; }
    .score { display: grid; gap: 10px; align-content: start; }
    .gauge { width: 100%; max-width: 260px; margin: 0 auto; } .g-num { font-size: 34px; font-weight: 800; fill: var(--ink); } .g-band { font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: .08em; }
    .vitals { display: grid; gap: 8px; } .vital { display: grid; grid-template-columns: 120px 1fr; gap: 10px; align-items: center; font-size: 12px; color: var(--muted); font-weight: 700; }
    .vbar { height: 8px; background: var(--soft); border-radius: 999px; overflow: hidden; } .vfill { height: 100%; border-radius: 999px; }
    .advisor { display: grid; gap: 8px; align-content: start; }
    .insight { display: grid; gap: 3px; padding: 11px 12px; border-radius: 10px; background: var(--soft); border-left: 4px solid var(--muted); }
    .insight[data-sev='critical'] { background: #fdecea; border-left-color: var(--bad); } .insight[data-sev='warn'] { background: #fff7e8; border-left-color: var(--warn); } .insight[data-sev='ok'] { background: #e9f8f0; border-left-color: var(--good); }
    .insight strong { font-size: 13px; } .insight span { font-size: 13px; color: var(--ink); }
    .sliders { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 10px; }
    .sl { display: grid; gap: 8px; } .sl span { font-size: 13px; color: var(--ink); font-weight: 700; text-transform: none; letter-spacing: 0; } .sl b { color: var(--brand); }
    .sl input[type=range] { width: 100%; accent-color: var(--brand); }
    .cmp { display: grid; grid-template-columns: 1fr auto 18px auto auto; gap: 10px; align-items: center; padding: 10px 0; border-top: 1px solid var(--line); } .cmp:first-of-type { border-top: 0; }
    .cmp span:first-child { color: var(--muted); } .cmp b { font-variant-numeric: tabular-nums; } .cmp i { color: var(--muted); font-style: normal; }
    .up { color: var(--good); } .down, .neg { color: var(--bad); }
    .sim-note { margin: 12px 0 0; padding: 10px 12px; border-radius: 10px; background: var(--soft); font-weight: 700; }
    .ready { display: grid; gap: 4px; padding: 12px; border-radius: 10px; background: #fff8ec; border: 1px solid #f3e0bb; margin-bottom: 12px; } .ready.on { background: #e9f8f0; border-color: #c2e9d4; }
    .breakeven { border-top: 3px solid var(--good); } .breakeven.below { border-top-color: var(--bad); }
    .be-number { font-size: 34px; font-weight: 800; letter-spacing: -.02em; margin: 4px 0 10px; }
    .be-bar { width: 100%; height: 28px; margin-bottom: 12px; }
    .be-note { margin: 10px 0 0; font-size: 13px; font-weight: 700; color: var(--bad); } .be-note.good { color: var(--good); }
    .neg { color: var(--bad); }
    .form-col { display: grid; gap: 10px; } .form-col input, .form-col select, .form-col button { width: 100%; }
    .cost-line { display: flex; justify-content: space-between; padding: 10px 0; border-top: 1px solid var(--line); } .cost-line:first-of-type { border-top: 0; }
    .cost-line.salary { font-weight: 700; } .cost-line .tag { color: var(--brand); font-weight: 800; }
    .stage { display: grid; grid-template-columns: 16px 1fr auto; gap: 10px; align-items: center; padding: 9px 0; border-top: 1px solid var(--line); } .stage:first-of-type { border-top: 0; }
    .dot { width: 10px; height: 10px; border-radius: 50%; } .dot[data-state='ok'] { background: var(--good); } .dot[data-state='warn'] { background: var(--warn); } .dot[data-state='pending'] { background: var(--bad); }
    .st-label { font-weight: 700; font-size: 13px; } .recon { margin-top: 14px; border-top: 1px dashed var(--line); padding-top: 12px; }

    .drill-tree { display: grid; gap: 6px; }
    .drill-row { width: 100%; min-height: 46px; border: 1px solid var(--line); background: #fff; border-radius: 10px; display: flex; justify-content: space-between; align-items: center; text-align: left; }
    .drill-row:hover { background: var(--soft); } .drill-row.child { background: #fbfdff; }
    .drill-row span { display: grid; gap: 2px; } .drill-row small { color: var(--muted); font-size: 11px; text-transform: uppercase; letter-spacing: .06em; }
    .line-chart { width: 100%; height: 190px; background: linear-gradient(#fff, var(--soft)); border: 1px solid var(--line); border-radius: 12px; }
    .legend { display: flex; gap: 14px; margin-top: 10px; color: var(--muted); font-size: 12px; font-weight: 800; } .legend i { display: inline-block; width: 10px; height: 10px; border-radius: 50%; margin-right: 6px; }
    .brand-dot { background: var(--brand); } .good-dot { background: var(--good); }
    .donut { width: 170px; height: 170px; border-radius: 50%; margin: 14px auto; display: grid; place-items: center; }
    .donut span { width: 96px; height: 96px; border-radius: 50%; background: #fff; display: grid; place-items: center; font-size: 24px; font-weight: 900; }
    .ai-card { display: grid; gap: 5px; padding: 13px 14px; border-radius: 12px; margin-bottom: 10px; border-left: 4px solid var(--good); background: #e9f8f0; }
    .ai-card[data-sev='warn'] { border-left-color: var(--warn); background: #fff7e8; } .ai-card[data-sev='critical'] { border-left-color: var(--bad); background: #fdecea; }
    .ai-card em { color: var(--brandink); font-style: normal; font-size: 12px; font-weight: 800; }
    .forecast-grid { display: grid; grid-template-columns: repeat(6, minmax(0,1fr)); gap: 10px; }
    .forecast-card { border: 1px solid var(--line); border-radius: 12px; padding: 12px; display: grid; gap: 5px; background: var(--soft); }
    .forecast-card span { color: var(--muted); font-size: 12px; font-weight: 800; } .forecast-card b { font-size: 20px; } .forecast-card small { color: var(--muted); }
    .cash-row { display: grid; grid-template-columns: 90px 1fr 120px; gap: 12px; align-items: center; padding: 10px 0; border-top: 1px solid var(--line); }
    .cash-row:first-of-type { border-top: 0; } .cash-row div { height: 12px; border-radius: 999px; background: var(--soft); overflow: hidden; } .cash-row i { display: block; height: 100%; background: var(--good); border-radius: 999px; }
    .ledger-master-grid { grid-template-columns: 1fr 1fr; }
    .ledger-suggestion { display: grid; gap: 4px; padding: 12px; border-radius: 12px; background: #e9f8f0; border-left: 4px solid var(--good); }
    .ledger-suggestion[data-sev='warn'] { background: #fff7e8; border-left-color: var(--warn); }
    .ledger-suggestion small, .ledger-preview small { color: var(--muted); }
    .ledger-preview { display: grid; gap: 3px; padding: 11px 0; border-top: 1px solid var(--line); }
    .ledger-preview:first-of-type { border-top: 0; }
    .manual-entry .panel-head { align-items: flex-start; gap: 12px; }
    .manual-entry .panel-head p { margin: 4px 0 0; }
    .manual-grid { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 12px; margin-bottom: 14px; }
    .manual-grid .wide { grid-column: 1 / -1; }

    @media (max-width: 920px) { .masthead, .split { grid-template-columns: 1fr; } .cards { grid-template-columns: repeat(2,1fr); } .card.wide { grid-column: span 2; } .cc-row { grid-template-columns: 1fr; } .cockpit { grid-template-columns: 1fr; } .sliders, .manual-grid { grid-template-columns: 1fr; } .forecast-grid { grid-template-columns: repeat(2,1fr); } .vital { grid-template-columns: 110px 1fr; } }
    @media print { .controls, .tabs, .ghost, .solid, .row-controls, .form-row, .ctl { display: none !important; } .panel, .card, .masthead { break-inside: avoid; } }
    @media (prefers-reduced-motion: no-preference) { .prog-fill, .cc-bar .fill { transition: width .4s ease; } }
    button:focus-visible, input:focus-visible, select:focus-visible { outline: 2px solid var(--brand); outline-offset: 2px; }
  `]
})
export class BalanceSheetComponent implements OnInit {
  readonly tabs = [
    { key: 'overview', label: 'Overview' },
    { key: 'working', label: 'Working Capital' },
    { key: 'ledger', label: 'Ledger' },
    { key: 'ledgerMaster', label: 'Ledger Master' },
    { key: 'manual', label: 'Manual Entry' },
    { key: 'centers', label: 'Cost Centers' },
    { key: 'deferred', label: 'Deferred Revenue' },
    { key: 'assets', label: 'Fixed Assets' },
    { key: 'costs', label: 'Cost Structure' },
    { key: 'simulator', label: 'Simulator' },
    { key: 'drilldown', label: 'Tally Drill Down' },
    { key: 'ai', label: 'AI Ledger Suggestions' },
    { key: 'hardening', label: 'Hardening' }
  ];
  tab = signal('overview');
  asOfDate = signal(new Date().toISOString().slice(0, 10));
  loading = signal(false);
  busy = signal(false);
  error = signal('');
  message = signal('');

  sheet = signal<BalanceSheet | null>(null);
  trial = signal<TrialBalance | null>(null);
  hardening = signal<HardeningStatus | null>(null);
  pnl = signal<CostCenterPnl | null>(null);
  deferred = signal<DeferredList | null>(null);
  assets = signal<AssetRegister | null>(null);
  costs = signal<CostStructure | null>(null);
  dailyOps = signal<DailyOperations | null>(null);
  financeOs = signal<FinanceOs | null>(null);
  posGlSync = signal<PosGlSyncResult | null>(null);
  inventoryCogsSync = signal<InventoryCogsSyncResult | null>(null);
  dailyAccruals = signal<DailyAccrualResult | null>(null);
  monthCloseAutomation = signal<MonthCloseAutomationResult | null>(null);
  ownerDailyCloseResult = signal<OwnerDailyCloseResult | null>(null);
  copilotQuestion = signal('Aaj profit kam kyu hai?');
  copilotAnswer = signal<CopilotAnswer | null>(null);
  ledgerRows = signal<any[]>([]);

  avgTicket = signal(500);
  simPrice = signal(0); simVolume = signal(0); simProduct = signal(0); simFixed = signal(0);
  ledgerAccount = signal('');
  ccCode = signal(''); ccName = signal(''); ccType = signal('chair');
  depMonth = signal(new Date().toISOString().slice(0, 7));
  lockMonth = signal(new Date().toISOString().slice(0, 7));
  expandedDrill = signal<Record<string, boolean>>({ assets: true, liabilities: true, equity: true });
  readonly tallyGroups = TALLY_STYLE_GROUPS;
  ledgerDraftName = signal('');
  ledgerDraftGroup = signal('Suspense / Review Required');
  ledgerDraftSide = signal<LedgerSide>('unknown');
  ledgerManualOverride = signal(false);
  ledgerDrafts = signal<Array<{ name: string; group: string; side: LedgerSide; confidence: number; hint: string }>>([]);
  manualType = signal<'rent' | 'salary' | 'opening' | 'custom'>('rent');
  manualDate = signal(new Date().toISOString().slice(0, 10));
  manualAmount = signal(0);
  manualCreditCode = signal('1010');
  manualDebitCode = signal('1000');
  manualMemo = signal('');
  customDebitAccountId = signal('');
  customCreditAccountId = signal('');
  assetCode = signal('');
  assetName = signal('');
  assetCategory = signal('equipment');
  assetDate = signal(new Date().toISOString().slice(0, 10));
  assetCost = signal(0);
  assetPaymentMode = signal<'bank' | 'cash' | 'payable'>('bank');
  assetLifeMonths = signal(60);



  stages = computed(() => this.hardening()?.stages ?? []);

  healthScore = computed(() => {
    const s = this.sheet(); const c = this.costs(); const h = this.hardening();
    if (!s || !c) return null;
    const wc = s.workingCapital;
    const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));
    const liquidity = wc.currentRatio == null ? 50 : clamp(wc.currentRatio >= 2 ? 100 : wc.currentRatio * 50);
    const margin = c.revenue > 0 ? (c.netProfit / c.revenue) * 100 : 0;
    const profitability = clamp(margin >= 20 ? 100 : margin <= 0 ? Math.max(0, 40 + margin * 4) : 40 + (margin / 20) * 60);
    const salaryPct = c.salaryToRevenuePct ?? 0;
    const costDiscipline = clamp(salaryPct <= 30 ? 100 : salaryPct >= 55 ? 20 : 100 - ((salaryPct - 30) / 25) * 80);
    const mos = c.marginOfSafetyPct ?? 0;
    const breakEvenSafety = clamp(mos >= 30 ? 100 : mos <= 0 ? Math.max(0, 30 + mos) : 30 + (mos / 30) * 70);
    const equityShare = s.totals.assets > 0 ? (s.totals.equity / s.totals.assets) * 100 : 0;
    const solvency = clamp(equityShare >= 50 ? 100 : Math.max(0, equityShare * 2));
    const controls = h ? (h.latestReconciliation ? (h.latestReconciliation.status === 'ok' ? 100 : h.latestReconciliation.status === 'warning' ? 60 : 25) : 40) : 40;
    const parts = [
      { label: 'Profitability', score: profitability },
      { label: 'Liquidity', score: liquidity },
      { label: 'Cost discipline', score: costDiscipline },
      { label: 'Break-even safety', score: breakEvenSafety },
      { label: 'Solvency', score: solvency },
      { label: 'Controls', score: controls }
    ];
    const overall = clamp(parts.reduce((a, p) => a + p.score, 0) / parts.length);
    const band = overall >= 80 ? 'Excellent' : overall >= 65 ? 'Strong' : overall >= 50 ? 'Watch' : 'At risk';
    return { overall, band, parts };
  });

  insights = computed(() => {
    const s = this.sheet(); const c = this.costs(); const h = this.hardening(); const d = this.deferred();
    if (!s || !c) return [];
    const wc = s.workingCapital; const inr = (n: number) => '₹' + Math.round(n).toLocaleString('en-IN');
    const out: Array<{ severity: string; title: string; text: string }> = [];
    if ((c.salaryToRevenuePct ?? 0) > 40) out.push({ severity: 'warn', title: 'Salary cost zyada hai', text: `Salary revenue ka ${c.salaryToRevenuePct}% hai. Healthy salon me 30-35% hota hai — per-chair productivity (Cost Centers) ya pricing review karo.` });
    if (wc.cashRunwayDays != null && wc.cashRunwayDays < 30) out.push({ severity: 'critical', title: 'Cash runway kam', text: `Sirf ${wc.cashRunwayDays} din ka cash. Pending collections chase karo aur non-essential kharche rok do.` });
    if (c.netProfit < 0) out.push({ severity: 'critical', title: 'Break-even ke neeche', text: `Is period me ${inr(Math.abs(c.netProfit))} ka loss. Break-even ke liye ${c.breakEvenClients ?? '—'} clients/month chahiye.` });
    else if ((c.marginOfSafetyPct ?? 100) < 10) out.push({ severity: 'warn', title: 'Patli profit cushion', text: `Margin of safety sirf ${c.marginOfSafetyPct}%. Thodi si sales giri to loss me aa sakte ho — Simulator me dekh lo.` });
    if (wc.currentRatio != null && wc.currentRatio < 1) out.push({ severity: 'warn', title: 'Short-term liquidity tight', text: `Current ratio ${wc.currentRatio}. Current liabilities current assets se zyada — payment timing manage karo.` });
    if (d && d.deferredLiability > 0 && d.deferredLiability > (wc.currentAssets || 0)) out.push({ severity: 'warn', title: 'Unearned revenue exposure', text: `${inr(d.deferredLiability)} ke prepaid packages/memberships ki service abhi deni baaki hai — ye cash already kharch mat samjho.` });
    if (h && (!h.latestReconciliation || h.latestReconciliation.status !== 'ok')) out.push({ severity: 'warn', title: 'Books reconcile nahi hue', text: 'Hardening tab me Run reconciliation chalao taaki numbers production-grade ho.' });
    if (!out.length) out.push({ severity: 'ok', title: 'Sab healthy', text: 'Koi red flag nahi — numbers solid hain. Aise hi maintain karo.' });
    return out.slice(0, 5);
  });


  drillTree = computed<DrillNode[]>(() => {
    const s = this.sheet(); const t = this.trial();
    if (!s) return [];
    const rows = t?.rows || [];
    const makeChildren = (section: 'assets' | 'liabilities' | 'equity', level: number) =>
      s.sections[section].map((g) => ({
        id: `${section}:${g.code}`,
        label: `${g.code} · ${g.name}`,
        type: 'group' as const,
        amount: g.balance,
        level,
        children: rows.filter((r) => r.code === g.code || r.accountType.toLowerCase().includes(section.slice(0, -1))).slice(0, 12).map((r) => ({
          id: r.accountId,
          label: `${r.code} · ${r.name}`,
          type: 'ledger' as const,
          amount: r.balance,
          level: level + 1
        }))
      }));
    return [
      { id: 'assets', label: 'Assets', type: 'root', amount: s.totals.assets, level: 0, children: makeChildren('assets', 1) },
      { id: 'liabilities', label: 'Liabilities', type: 'root', amount: s.totals.liabilities, level: 0, children: makeChildren('liabilities', 1) },
      { id: 'equity', label: 'Equity', type: 'root', amount: s.totals.equity, level: 0, children: makeChildren('equity', 1) }
    ];
  });

  executiveDashboard = computed(() => {
    const s = this.sheet(); const c = this.costs(); const hs = this.healthScore();
    if (!s || !c || !hs) return null;
    const equity = Math.max(1, Math.abs(s.totals.equity));
    const debtToEquity = Math.round((s.totals.liabilities / equity) * 100) / 100;
    const netMarginPct = c.revenue > 0 ? Math.round((c.netProfit / c.revenue) * 1000) / 10 : 0;
    const equitySharePct = s.totals.assets > 0 ? Math.round((s.totals.equity / s.totals.assets) * 100) : 0;
    const status = hs.overall >= 80 ? 'Excellent' : hs.overall >= 65 ? 'Good' : hs.overall >= 50 ? 'Needs watch' : 'High risk';
    return { score: hs.overall, status, debtToEquity, netMarginPct, equitySharePct, cashRunwayDays: s.workingCapital.cashRunwayDays };
  });

  graphData = computed<GraphPoint[]>(() => {
    const c = this.costs(); const cash = this.sheet()?.workingCapital.currentAssets || 0;
    if (!c) return [];
    const baseRevenue = c.revenue || 0; const baseProfit = c.netProfit || 0;
    return ['M-5', 'M-4', 'M-3', 'M-2', 'M-1', 'Now'].map((label, i) => {
      const factor = 0.72 + i * 0.056;
      return { label, revenue: Math.round(baseRevenue * factor), profit: Math.round(baseProfit * factor), cash: Math.round(cash * factor) };
    });
  });

  advancedAiInsights = computed<AiInsight[]>(() => {
    const s = this.sheet(); const c = this.costs(); const d = this.executiveDashboard();
    if (!s || !c || !d) return [];
    const out: AiInsight[] = [];
    const inventory = s.sections.assets.find((x) => /inventory|stock/i.test(x.name))?.balance || 0;
    const inventoryPct = s.totals.assets > 0 ? Math.round((inventory / s.totals.assets) * 1000) / 10 : 0;
    if (inventory > 0) out.push({ severity: inventoryPct > 45 ? 'warn' : 'ok', title: 'Inventory analysis', text: `Inventory assets ka ${inventoryPct}% hai.`, action: inventoryPct > 45 ? 'Inventory slow-moving hai kya check karo aur dead stock reduce karo.' : 'Inventory level controlled dikh raha hai.' });
    const currentRatio = s.workingCapital.currentRatio ?? 0;
    out.push({ severity: currentRatio >= 1.5 ? 'ok' : currentRatio >= 1 ? 'warn' : 'critical', title: 'Current ratio', text: currentRatio >= 1.5 ? `Current Ratio healthy hai (${currentRatio}).` : `Current Ratio weak/tight hai (${currentRatio}).`, action: currentRatio >= 1.5 ? 'Payment cycle normal maintain karo.' : 'Receivables fast collect karo aur short-term payments schedule karo.' });
    const debtText = d.debtToEquity < 1 ? 'Debt level medium hai' : d.debtToEquity < 2 ? 'Debt level watch par hai' : 'Debt level high hai';
    out.push({ severity: d.debtToEquity < 1 ? 'ok' : d.debtToEquity < 2 ? 'warn' : 'critical', title: 'Debt level', text: `${debtText}. Debt-to-equity ${d.debtToEquity} hai.`, action: d.debtToEquity < 1 ? 'Leverage comfortable hai.' : 'Debt repayment plan aur owner capital options dekho.' });
    if (d.netMarginPct < 8) out.push({ severity: 'warn', title: 'Net margin low', text: `Net margin ${d.netMarginPct}% hai. Profit cushion patla hai.`, action: 'Top expenses reclassify karo aur high-margin services push karo.' });
    if ((s.workingCapital.cashRunwayDays ?? 999) < 45) out.push({ severity: 'critical', title: 'Cash runway alert', text: `${s.workingCapital.cashRunwayDays} days cash runway hai.`, action: '30-day collection drive aur non-essential purchases hold karo.' });
    if ((c.salaryToRevenuePct ?? 0) > 35) out.push({ severity: 'warn', title: 'Salary productivity check', text: `Salary revenue ka ${c.salaryToRevenuePct}% consume kar rahi hai.`, action: 'Per-chair revenue dashboard se low productivity slots identify karo.' });
    if (s.balanced && out.length <= 3) out.push({ severity: 'ok', title: 'Finance engine healthy', text: 'Balance sheet balanced hai aur major accounting equation red flag nahi dikh raha.', action: 'Forecast tab me next 12 months monitor karte raho.' });
    return out;
  });

  forecast = computed<ForecastPoint[]>(() => {
    const c = this.costs(); const s = this.sheet();
    if (!c || !s) return [];
    const assetGrowth = c.netProfit >= 0 ? 0.025 : 0.008;
    const liabilityGrowth = c.netProfit >= 0 ? 0.01 : 0.018;
    const monthlyInflowBase = Math.max(0, c.revenue || s.workingCapital.currentAssets * 0.12);
    const monthlyOutflowBase = Math.max(0, (c.variableCost + c.fixedCost) || s.workingCapital.currentLiabilities * 0.18);
    let closingCash = s.sections.assets.find((x) => /cash|bank/i.test(x.name))?.balance || Math.round(s.workingCapital.currentAssets * 0.25);
    return Array.from({ length: 12 }, (_, i) => {
      const date = new Date(this.asOfDate()); date.setMonth(date.getMonth() + i + 1);
      const month = date.toLocaleString('en-IN', { month: 'short', year: '2-digit' });
      const assets = Math.round(s.totals.assets * Math.pow(1 + assetGrowth, i + 1));
      const liabilities = Math.round(s.totals.liabilities * Math.pow(1 + liabilityGrowth, i + 1));
      const netWorth = assets - liabilities;
      const expectedInflow = Math.round(monthlyInflowBase * Math.pow(1 + assetGrowth, i + 1));
      const expectedOutflow = Math.round(monthlyOutflowBase * Math.pow(1 + liabilityGrowth, i + 1));
      closingCash += expectedInflow - expectedOutflow;
      return { month, assets, liabilities, netWorth, expectedInflow, expectedOutflow, closingCash: Math.round(closingCash) };
    });
  });

  cashPrediction = computed(() => {
    const s = this.sheet(); const f = this.forecast();
    if (!s || !f.length) return null;
    const first = f[0];
    const monthlyBurn = Math.max(1, first.expectedOutflow - first.expectedInflow);
    const cashNow = s.sections.assets.find((x) => /cash|bank/i.test(x.name))?.balance || Math.round(s.workingCapital.currentAssets * 0.25);
    const runwayDays = first.expectedInflow >= first.expectedOutflow ? 999 : Math.max(0, Math.floor((cashNow / monthlyBurn) * 30));
    const firstNegative = f.find((x) => x.closingCash < 0);
    const risk = firstNegative ? 'High' : runwayDays < 60 ? 'Medium' : 'Low';
    return { expectedInflow: first.expectedInflow, expectedOutflow: first.expectedOutflow, closingCash: first.closingCash, runwayDays, risk, actionDate: firstNegative ? firstNegative.month : 'No urgent gap' };
  });

  ledgerSuggestion = computed<LedgerGroupingSuggestion>(() => this.suggestLedgerGrouping(this.ledgerDraftName()));

  ledgerMappingRows = computed(() => Object.entries(LEDGER_GROUPING).map(([ledger, v]) => ({
    ledger: ledger.replace(/\b\w/g, (m) => m.toUpperCase()),
    group: v.group,
    side: v.side,
    hint: v.hint
  })));

  suggestLedgerGrouping(name: string): LedgerGroupingSuggestion {
    const key = this.normalLedgerKey(name);
    if (!key) return { group: 'Suspense / Review Required', side: 'unknown', hint: 'Ledger name type karo to suggestion aayega.', confidence: 0, source: 'review' };
    if (LEDGER_GROUPING[key]) return LEDGER_GROUPING[key];

    const smartRules: Array<{ test: RegExp; group: string; side: LedgerSide; hint: string }> = [
      { test: /(salary|wage|staff|employee|payroll)/, group: 'Indirect Expenses', side: 'expense', hint: 'Staff/payroll related expense pattern detected.' },
      { test: /(rent|electric|telephone|internet|repair|maintenance|legal|audit|bank charge|advert|travel|stationery|expense)/, group: 'Indirect Expenses', side: 'expense', hint: 'Administrative/office expense pattern detected.' },
      { test: /(hair|service|treatment|beauty|salon).*(expense|cost)/, group: 'Indirect Expenses', side: 'expense', hint: 'Service business expense detected. Review recommended.' },
      { test: /(furniture|vehicle|machinery|equipment|computer|fixture|building|property|goodwill|patent)/, group: 'Fixed Asset', side: 'asset', hint: 'Asset-like ledger name detected.' },
      { test: /(cash)/, group: 'Cash In Hand', side: 'asset', hint: 'Cash ledger pattern detected.' },
      { test: /(bank|upi|current account|saving account)/, group: 'Bank Account', side: 'asset', hint: 'Bank ledger pattern detected. If overdraft, choose Bank OD manually.' },
      { test: /(debtor|receivable|customer)/, group: 'Sundry Debtors', side: 'asset', hint: 'Customer receivable pattern detected.' },
      { test: /(creditor|payable|vendor|supplier)/, group: 'Sundry Creditors', side: 'liability', hint: 'Vendor payable pattern detected.' },
      { test: /(loan|mortgage|borrow)/, group: 'Loan Liabilities', side: 'liability', hint: 'Borrowing/loan pattern detected.' },
      { test: /(capital|owner)/, group: 'Capital Account', side: 'capital', hint: 'Owner capital pattern detected.' },
      { test: /(drawing|withdrawal)/, group: 'Capital Account', side: 'capital', hint: 'Owner withdrawal pattern detected.' },
      { test: /(income|commission|interest received|rent received|discount received|dividend)/, group: 'Indirect Income', side: 'income', hint: 'Other income pattern detected.' },
      { test: /(stock|inventory)/, group: 'Stock In Hand', side: 'asset', hint: 'Inventory/stock pattern detected.' }
    ];

    const match = smartRules.find((r) => r.test.test(key));
    if (match) return { ...match, confidence: 65, source: 'smart' };
    return { group: 'Suspense / Review Required', side: 'unknown', hint: 'Mapping nahi mila. Manual group select karo.', confidence: 0, source: 'review' };
  }

  private normalLedgerKey(name: string): string {
    return String(name || '').trim().toLowerCase().replace(/\s+/g, ' ');
  }

  onLedgerDraftName(name: string): void {
    this.ledgerDraftName.set(name);
    if (this.ledgerManualOverride()) return;
    const sg = this.suggestLedgerGrouping(name);
    this.ledgerDraftGroup.set(sg.group);
    this.ledgerDraftSide.set(sg.side);
  }

  resetLedgerDraft(): void {
    this.ledgerDraftName.set('');
    this.ledgerDraftGroup.set('Suspense / Review Required');
    this.ledgerDraftSide.set('unknown');
    this.ledgerManualOverride.set(false);
  }

  addLedgerDraft(): void {
    const name = this.ledgerDraftName().trim();
    if (!name) return;
    const sg = this.suggestLedgerGrouping(name);
    this.ledgerDrafts.update((rows) => [{
      name,
      group: this.ledgerDraftGroup(),
      side: this.ledgerDraftSide(),
      confidence: this.ledgerManualOverride() ? Math.max(50, sg.confidence) : sg.confidence,
      hint: this.ledgerManualOverride() ? 'Manual override applied.' : sg.hint
    }, ...rows].slice(0, 20));
    this.resetLedgerDraft();
  }

  simResult = computed(() => {
    const c = this.costs(); if (!c) return null;
    const price = this.simPrice() / 100, vol = this.simVolume() / 100, prod = this.simProduct() / 100;
    const fixedDelta = Number(this.simFixed()) || 0;
    const revenue = c.revenue * (1 + price) * (1 + vol);
    const variable = c.variableCost * (1 + vol) * (1 + prod);
    const fixed = c.fixedCost + fixedDelta;
    const cm = revenue - variable; const cmRatio = revenue > 0 ? cm / revenue : 0;
    const breakEven = cmRatio > 0 ? fixed / cmRatio : null;
    const net = cm - fixed;
    const avgTicket = this.avgTicket() * (1 + price);
    const beClients = breakEven !== null && avgTicket > 0 ? Math.ceil(breakEven / avgTicket) : null;
    return { revenue, variable, fixed, cm, cmRatioPct: Math.round(cmRatio * 1000) / 10, breakEven, net, beClients, deltaNet: net - c.netProfit };
  });

  simNote = computed(() => {
    const c = this.costs(); const r = this.simResult();
    if (!c || !r) return '';
    if (r.deltaNet > 0) return `Ye changes profit ${'₹' + Math.round(r.deltaNet).toLocaleString('en-IN')} badha denge.`;
    if (r.deltaNet < 0) return `Ye changes profit ${'₹' + Math.round(Math.abs(r.deltaNet)).toLocaleString('en-IN')} ghata denge — soch ke chalo.`;
    return 'Sliders hilao to profit, break-even aur clients live update honge.';
  });

  compositionBars = computed(() => {
    const s = this.sheet();
    if (!s) return [];
    const max = Math.max(1, s.totals.assets, s.totals.liabilities + s.totals.equity);
    const w = (v: number) => Math.max(2, Math.round((v / max) * 320));
    return [
      { label: 'Assets', value: s.totals.assets, width: w(s.totals.assets), color: 'var(--asset)' },
      { label: 'Liabilities', value: s.totals.liabilities, width: w(s.totals.liabilities), color: 'var(--liab)' },
      { label: 'Equity', value: s.totals.equity, width: w(s.totals.equity), color: 'var(--equity)' }
    ];
  });


  onDrill(node: DrillNode): void {
    if (node.children?.length) {
      this.expandedDrill.update((m) => ({ ...m, [node.id]: !m[node.id] }));
      return;
    }
    if (node.type === 'ledger') {
      this.ledgerAccount.set(node.id);
      this.tab.set('ledger');
      this.loadLedger();
    }
  }

  linePoints(key: 'revenue' | 'profit' | 'cash'): string {
    const data = this.graphData(); if (!data.length) return '';
    const vals = data.map((d) => d[key]);
    const min = Math.min(0, ...vals), max = Math.max(1, ...vals);
    return data.map((d, i) => {
      const x = 20 + i * (380 / Math.max(1, data.length - 1));
      const y = 160 - ((d[key] - min) / (max - min || 1)) * 130;
      return `${x},${y}`;
    }).join(' ');
  }

  donutGradient(): string {
    const pct = Math.max(0, Math.min(100, this.executiveDashboard()?.equitySharePct ?? 0));
    return `conic-gradient(var(--good) 0 ${pct}%, var(--liab) ${pct}% 100%)`;
  }

  cashBarWidth(v: number): number {
    const max = Math.max(1, ...this.forecast().map((x) => Math.abs(x.closingCash)));
    return Math.max(2, Math.round((Math.max(0, v) / max) * 100));
  }

  constructor(private readonly api: ApiService) {}
  ngOnInit(): void { this.load(); }

  fmt(v: number | null | undefined): string {
    const n = Number(v || 0);
    return '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 0 });
  }
  pct(part: number, whole: number): number { return whole ? Math.min(100, Math.round((part / whole) * 100)) : 0; }
  doneCount(rows: Array<{ done: boolean }>): number { return rows.filter((row) => row.done).length; }
  ccWidth(net: number): number {
    const max = Math.max(1, ...((this.pnl()?.costCenters || []).map((c) => Math.abs(c.netProfit))));
    return Math.max(3, Math.round((Math.abs(net) / max) * 100));
  }
  splitPct(part: number, c: CostStructure): number {
    const total = (c.variableCost || 0) + (c.fixedCost || 0);
    return total ? Math.round((part / total) * 100) : 0;
  }
  reclassify(accountCode: string, behavior: string): Promise<void> {
    return this.act(async () => firstValueFrom(this.api.post('balance-sheet/cost-classifications', { accountCode, behavior })), 'Cost reclassified.');
  }
  scoreColor(score: number): string {
    return score >= 80 ? 'var(--good)' : score >= 65 ? '#3b82f6' : score >= 50 ? 'var(--warn)' : 'var(--bad)';
  }
  resetSim(): void { this.simPrice.set(0); this.simVolume.set(0); this.simProduct.set(0); this.simFixed.set(0); }

  preset(kind: 'today' | 'month' | 'fy'): void {
    const now = new Date();
    if (kind === 'today') this.asOfDate.set(now.toISOString().slice(0, 10));
    if (kind === 'month') this.asOfDate.set(new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10));
    if (kind === 'fy') { const y = now.getMonth() >= 3 ? now.getFullYear() + 1 : now.getFullYear(); this.asOfDate.set(`${y}-03-31`); }
    this.load();
  }

  async load(): Promise<void> {
    try {
      this.loading.set(true); this.error.set('');
      const p = { asOfDate: this.asOfDate() };
      const [sheet, trial, hardening, pnl, deferred, assets, costs, dailyOps, financeOs] = await Promise.all([
        firstValueFrom(this.api.list<BalanceSheet>('balance-sheet/live', p)),
        firstValueFrom(this.api.list<TrialBalance>('balance-sheet/trial-balance', p)),
        firstValueFrom(this.api.list<HardeningStatus>('balance-sheet/hardening', {})),
        firstValueFrom(this.api.list<CostCenterPnl>('balance-sheet/dimensional-pnl', { toDate: this.asOfDate() })),
        firstValueFrom(this.api.list<DeferredList>('balance-sheet/deferred/schedules', {})),
        firstValueFrom(this.api.list<AssetRegister>('balance-sheet/assets', {})),
        firstValueFrom(this.api.list<CostStructure>('balance-sheet/cost-structure', { toDate: this.asOfDate(), avgTicketPaise: this.avgTicket() * 100 }).pipe(catchError(() => of(this.emptyCostStructure())))),
        firstValueFrom(this.api.list<DailyOperations>('balance-sheet/daily-operations', p).pipe(catchError(() => of(this.emptyDailyOperations())))),
        firstValueFrom(this.api.list<FinanceOs>('balance-sheet/finance-os', p).pipe(catchError(() => of(this.emptyFinanceOs()))))
      ]);
      this.sheet.set(sheet); this.trial.set(trial); this.hardening.set(hardening);
      this.pnl.set(pnl); this.deferred.set(deferred); this.assets.set(assets);
      this.costs.set(costs); this.dailyOps.set(dailyOps); this.financeOs.set(this.normalizeFinanceOs(financeOs));
    } catch (e: any) {
      this.error.set(this.api.errorText(e, 'Could not load the balance sheet. Check your connection and try Refresh.'));
    } finally { this.loading.set(false); }
  }

  async loadLedger(): Promise<void> {
    try {
      this.loading.set(true);
      const res = await firstValueFrom(this.api.list<any>('balance-sheet/ledger', { accountId: this.ledgerAccount(), toDate: this.asOfDate() }));
      this.ledgerRows.set(res?.rows || []);
    } catch (e: any) { this.error.set(this.api.errorText(e, 'Could not load ledger entries.')); }
    finally { this.loading.set(false); }
  }

  private emptyCostStructure(): CostStructure {
    return {
      fromDate: this.asOfDate(),
      toDate: this.asOfDate(),
      revenue: 0,
      variableCost: 0,
      fixedCost: 0,
      salaryCost: 0,
      contributionMargin: 0,
      contributionMarginRatioPct: 0,
      salaryToRevenuePct: null,
      breakEvenRevenue: null,
      breakEvenClients: null,
      netProfit: 0,
      marginOfSafetyPct: null,
      lines: []
    };
  }

  private emptyDailyOperations(): DailyOperations {
    return {
      businessDate: this.asOfDate(),
      invoiceCount: 0,
      sales: 0,
      paid: 0,
      discount: 0,
      gst: 0,
      productConsumption: 0,
      dailyRent: 0,
      salary: 0,
      commission: 0,
      directCost: 0,
      netAfterTrackedCost: 0,
      staff: [],
      products: []
    };
  }

  private emptyFinanceOs(): FinanceOs {
    const daily = this.emptyDailyOperations();
    return {
      asOfDate: this.asOfDate(),
      month: this.asOfDate().slice(0, 7),
      outgoingImpact: { total: 0, cash: 0, bank: 0, profitAfterOutgoing: 0, recent: [] },
      todayTimeline: [],
      ownerDailyClose: { ready: false, warnings: 0, checklist: [] },
      cashBankReconciliation: { cashCollection: 0, bankCollection: 0, cashOutgoing: 0, bankOutgoing: 0, expectedCash: 0, expectedBankNet: 0, paymentRows: 0, outgoingRows: 0 },
      expenseCategoryProfit: [],
      branchWiseBalanceSheet: [],
      invoiceDrilldown: [],
      gstPayableControl: { todayCollected: 0, monthEstimate: 0, postedOrQueued: 0, payablePaise: 0 },
      livePosToGl: { posSales: 0, glRevenue: 0, difference: 0, outboxPending: 0, outboxFailed: 0, outboxPosted: 0 },
      dailyProfit: { sales: 0, gst: 0, discount: 0, salary: 0, commission: 0, rent: 0, productConsumption: 0, netAfterTrackedCost: 0 },
      staffProfitability: daily.staff,
      serviceMargins: [],
      inventoryConsumption: { total: 0, products: [], wmaInventory: 0, glInventory: 0, difference: 0 },
      fixedCostAllocation: { dailyRent: 0, dailySalary: 0, fixedCostMonth: 0, salaryCostMonth: 0 },
      journalSuggestions: [{ severity: 'warn', title: 'Finance OS backend pending', text: 'Backend restart ke baad live 10-point report load hogi.', action: 'Backend restart karo aur Refresh dabao.' }],
      reconciliation: { posVsGlRevenueDifference: 0, inventoryDifference: 0, balanced: true, accountingEquationDifference: 0 },
      copilotPrompts: ['Aaj profit kam kyu hai?', 'Kaunsa staff profitable hai?', 'Kaunsa service loss me hai?', 'POS sale GL me post hui ya nahi?'],
      monthEndClose: {
        month: this.asOfDate().slice(0, 7),
        checklist: [
          { key: 'salary_accrual', label: 'Salary accrual', done: false, amount: 0 },
          { key: 'rent_accrual', label: 'Rent accrual', done: false, amount: 0 },
          { key: 'commission_accrual', label: 'Commission accrual', done: false, amount: 0 },
          { key: 'gst_payable', label: 'GST payable review', done: false, amount: 0 },
          { key: 'depreciation', label: 'Depreciation run', done: false, amount: 0 },
          { key: 'deferred_revenue', label: 'Deferred revenue recognition', done: false, amount: 0 }
        ]
      }
    };
  }

  private normalizeFinanceOs(value: Partial<FinanceOs> | null | undefined): FinanceOs {
    const fallback = this.emptyFinanceOs();
    const incoming = value || {};
    return {
      ...fallback,
      ...incoming,
      outgoingImpact: { ...fallback.outgoingImpact, ...(incoming.outgoingImpact || {}) },
      ownerDailyClose: { ...fallback.ownerDailyClose, ...(incoming.ownerDailyClose || {}) },
      cashBankReconciliation: { ...fallback.cashBankReconciliation, ...(incoming.cashBankReconciliation || {}) },
      gstPayableControl: { ...fallback.gstPayableControl, ...(incoming.gstPayableControl || {}) },
      livePosToGl: { ...fallback.livePosToGl, ...(incoming.livePosToGl || {}) },
      dailyProfit: { ...fallback.dailyProfit, ...(incoming.dailyProfit || {}) },
      inventoryConsumption: { ...fallback.inventoryConsumption, ...(incoming.inventoryConsumption || {}) },
      fixedCostAllocation: { ...fallback.fixedCostAllocation, ...(incoming.fixedCostAllocation || {}) },
      reconciliation: { ...fallback.reconciliation, ...(incoming.reconciliation || {}) },
      monthEndClose: { ...fallback.monthEndClose, ...(incoming.monthEndClose || {}) },
      todayTimeline: incoming.todayTimeline || fallback.todayTimeline,
      expenseCategoryProfit: incoming.expenseCategoryProfit || fallback.expenseCategoryProfit,
      branchWiseBalanceSheet: incoming.branchWiseBalanceSheet || fallback.branchWiseBalanceSheet,
      invoiceDrilldown: incoming.invoiceDrilldown || fallback.invoiceDrilldown,
      staffProfitability: incoming.staffProfitability || fallback.staffProfitability,
      serviceMargins: incoming.serviceMargins || fallback.serviceMargins,
      journalSuggestions: incoming.journalSuggestions || fallback.journalSuggestions,
      copilotPrompts: incoming.copilotPrompts || fallback.copilotPrompts
    };
  }

  private async act(fn: () => Promise<any>, ok: string): Promise<void> {
    try { this.busy.set(true); this.error.set(''); await fn(); this.message.set(ok); await this.load(); }
    catch (e: any) { this.error.set(this.api.errorText(e, 'That action could not be completed.')); }
    finally { this.busy.set(false); }
  }

  addCostCenter(): Promise<void> {
    return this.act(async () => {
      await firstValueFrom(this.api.post('balance-sheet/cost-centers', { code: this.ccCode(), name: this.ccName(), type: this.ccType() }));
      this.ccCode.set(''); this.ccName.set('');
    }, 'Cost center created.');
  }
  recognizeDue(): Promise<void> {
    return this.act(async () => firstValueFrom(this.api.post<any>('balance-sheet/deferred/recognize-due', { asOfDate: this.asOfDate() })), 'Due revenue recognized.');
  }
  runDepreciation(): Promise<void> {
    return this.act(async () => firstValueFrom(this.api.post<any>('balance-sheet/assets/depreciation/run', { period: this.depMonth() })), 'Depreciation posted for the period.');
  }
  reconcile(): Promise<void> {
    return this.act(async () => firstValueFrom(this.api.post<any>('balance-sheet/reconcile', { asOfDate: this.asOfDate() })), 'Reconciliation complete.');
  }
  processOutbox(): Promise<void> {
    return this.act(async () => firstValueFrom(this.api.post<any>('balance-sheet/outbox/process', {})), 'GL outbox processed.');
  }
  syncPosToGl(): Promise<void> {
    return this.act(async () => {
      const result = await firstValueFrom(this.api.post<PosGlSyncResult>('balance-sheet/pos-gl-sync', { asOfDate: this.asOfDate() }));
      this.posGlSync.set(result);
    }, 'POS invoices queued for GL sync.');
  }
  syncInventoryCogs(): Promise<void> {
    return this.act(async () => {
      const result = await firstValueFrom(this.api.post<InventoryCogsSyncResult>('balance-sheet/inventory-cogs-sync', { asOfDate: this.asOfDate() }));
      this.inventoryCogsSync.set(result);
    }, 'Inventory COGS queued for GL sync.');
  }
  postDailyAccruals(): Promise<void> {
    return this.act(async () => {
      const result = await firstValueFrom(this.api.post<DailyAccrualResult>('balance-sheet/daily-accruals', { asOfDate: this.asOfDate() }));
      this.dailyAccruals.set(result);
    }, 'Daily accrual journals posted.');
  }
  runMonthCloseAutomation(): Promise<void> {
    return this.act(async () => {
      const result = await firstValueFrom(this.api.post<MonthCloseAutomationResult>('balance-sheet/month-close-automation', { asOfDate: this.asOfDate(), period: this.lockMonth() }));
      this.monthCloseAutomation.set(result);
    }, 'Month close automation prepared.');
  }
  ownerDailyClose(): Promise<void> {
    return this.act(async () => {
      const result = await firstValueFrom(this.api.post<OwnerDailyCloseResult>('balance-sheet/owner-daily-close', { asOfDate: this.asOfDate() }));
      this.ownerDailyCloseResult.set(result);
    }, 'Owner daily close completed.');
  }
  askFinanceCopilot(): Promise<void> {
    return this.act(async () => {
      const answer = await firstValueFrom(this.api.post<CopilotAnswer>('balance-sheet/copilot', { question: this.copilotQuestion(), asOfDate: this.asOfDate() }));
      this.copilotAnswer.set(answer);
    }, 'Finance copilot answered.');
  }
  closePeriod(): Promise<void> {
    return this.act(async () => firstValueFrom(this.api.post<any>('balance-sheet/periods/close', { period: this.lockMonth() })), 'Period locked.');
  }

  reopenSelectedPeriod(): Promise<void> {
    const period = this.asOfDate().slice(0, 7);
    return this.act(async () => firstValueFrom(this.api.post<any>('balance-sheet/periods/reopen', {
      period,
      reason: `Manual finance entry needed for ${period}`
    })), `${period} period unlocked. Ab entry post karo.`);
  }

  postManualJournal(): Promise<void> {
    return this.act(async () => {
      const amountPaise = this.paise(this.manualAmount());
      if (amountPaise <= 0) throw new Error('Amount 0 se zyada hona chahiye.');
      const type = this.manualType();
      const sourceId = `${type}:${this.manualDate()}:${Date.now()}`;
      let debitAccountId = '';
      let creditAccountId = '';
      let memo = this.manualMemo().trim();
      if (type === 'rent') {
        debitAccountId = this.accountIdByCode('5200');
        creditAccountId = this.accountIdByCode(this.manualCreditCode());
        memo ||= 'Rent expense posted manually';
      } else if (type === 'salary') {
        debitAccountId = this.accountIdByCode('5100');
        creditAccountId = this.accountIdByCode(this.manualCreditCode());
        memo ||= 'Salary expense posted manually';
      } else if (type === 'opening') {
        debitAccountId = this.accountIdByCode(this.manualDebitCode());
        creditAccountId = this.accountIdByCode('3000');
        memo ||= 'Opening balance posted manually';
      } else {
        debitAccountId = this.customDebitAccountId();
        creditAccountId = this.customCreditAccountId();
        memo ||= 'Custom manual journal';
      }
      if (!debitAccountId || !creditAccountId) throw new Error('Debit aur credit ledger select karo.');
      if (debitAccountId === creditAccountId) throw new Error('Debit aur credit ledger same nahi ho sakte.');
      await firstValueFrom(this.api.post('balance-sheet/journals', {
        businessDate: this.manualDate(),
        sourceType: `manual.${type}`,
        sourceId,
        memo,
        lines: [
          { accountId: debitAccountId, debitPaise: amountPaise, memo },
          { accountId: creditAccountId, creditPaise: amountPaise, memo }
        ]
      }));
      this.manualAmount.set(0);
      this.manualMemo.set('');
    }, 'Manual entry posted. Live Balance Sheet refreshed.');
  }

  addFixedAsset(): Promise<void> {
    return this.act(async () => {
      const costPaise = this.paise(this.assetCost());
      const code = this.assetCode().trim();
      const name = this.assetName().trim();
      if (!code || !name) throw new Error('Asset code aur name required hai.');
      if (costPaise <= 0) throw new Error('Asset cost 0 se zyada hona chahiye.');
      await firstValueFrom(this.api.post('balance-sheet/assets', {
        code,
        name,
        category: this.assetCategory().trim() || 'equipment',
        acquisitionDate: this.assetDate(),
        costPaise,
        usefulLifeMonths: Math.max(1, Number(this.assetLifeMonths()) || 60),
        paymentMode: this.assetPaymentMode() === 'payable' ? 'bank' : this.assetPaymentMode(),
        settled: this.assetPaymentMode() !== 'payable'
      }));
      this.assetCode.set('');
      this.assetName.set('');
      this.assetCost.set(0);
    }, 'Fixed asset added. Live Balance Sheet refreshed.');
  }

  private paise(value: number): number {
    return Math.round(Number(value || 0) * 100);
  }

  private accountIdByCode(code: string): string {
    const account = (this.trial()?.rows || []).find((row: any) => row.code === code);
    if (!account?.accountId) throw new Error(`Ledger ${code} abhi load nahi hua. Refresh karo.`);
    return account.accountId;
  }

  print(): void { window.print(); }

  exportCsv(): void {
    const s = this.sheet();
    if (!s) return;
    const rows: string[][] = [['Section', 'Code', 'Account', 'Balance']];
    (['assets', 'liabilities', 'equity'] as const).forEach((sec) =>
      s.sections[sec].forEach((r) => rows.push([sec, r.code, r.name, String(r.balance)])));
    rows.push([], ['Totals', '', 'Assets', String(s.totals.assets)], ['', '', 'Liabilities', String(s.totals.liabilities)], ['', '', 'Equity', String(s.totals.equity)]);
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const a = document.createElement('a');
    a.href = url; a.download = `balance-sheet-${s.asOfDate}.csv`; a.click();
    URL.revokeObjectURL(url);
  }
}
