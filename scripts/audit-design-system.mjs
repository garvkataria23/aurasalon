import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = process.cwd();
const sharedUiDir = join(root, 'src', 'app', 'shared', 'ui');
const stylesPath = join(root, 'src', 'styles.css');
const barrelPath = join(sharedUiDir, 'index.ts');
const cardThemePath = join(sharedUiDir, 'aura-card', 'aura-card.theme.ts');
const catalogPath = join(root, 'docs', 'aura-component-catalog.md');

const canonicalSelectors = [
  'aura-badge',
  'aura-button',
  'aura-card',
  'aura-drawer',
  'aura-empty',
  'aura-kpi-card',
  'aura-page-header',
  'aura-skeleton',
  'aura-stat-strip',
  'aura-table',
  'aura-tabs'
];

const legacySelectors = [
  'aura-legacy-badge',
  'aura-legacy-button',
  'aura-legacy-drawer',
  'aura-legacy-empty',
  'aura-legacy-page-header',
  'aura-legacy-skeleton',
  'aura-legacy-stat-strip',
  'aura-legacy-table',
  'aura-legacy-tabs'
];

const requiredStyles = [
  '--radius-xs: 4px',
  '--aura-radius-sm: var(--radius-xs)',
  '--aura-radius-md: var(--radius-sm)',
  '--aura-radius-lg: var(--radius-md)',
  '--aura-primary: var(--color-primary)',
  '--aura-card: var(--color-surface)',
  '--metric-card-radius',
  '--card-border-radius',
  'aura-card--type-metric',
  'aura-card--tone-teal',
  'aura-card--tone-violet',
  'aura-card--tone-slate',
  ':root[data-theme="high-contrast"]'
];

const requiredBarrelExports = [
  './aura-badge/aura-badge.component',
  './aura-button/aura-button.component',
  './aura-card/aura-card.component',
  './aura-card/aura-card.theme',
  './aura-drawer/aura-drawer.component',
  './aura-empty/aura-empty.component',
  './aura-kpi-card/aura-kpi-card.component',
  './aura-page-header/aura-page-header.component',
  './aura-skeleton/aura-skeleton.component',
  './aura-stat-strip/aura-stat-strip.component',
  './aura-table/aura-table.component',
  './aura-tabs/aura-tabs.component'
];

function walk(dir) {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return walk(path);
    return path.endsWith('.ts') ? [path] : [];
  });
}

function read(path) {
  return readFileSync(path, 'utf8');
}

const failures = [];
const notes = [];

function expect(condition, message) {
  if (!condition) failures.push(message);
}

function countInMap(map, key) {
  return map.get(key)?.length ?? 0;
}

const selectorPattern = /selector:\s*['"]([^'"]+)['"]/g;
const selectors = new Map();

for (const file of walk(sharedUiDir)) {
  const source = read(file);
  for (const match of source.matchAll(selectorPattern)) {
    const selector = match[1];
    if (!selector.startsWith('aura-')) continue;
    const list = selectors.get(selector) ?? [];
    list.push(relative(root, file));
    selectors.set(selector, list);
  }
}

for (const [selector, files] of selectors) {
  expect(files.length === 1, `Duplicate selector '${selector}' found in ${files.join(', ')}`);
}

for (const selector of canonicalSelectors) {
  expect(countInMap(selectors, selector) === 1, `Missing canonical selector '${selector}'`);
}

for (const selector of legacySelectors) {
  expect(countInMap(selectors, selector) === 1, `Missing legacy selector '${selector}'`);
}

const styles = read(stylesPath);
for (const token of requiredStyles) {
  expect(styles.includes(token), `Missing styles contract '${token}' in src/styles.css`);
}

const barrel = read(barrelPath);
for (const exportPath of requiredBarrelExports) {
  expect(barrel.includes(exportPath), `Missing shared UI barrel export '${exportPath}'`);
}

expect(existsSync(cardThemePath), 'Missing aura-card.theme.ts');
expect(read(cardThemePath).includes('auraCardTokens'), 'aura-card.theme.ts must export auraCardTokens');
expect(existsSync(catalogPath), 'Missing docs/aura-component-catalog.md');
expect(read(catalogPath).includes('## Legacy Shims'), 'Component catalog must document legacy shims');

notes.push(`Checked ${selectors.size} Aura selectors across shared UI.`);
notes.push(`Canonical selectors: ${canonicalSelectors.length}; legacy selectors: ${legacySelectors.length}.`);
notes.push('Checked token bridge, card utility aliases, barrel exports, and catalog docs.');

if (failures.length) {
  console.error('Aura design-system audit failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Aura design-system audit passed.');
for (const note of notes) console.log(`- ${note}`);