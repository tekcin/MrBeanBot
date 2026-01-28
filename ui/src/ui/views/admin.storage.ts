import { html } from "lit";

export type StorageProps = {
  connected: boolean;
};

export function renderStorage(props: StorageProps) {
  if (!props.connected) {
    return html`
      <div class="view">
        <div class="view__header">
          <h2>Storage Tools</h2>
          <p class="muted">Browse databases, backup/restore, and cleanup tools.</p>
        </div>
        <div class="placeholder">
          <p>Disconnected. Connect to the gateway to manage storage.</p>
        </div>
      </div>
    `;
  }

  return html`
    <div class="view">
      <div class="view__header">
        <h2>Storage Tools</h2>
        <p class="muted">Browse databases, backup/restore, and cleanup tools.</p>
      </div>

      <div class="section">
        <h3>Storage Overview</h3>
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-label">Sessions DB</div>
            <div class="stat-value">0 MB</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Config Files</div>
            <div class="stat-value">0 KB</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Logs</div>
            <div class="stat-value">0 MB</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Cache</div>
            <div class="stat-value">0 MB</div>
          </div>
        </div>
      </div>

      <div class="section">
        <h3>Database Browser</h3>
        <div class="db-browser">
          <div class="db-selector">
            <label>Database:</label>
            <select class="form-select">
              <option>Sessions</option>
              <option>Agents</option>
              <option>Cron Jobs</option>
            </select>
          </div>
          <div class="table-container">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Key</th>
                  <th>Value</th>
                  <th>Size</th>
                  <th>Modified</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td colspan="4" class="muted">Select a database to browse...</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div class="section">
        <h3>Backup & Restore</h3>
        <div class="backup-actions">
          <button class="btn btn-primary">Create Backup</button>
          <button class="btn btn-secondary">Restore from Backup</button>
          <button class="btn btn-warning">Export All Data</button>
        </div>
      </div>

      <div class="section">
        <h3>Cleanup Tools</h3>
        <div class="cleanup-actions">
          <button class="btn btn-warning">Clear Old Logs</button>
          <button class="btn btn-warning">Clear Cache</button>
          <button class="btn btn-danger">Clear All Sessions</button>
        </div>
      </div>
    </div>
  `;
}
