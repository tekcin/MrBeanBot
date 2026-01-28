import { html } from "lit";

export type ApiTestProps = {
  connected: boolean;
};

export function renderApiTest(props: ApiTestProps) {
  if (!props.connected) {
    return html`
      <div class="view">
        <div class="view__header">
          <h2>API Tester</h2>
          <p class="muted">Test API endpoints and inspect WebSocket connections.</p>
        </div>
        <div class="placeholder">
          <p>Disconnected. Connect to the gateway to test APIs.</p>
        </div>
      </div>
    `;
  }

  return html`
    <div class="view">
      <div class="view__header">
        <h2>API Tester</h2>
        <p class="muted">Test API endpoints and inspect WebSocket connections.</p>
      </div>

      <div class="section">
        <h3>HTTP Request</h3>
        <div class="api-tester">
          <div class="request-builder">
            <div class="form-group">
              <label>Method:</label>
              <select class="form-select">
                <option>GET</option>
                <option>POST</option>
                <option>PUT</option>
                <option>DELETE</option>
                <option>PATCH</option>
              </select>
            </div>
            <div class="form-group">
              <label>URL:</label>
              <input type="text" class="form-input" placeholder="http://localhost:18789/api/endpoint" />
            </div>
            <div class="form-group">
              <label>Headers:</label>
              <textarea class="form-textarea" placeholder='{"Content-Type": "application/json"}'></textarea>
            </div>
            <div class="form-group">
              <label>Body:</label>
              <textarea class="form-textarea" placeholder='{"key": "value"}'></textarea>
            </div>
            <button class="btn btn-primary">Send Request</button>
          </div>
          <div class="response-viewer">
            <h4>Response:</h4>
            <div class="response-tabs">
              <button class="tab-btn active">Body</button>
              <button class="tab-btn">Headers</button>
              <button class="tab-btn">Info</button>
            </div>
            <pre class="response-body">Response will appear here...</pre>
          </div>
        </div>
      </div>

      <div class="section">
        <h3>WebSocket Tester</h3>
        <div class="ws-tester">
          <div class="form-group">
            <label>WebSocket URL:</label>
            <input type="text" class="form-input" placeholder="ws://localhost:18789" />
          </div>
          <div class="ws-controls">
            <button class="btn btn-primary">Connect</button>
            <button class="btn btn-danger" disabled>Disconnect</button>
          </div>
          <div class="form-group">
            <label>Message:</label>
            <textarea class="form-textarea" placeholder='{"type": "ping"}'></textarea>
          </div>
          <button class="btn btn-secondary" disabled>Send Message</button>
          <div class="ws-log">
            <h4>Connection Log:</h4>
            <pre class="ws-log-content">Not connected...</pre>
          </div>
        </div>
      </div>

      <div class="section">
        <h3>Request History</h3>
        <div class="table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Method</th>
                <th>URL</th>
                <th>Status</th>
                <th>Duration</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colspan="6" class="muted">No requests yet...</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}
