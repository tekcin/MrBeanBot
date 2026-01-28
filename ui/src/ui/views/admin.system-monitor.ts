import { html } from "lit";

export type SystemMonitorProps = {
  connected: boolean;
};

export function renderSystemMonitor(props: SystemMonitorProps) {
  if (!props.connected) {
    return html`
      <div class="view">
        <div class="view__header">
          <h2>System Monitor</h2>
          <p class="muted">Monitor CPU, memory, disk usage, and active processes.</p>
        </div>
        <div class="placeholder">
          <p>Disconnected. Connect to the gateway to view system metrics.</p>
        </div>
      </div>
    `;
  }

  return html`
    <div class="view">
      <div class="view__header">
        <h2>System Monitor</h2>
        <p class="muted">Monitor CPU, memory, disk usage, and active processes.</p>
      </div>

      <div class="section">
        <h3>System Overview</h3>
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-label">CPU Usage</div>
            <div class="stat-value">0%</div>
            <div class="stat-progress">
              <div class="stat-progress-bar" style="width: 0%"></div>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Memory Usage</div>
            <div class="stat-value">0 MB / 0 MB</div>
            <div class="stat-progress">
              <div class="stat-progress-bar" style="width: 0%"></div>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Disk Usage</div>
            <div class="stat-value">0 GB / 0 GB</div>
            <div class="stat-progress">
              <div class="stat-progress-bar" style="width: 0%"></div>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Uptime</div>
            <div class="stat-value">0d 0h 0m</div>
          </div>
        </div>
      </div>

      <div class="section">
        <h3>Process List</h3>
        <div class="table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>PID</th>
                <th>Name</th>
                <th>CPU %</th>
                <th>Memory</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colspan="5" class="muted">Loading processes...</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="section">
        <h3>System Information</h3>
        <div class="info-grid">
          <div class="info-item">
            <span class="info-label">Platform:</span>
            <span class="info-value">-</span>
          </div>
          <div class="info-item">
            <span class="info-label">Architecture:</span>
            <span class="info-value">-</span>
          </div>
          <div class="info-item">
            <span class="info-label">Hostname:</span>
            <span class="info-value">-</span>
          </div>
          <div class="info-item">
            <span class="info-label">Node.js Version:</span>
            <span class="info-value">-</span>
          </div>
        </div>
      </div>
    </div>
  `;
}
