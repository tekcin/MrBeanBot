import { html } from "lit";

export type ServicesProps = {
  connected: boolean;
};

export function renderServices(props: ServicesProps) {
  if (!props.connected) {
    return html`
      <div class="view">
        <div class="view__header">
          <h2>Service Management</h2>
          <p class="muted">Start, stop, and restart services with log monitoring.</p>
        </div>
        <div class="placeholder">
          <p>Disconnected. Connect to the gateway to manage services.</p>
        </div>
      </div>
    `;
  }

  return html`
    <div class="view">
      <div class="view__header">
        <h2>Service Management</h2>
        <p class="muted">Start, stop, and restart services with log monitoring.</p>
      </div>

      <div class="section">
        <h3>Services</h3>
        <div class="table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>Service Name</th>
                <th>Status</th>
                <th>PID</th>
                <th>Uptime</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>MrBeanBot-gateway</td>
                <td><span class="status-badge status-running">Running</span></td>
                <td>-</td>
                <td>-</td>
                <td>
                  <button class="btn btn-sm btn-secondary" disabled>Start</button>
                  <button class="btn btn-sm btn-warning">Stop</button>
                  <button class="btn btn-sm btn-primary">Restart</button>
                </td>
              </tr>
              <tr>
                <td colspan="5" class="muted">More services will appear here...</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="section">
        <h3>Service Logs</h3>
        <div class="log-viewer">
          <div class="log-toolbar">
            <select class="form-select">
              <option>MrBeanBot-gateway</option>
            </select>
            <button class="btn btn-sm">Refresh</button>
            <button class="btn btn-sm">Clear</button>
          </div>
          <div class="log-content">
            <pre class="log-output">Service logs will appear here...</pre>
          </div>
        </div>
      </div>
    </div>
  `;
}
