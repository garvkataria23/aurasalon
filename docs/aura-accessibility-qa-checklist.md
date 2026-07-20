# Aura Accessibility QA Checklist

Date: 2026-07-02
Scope: shared Aura primitives, card migrations, dark mode, high contrast, and shell-safe visual checks.

## Required Checks For Shared UI Changes

| Area | Check | Evidence |
| --- | --- | --- |
| Keyboard | Interactive Aura components can be reached and activated by keyboard. | Tab through changed controls; Enter/Space activates buttons where applicable. |
| Focus | Focus indication is visible in light, dark, and high-contrast themes. | Uses `--aura-focus` or an equivalent visible outline without relying only on color. |
| Contrast | Text, icon, border, and status treatments remain readable in light, dark, and high-contrast themes. | Compare normal, muted, status, and disabled states. |
| Semantics | Components expose correct native elements or ARIA roles. | Buttons use `button`; drawers use dialog semantics; tables keep table structure. |
| Motion | Hover/transition effects do not hide information or cause layout shift. | Check hover and focus states on cards and action surfaces. |
| Empty/loading | Empty and skeleton states communicate state without blocking screen-reader navigation. | `aura-empty` labels and skeleton counts remain sensible. |

## Card Migration Checks

- Keep the legacy class during first migration and add Aura utility classes beside it.
- Confirm hover/focus states do not change card size or obscure text.
- Confirm status or tone is visible without relying only on background color.
- Confirm dark mode and high contrast preserve card border, text, and focus affordances.
- Run `npm run audit:design-system` and `npm run build` after every card migration batch.

## Shell Preservation Checks

Every visual QA pass must confirm these regions still render and remain reachable:

- Sidebar
- Topbar
- Local nav rail
- Module tabs
- Router outlet content
- AI FAB
- Command palette

## Theme Checks

- Light theme: primary, surface, text, muted, border, success, warning, danger, and info tokens render as expected.
- Dark theme: `:root[data-theme="dark"]` keeps Aura surfaces, text, border, focus, and status fills readable.
- High contrast: `:root[data-theme="high-contrast"]` keeps shadows suppressed and status/focus treatments explicit.

## Not Covered By Static Audit

`npm run audit:design-system` verifies that the checklist exists and that core token/selector contracts are present. It does not replace manual visual or assistive-technology QA for affected pages.