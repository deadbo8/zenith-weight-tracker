/**
 * Data Management & Backup Component (Android History Screen)
 * Robust data sovereignty: export CSV, JSON backup, file restore,
 * sample data toggle, and state reset.
 */

import { store } from '../state.js';

export function renderDataManagement(container, onAction) {
  if (!container) return;

  const state = store.getState();
  const hasEntries = state.entries.length > 0;

  container.innerHTML = `
    <div class="content-card data-management-card">
      <div class="card-title-row">
        <h3 class="card-title">
          <i data-lucide="database" style="color: var(--accent-blue);"></i>
          Data & Backup
        </h3>
        <span style="font-size: 0.72rem; color: var(--text-muted);">Local & Private</span>
      </div>
      <p style="font-size: 0.8rem; color: var(--text-secondary); margin-bottom: 0.85rem;">
        Your weight data is stored securely on your device. Create backups or restore your history at any time.
      </p>

      <div class="data-actions-grid">
        <button class="btn btn-secondary data-action-btn" id="btn-data-export-csv" ${!hasEntries ? 'disabled' : ''}>
          <i data-lucide="file-spreadsheet"></i>
          <span>Export CSV</span>
        </button>

        <button class="btn btn-secondary data-action-btn" id="btn-data-export-json" ${!hasEntries ? 'disabled' : ''}>
          <i data-lucide="download"></i>
          <span>Backup JSON</span>
        </button>

        <label class="btn btn-secondary data-action-btn" id="label-data-import">
          <i data-lucide="upload"></i>
          <span>Restore Backup</span>
          <input type="file" id="input-import-file" accept=".json,.csv" style="display: none;" />
        </label>

        <button class="btn btn-ghost data-action-btn" id="btn-data-load-sample">
          <i data-lucide="sparkles"></i>
          <span>Sample Data</span>
        </button>
      </div>

      ${hasEntries ? `
        <div class="danger-zone-strip">
          <button class="btn btn-ghost btn-sm danger-text" id="btn-data-clear-all">
            <i data-lucide="trash-2"></i>
            <span>Clear All Data</span>
          </button>
        </div>
      ` : ''}
    </div>
  `;

  // Bind Event Listeners
  container.querySelector('#btn-data-export-csv')?.addEventListener('click', () => {
    store.exportCSV();
    onAction('toast', { message: 'CSV exported successfully', icon: 'file-check' });
  });

  container.querySelector('#btn-data-export-json')?.addEventListener('click', () => {
    store.exportJSON();
    onAction('toast', { message: 'JSON backup downloaded', icon: 'download-cloud' });
  });

  const fileInput = container.querySelector('#input-import-file');
  fileInput?.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target.result;
      if (file.name.endsWith('.json')) {
        const res = store.importJSON(content);
        if (res.success) {
          onAction('toast', { message: 'Data restored successfully', icon: 'check-circle' });
        } else {
          alert('Failed to restore JSON backup: ' + (res.error || 'Invalid file'));
        }
      } else {
        alert('JSON backup files (.json) are fully supported for complete restore.');
      }
    };
    reader.readAsText(file);
    fileInput.value = '';
  });

  container.querySelector('#btn-data-load-sample')?.addEventListener('click', () => {
    if (hasEntries && !confirm('Loading sample data will replace your current check-ins. Continue?')) {
      return;
    }
    onAction('load-demo');
  });

  container.querySelector('#btn-data-clear-all')?.addEventListener('click', () => {
    if (confirm('Are you sure you want to permanently delete all recorded weigh-ins and reset your history? This cannot be undone.')) {
      store.clearAllData();
      onAction('toast', { message: 'All data cleared', icon: 'trash-2' });
    }
  });

  if (window.lucide) {
    window.lucide.createIcons();
  }
}
