# Aura Token Source Decision

Status: accepted for current remediation phase
Date: 2026-07-02

## Decision

`src/styles.css` is the runtime source of truth for Aura design tokens today. The existing SCSS file at `src/app/core/styles/_tokens.scss` is preserved, but treated as legacy reference material until a generator or formal migration is approved.

## Evidence

- `angular.json` loads only `src/styles.css` through the application `styles` entry.
- `_tokens.scss` is not imported through `@use`, `@import`, or any Angular style entrypoint.
- The SCSS token values do not match the active Aura runtime contract. For example, SCSS radius values end at `8px`, while the current CSS contract preserves `--aura-radius-sm: 4px`, `--aura-radius-md: 6px`, and `--aura-radius-lg: 10px`.
- Current dark mode and high-contrast behavior are implemented with CSS custom properties, so runtime theme switching depends on CSS variables rather than Sass variables.

## Rules

- Do not delete `_tokens.scss` in this cleanup phase.
- Do not import `_tokens.scss` directly into Angular styles without a generated CSS-variable bridge and visual QA.
- New shared Aura components must consume CSS custom properties from `src/styles.css` or component-local aliases that resolve to those variables.
- If SCSS tokens are revived later, generate CSS custom properties from a single source and verify dark mode, high contrast, and `npm run audit:design-system` before migration.

## Follow-Up

- Keep `_tokens.scss` listed as legacy reference in token audit docs.
- Consider a later token-generation task only after the card migration and CSS split reduce cascade risk.