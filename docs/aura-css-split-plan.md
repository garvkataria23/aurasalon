# Aura CSS Split Plan

Date: 2026-07-02
Baseline: `src/styles.css` is approximately 360 KB raw in the current workspace. Angular currently loads only this file through `angular.json`.

## Decision

Do not split `src/styles.css` until high-volume card migrations reduce cascade risk. The split should be mechanical, ordered, and verified after each extraction.

## Target Layers

| Layer | Future File | Source Content | Gate |
| --- | --- | --- | --- |
| Tokens | `src/styles/tokens.css` | `:root`, dark theme, high-contrast theme, color/radius/space/type/card variables | `npm run audit:design-system` must pass. |
| Aura primitives | `src/styles/aura-components.css` | Low-specificity `aura-*` element defaults and `.aura-card--*` utilities | Shared UI selector audit and build must pass. |
| Layout shell | `src/styles/layout.css` | Sidebar, topbar, workspace, router-outlet, local nav rail, command palette, AI FAB shell rules | Manual shell smoke check plus build. |
| Legacy cards | `src/styles/legacy-cards.css` | `.metric-card`, `.action-card`, `.panel`, `.form-panel`, and related card classes that remain after migration | Use card inventory to keep scope explicit. |
| Feature legacy | `src/styles/feature-legacy.css` | Remaining module-specific compatibility blocks under workspace/router selectors | Page-owned visual QA required. |

## Extraction Order

1. Freeze the token contract with `npm run audit:design-system`.
2. Extract token definitions only; keep import order equivalent to current cascade.
3. Extract Aura primitive selectors and `.aura-card--*` utilities.
4. Migrate a small card batch and remove only duplicate declarations proven unused by that batch.
5. Extract legacy card blocks after the card inventory is materially smaller.
6. Move workspace/router compatibility selectors last; they are the highest cascade-risk layer.

## Guardrails

- Do not use `!important` as a split workaround.
- Do not hide content globally to solve overlap or cascade issues.
- Do not remove routes, pages, shell regions, AI FAB, command palette, local nav rail, sidebar, or topbar.
- Preserve dark mode and high contrast after each extraction.
- Keep each split commit mechanical: move CSS first, then behavior changes in separate commits.

## Verification

For every split batch:

1. `npm run audit:design-system`
2. `npm run build`
3. Visual smoke check for affected pages and shell regions
4. Update `docs/aura-card-migration-inventory.md` if card classes move or migrate

## Performance Target

Long-term goal: keep reusable design-system primitive CSS below 50 KB gzipped. The full app CSS can remain larger while legacy feature compatibility is still being migrated.