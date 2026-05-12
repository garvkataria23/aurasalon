# Aura Design System

## Color Tokens

- `--color-bg`: application background.
- `--color-surface`: primary surface.
- `--color-surface-muted`: quiet secondary surface.
- `--color-text`: primary text.
- `--color-muted`: secondary text.
- `--color-border`: borders and dividers.
- `--color-primary`: main action and focus color.
- `--color-primary-strong`: hover/active primary.
- `--color-info`, `--color-success`, `--color-warning`, `--color-danger`, `--color-accent`: semantic accents.

## Typography

- Font family: Inter/system sans-serif.
- Page title: 1.45-2.05rem responsive clamp.
- Section heading: 1.08rem.
- Small labels/eyebrows: 0.76-0.84rem, uppercase only for navigation metadata.
- Letter spacing stays `0` for readability.

## Buttons

- `.primary-button`: primary submit/action.
- `.dark-button`: high-contrast operational action.
- `.ghost-button`: secondary action.
- `.ghost-button.mini`: compact table/list action.
- Disabled buttons must be visibly disabled and should include adjacent context when the feature cannot run.

## Cards

- Use 8px radius.
- Cards are for metrics, repeated items and tool panels.
- Avoid nested cards.
- Use semantic top borders on metric cards for quick scanning.

## Tables

- Tables use compact row spacing, uppercase column headers and horizontal overflow on mobile.
- Row actions should be explicit buttons.
- Empty table states should appear as a row with explanatory text.

## Forms

- `.field` labels wrap inputs/selects/textareas.
- Forms use two columns on desktop and one column on mobile.
- Required fields are validated before API calls.
- Long JSON output uses `.result-json`.

## Empty States

- `.empty-state` includes a heading, clear reason and next action.
- Empty states should not hide the module; they should explain what data is needed.

## Error States

- `app-state` is used for loading/error.
- Errors show the backend message when available.
- Retry buttons should call the same load action.

## Mobile Layout

- Sidebar becomes horizontal.
- Forms, metrics and dashboard grids collapse to one column.
- Buttons stretch full width under 760px.
- Tables remain horizontally scrollable rather than squeezing text.
