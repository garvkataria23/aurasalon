import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';

@Component({
  selector: 'app-design-system',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="page-stack">
      <div class="module-hero">
        <div>
          <span class="eyebrow">Level 18 · Design system</span>
          <h2>Tokens, typography, buttons, cards, tables, forms, states and responsive layout</h2>
          <p>These styles are implemented in src/styles.css and documented in docs/DESIGN_SYSTEM.md.</p>
        </div>
      </div>

      <section class="panel">
        <div class="section-title"><h2>Color tokens</h2></div>
        <div class="token-grid">
          <article class="token-swatch" *ngFor="let token of colorTokens" [class.light]="token.light" [style.background]="token.value">
            <strong>{{ token.name }}</strong>
            <span>{{ token.value }}</span>
          </article>
        </div>
      </section>

      <section class="panel">
        <div class="section-title"><h2>Typography</h2></div>
        <div class="component-showcase">
          <article class="action-card"><span class="eyebrow">Eyebrow</span><strong>Section heading</strong><span>Muted supporting copy for admin workflows.</span></article>
          <article class="action-card"><h2>Page section title</h2><span>Used inside panels and page modules.</span></article>
          <article class="action-card"><h3>Compact form title</h3><span>Used where space is dense.</span></article>
        </div>
      </section>

      <section class="panel">
        <div class="section-title"><h2>Buttons and states</h2></div>
        <div class="card-actions">
          <button class="primary-button" type="button">Primary action</button>
          <button class="dark-button" type="button">Operational action</button>
          <button class="ghost-button" type="button">Secondary action</button>
          <button class="ghost-button mini" type="button">Mini</button>
          <button class="ghost-button" type="button" disabled title="Disabled until required data exists">Disabled until data exists</button>
        </div>
      </section>

      <div class="dashboard-grid">
        <section class="panel">
          <div class="section-title"><h2>Tables</h2></div>
          <div class="table-wrap">
            <table>
              <thead><tr><th>Name</th><th>Status</th><th>Action</th></tr></thead>
              <tbody>
                <tr><td>Workflow row</td><td><span class="badge">active</span></td><td><button class="ghost-button mini" type="button">Run</button></td></tr>
                <tr><td colspan="3"><div class="empty-state"><strong>Empty state</strong><span>Shown when no records match the selected filters.</span></div></td></tr>
              </tbody>
            </table>
          </div>
        </section>

        <section class="form-panel">
          <h3>Forms</h3>
          <form>
            <label class="field"><span>Label</span><input value="Input value" /></label>
            <label class="field"><span>Select</span><select><option>Option</option></select></label>
            <label class="field full"><span>Textarea</span><textarea>Longer value</textarea></label>
            <div class="form-actions"><button class="primary-button" type="button">Submit</button></div>
          </form>
        </section>
      </div>
    </section>
  `
})
export class DesignSystemComponent {
  readonly colorTokens = [
    { name: '--color-bg', value: '#f5f7f8', light: true },
    { name: '--color-surface', value: '#ffffff', light: true },
    { name: '--color-text', value: '#17202d' },
    { name: '--color-primary', value: '#0f766e' },
    { name: '--color-info', value: '#2f5fbd' },
    { name: '--color-success', value: '#267a45' },
    { name: '--color-warning', value: '#b7791f' },
    { name: '--color-danger', value: '#b42318' },
    { name: '--color-accent', value: '#6d4cc2' },
    { name: '--color-border', value: '#dce3e1', light: true }
  ];
}
