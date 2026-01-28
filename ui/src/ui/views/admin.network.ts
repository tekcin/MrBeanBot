import { html } from "lit";

export type NetworkProps = {
  connected: boolean;
};

export function renderNetwork(props: NetworkProps) {
  if (!props.connected) {
    return html`
      <div class="view">
        <div class="view__header">
          <h2>Network Tools</h2>
          <p class="muted">Port scanning, connection testing, and firewall management.</p>
        </div>
        <div class="placeholder">
          <p>Disconnected. Connect to the gateway to use network tools.</p>
        </div>
      </div>
    `;
  }

  return html`
    <div class="view">
      <div class="view__header">
        <h2>Network Tools</h2>
        <p class="muted">Port scanning, connection testing, and firewall management.</p>
      </div>

      <div class="section">
        <h3>Port Scanner</h3>
        <div class="port-scanner">
          <div class="form-group">
            <label>Target Host:</label>
            <input type="text" class="form-input" placeholder="192.168.1.1" />
          </div>
          <div class="form-group">
            <label>Port Range:</label>
            <div class="input-group">
              <input type="number" class="form-input" placeholder="1" value="1" />
              <span>to</span>
              <input type="number" class="form-input" placeholder="1024" value="1024" />
            </div>
          </div>
          <button class="btn btn-primary">Scan Ports</button>
          <div class="scan-results">
            <h4>Results:</h4>
            <div class="results-list">
              <p class="muted">No scan performed yet...</p>
            </div>
          </div>
        </div>
      </div>

      <div class="section">
        <h3>Connection Tester</h3>
        <div class="connection-tester">
          <div class="form-group">
            <label>Host:</label>
            <input type="text" class="form-input" placeholder="example.com" />
          </div>
          <div class="form-group">
            <label>Port:</label>
            <input type="number" class="form-input" placeholder="80" value="80" />
          </div>
          <div class="form-group">
            <label>Protocol:</label>
            <select class="form-select">
              <option>TCP</option>
              <option>UDP</option>
              <option>HTTP</option>
              <option>HTTPS</option>
            </select>
          </div>
          <button class="btn btn-primary">Test Connection</button>
          <div class="test-results">
            <pre class="test-output">Connection test results will appear here...</pre>
          </div>
        </div>
      </div>

      <div class="section">
        <h3>Active Connections</h3>
        <div class="table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>Protocol</th>
                <th>Local Address</th>
                <th>Remote Address</th>
                <th>State</th>
                <th>PID</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colspan="5" class="muted">Loading connections...</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="section">
        <h3>Firewall Rules</h3>
        <div class="firewall-manager">
          <button class="btn btn-primary">Add Rule</button>
          <button class="btn btn-secondary">Refresh</button>
          <div class="table-container">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Rule</th>
                  <th>Port</th>
                  <th>Protocol</th>
                  <th>Action</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td colspan="5" class="muted">No firewall rules configured...</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  `;
}
