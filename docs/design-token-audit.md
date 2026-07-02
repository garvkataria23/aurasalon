# Design Token Audit - Phase 1

Date: 2026-07-02
Scope: frontend CSS foundation only. Backend, database, routes, and working pages were not changed.

## Root Cause

Aura shared UI components reference a broader `--aura-*` token contract than `src/styles.css` defined globally. The app also has three disconnected token sources:

- `--color-*` variables in `src/styles.css`, actively used by legacy pages.
- SCSS variables in `src/app/core/styles/_tokens.scss`, currently not wired into global runtime CSS variables.
- `--aura-*` variables used by shared Aura UI components, partially defined later in `src/styles.css` and missing many component primitives.

## Aura Variable Usage Searched

Searched `src/styles.css` and shared UI component styles/scripts for `--aura-*` usages. The active Aura token surface includes:

- Base surfaces: `--aura-bg`, `--aura-card`, `--aura-card-muted`, `--aura-card-surface-bg`, `--aura-border`, `--aura-text`, `--aura-muted`, `--aura-white`.
- Brand/status: `--aura-primary`, `--aura-primary-hover`, `--aura-primary-100`, `--aura-primary-600`, `--aura-primary-700`, `--aura-rose`, `--aura-success`, `--aura-warning`, `--aura-danger`, `--aura-info`.
- Status fills: `--aura-success-bg`, `--aura-warning-bg`, `--aura-danger-bg`, `--aura-info-bg`.
- Neutral scale: `--aura-gray-50` through `--aura-gray-900`.
- Type/spacing/radius: `--aura-font`, `--aura-fs-xs`, `--aura-fs-sm`, `--aura-fs-md`, `--aura-fs-lg`, `--aura-fs-xl`, `--aura-fw-medium`, `--aura-fw-semibold`, `--aura-lh-tight`, `--aura-space-1` through `--aura-space-6`, `--aura-radius-sm`, `--aura-radius-md`, `--aura-radius-lg`, `--aura-radius-full`.
- Component sizing: `--aura-h-button`, `--aura-h-button-sm`, `--aura-h-table-row`, `--aura-page-header-h`, `--aura-skeleton-cols`.
- Elevation/motion/layers: `--aura-shadow-xs`, `--aura-shadow-soft`, `--aura-shadow-card`, `--aura-shadow-lg`, `--aura-shadow-drawer`, `--aura-focus`, `--aura-transition-fast`, `--aura-transition-base`, `--aura-z-sticky`, `--aura-z-drawer`, `--aura-z-toast`.
- Existing scoped groups: `--aura-crm-*`, `--aura-overview-*`.

## Phase 1 Cleanup Applied

- Added missing `--aura-*` variables globally in `src/styles.css`.
- Bridged Aura brand, surface, text, border, and status tokens to the existing `--color-*` runtime variables.
- Added dark theme status, neutral, surface, shadow, and focus-safe Aura overrides.
- Added high-contrast Aura overrides with no shadows and explicit contrast-safe status fills.
- Added low-specificity base normalization for `aura-button`, `aura-badge`, `aura-table`, `aura-empty`, `aura-skeleton`, `aura-page-header`, and `aura-kpi-card`.
- Added a generic `.aura-card` class as a token-backed primitive for future incremental migrations. No pages were migrated in this phase.

## Not Changed

- No backend files.
- No database schema or migrations.
- No route removals.
- No working pages removed or redesigned.
- No global hiding or layout-reset hacks.
- No full card migration from legacy classes.

## Remaining Visual-System Risks

- `src/styles.css` remains monolithic and contains later legacy Aura/theme blocks that can still override earlier tokens by cascade order.
- Legacy card classes (`metric-card`, `action-card`, `booking-card`, `priority-card`, `app-metric-card`) still coexist and need page-by-page migration later.
- Icon consistency is not solved in Phase 1; emoji/text/inline SVG usage still needs component-level cleanup.
- `_tokens.scss` remains unused as a runtime source; future work should either generate CSS variables from it or deprecate it after migration approval.
