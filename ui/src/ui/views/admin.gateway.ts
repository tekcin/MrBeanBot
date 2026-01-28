import { html } from "lit";

export type GatewayAdminProps = {
  connected: boolean;
  bindMode?: string;
  bindAddress?: string;
  port?: number;
  token?: string;
  dashboardUrl?: string;
  allowedIps?: string[];
  ipAllowlistEnabled?: boolean;
  newIpInput?: string;
  onBindModeChange?: (mode: "loopback" | "lan") => void;
  onRestartGateway?: () => void;
  onRegenerateToken?: () => void;
  onCopyDashboardUrl?: () => void;
  onToggleIpAllowlist?: (enabled: boolean) => void;
  onAddIp?: (ip: string) => void;
  onRemoveIp?: (ip: string) => void;
  onNewIpInputChange?: (value: string) => void;
};

export function renderGatewayAdmin(props: GatewayAdminProps) {
  if (!props.connected) {
    return html`
      <div class="view">
        <div class="view__header">
          <h2>Gateway Admin</h2>
          <p class="muted">Connection monitoring, rate limiting, and token management.</p>
        </div>
        <div class="placeholder">
          <p>Disconnected. Connect to the gateway to manage settings.</p>
        </div>
      </div>
    `;
  }

  const currentMode = props.bindMode || "loopback";
  const isLoopback = currentMode === "loopback";
  const isLan = currentMode === "lan";
  const bindAddress = props.bindAddress || (isLoopback ? "127.0.0.1" : "0.0.0.0");
  const port = props.port || 18789;

  return html`
    <div class="view">
      <div class="view__header">
        <h2>Gateway Admin</h2>
        <p class="muted">Connection monitoring, rate limiting, and token management.</p>
      </div>

      <div class="section">
        <h3>Network Access Mode</h3>
        <div class="network-mode-switcher">
          <div class="network-status">
            <div class="status-indicator">
              <span class="status-label">Current Mode:</span>
              <span class="status-badge ${isLan ? 'status-warning' : 'status-success'}">
                ${isLoopback ? "🔒 Localhost Only" : "🌐 Local Network"}
              </span>
            </div>
            <div class="status-detail">
              <span class="muted">Listening on: <code>${bindAddress}:${port}</code></span>
            </div>
          </div>

          <div class="mode-selector">
            <div class="mode-option">
              <label class="radio-label ${isLoopback ? 'active' : ''}">
                <input
                  type="radio"
                  name="bindMode"
                  value="loopback"
                  ?checked=${isLoopback}
                  @change=${() => props.onBindModeChange?.("loopback")}
                />
                <div class="mode-content">
                  <div class="mode-title">🔒 Localhost Only (Loopback)</div>
                  <div class="mode-description">
                    Gateway only accepts connections from 127.0.0.1. Most secure option for single-machine setups.
                  </div>
                  <div class="mode-details">
                    <span class="detail-badge">✓ Secure</span>
                    <span class="detail-badge">Local access only</span>
                    <span class="detail-badge">Recommended</span>
                  </div>
                </div>
              </label>
            </div>

            <div class="mode-option">
              <label class="radio-label ${isLan ? 'active' : ''}">
                <input
                  type="radio"
                  name="bindMode"
                  value="lan"
                  ?checked=${isLan}
                  @change=${() => props.onBindModeChange?.("lan")}
                />
                <div class="mode-content">
                  <div class="mode-title">🌐 Local Network (LAN)</div>
                  <div class="mode-description">
                    Gateway accepts connections from any device on your local network (192.168.x.x, 10.x.x.x).
                  </div>
                  <div class="mode-details">
                    <span class="detail-badge warning">⚠ Network exposed</span>
                    <span class="detail-badge">Multi-device access</span>
                    <span class="detail-badge">Dev/Testing</span>
                  </div>
                </div>
              </label>
            </div>
          </div>

          ${isLan
            ? html`
                <div class="network-warning">
                  <div class="warning-box">
                    <div class="warning-header">⚠️ Security Notice</div>
                    <div class="warning-content">
                      <p>
                        <strong>LAN mode exposes the gateway to your local network.</strong> This is suitable
                        for development and testing environments.
                      </p>
                      <ul>
                        <li>Only use on trusted networks (home, office)</li>
                        <li>Token authentication is still required</li>
                        <li>Consider using HTTPS/Tailscale for production</li>
                        <li>Firewall rules may need adjustment (port ${port})</li>
                      </ul>
                    </div>
                  </div>
                </div>
              `
            : html`
                <div class="network-info">
                  <div class="info-box">
                    <div class="info-header">ℹ️ Localhost Mode Active</div>
                    <div class="info-content">
                      <p>
                        Gateway is only accessible from this machine. To access from other devices, switch to
                        <strong>Local Network</strong> mode.
                      </p>
                    </div>
                  </div>
                </div>
              `}

          <div class="network-actions">
            <button
              class="btn btn-primary"
              @click=${() => props.onRestartGateway?.()}
              title="Restart gateway to apply network mode changes"
            >
              🔄 Restart Gateway
            </button>
            <div class="action-note">
              <span class="muted">Note: Gateway restart required for changes to take effect</span>
            </div>
          </div>
        </div>
      </div>

      <div class="section">
        <h3>Token Management</h3>
        <div class="token-manager">
          <div class="form-group">
            <label>Gateway Token:</label>
            <div class="input-group">
              <input
                type="password"
                class="form-input"
                value=${props.token || "********************************"}
                readonly
              />
              <button class="btn btn-secondary">Show</button>
              <button class="btn btn-primary" @click=${() => props.onRegenerateToken?.()}>
                Regenerate
              </button>
            </div>
            <div class="form-hint">
              <span class="muted">Used for dashboard authentication and API access</span>
            </div>
          </div>
          <div class="form-group">
            <label>Dashboard URL:</label>
            <div class="input-group">
              <input
                type="text"
                class="form-input"
                value=${props.dashboardUrl || `http://${bindAddress}:${port}/?token=...`}
                readonly
              />
              <button class="btn btn-secondary" @click=${() => props.onCopyDashboardUrl?.()}>
                📋 Copy
              </button>
            </div>
            <div class="form-hint">
              <span class="muted"
                >Share this URL to grant dashboard access (token included in URL)</span
              >
            </div>
          </div>
        </div>
      </div>

      <div class="section">
        <h3>IP Allowlist (Access Control)</h3>
        <div class="ip-allowlist-manager">
          <div class="allowlist-toggle">
            <label class="toggle-label">
              <input
                type="checkbox"
                ?checked=${props.ipAllowlistEnabled || false}
                @change=${(e: Event) => {
                  const checked = (e.target as HTMLInputElement).checked;
                  props.onToggleIpAllowlist?.(checked);
                }}
              />
              <span>Enable IP Allowlist (only allow specific IPs to connect)</span>
            </label>
            <div class="form-hint">
              <span class="muted">
                When enabled, only IPs in the list below can connect to the gateway
              </span>
            </div>
          </div>

          ${props.ipAllowlistEnabled
            ? html`
                <div class="allowlist-warning">
                  <div class="warning-box">
                    <div class="warning-header">⚠️ Important</div>
                    <div class="warning-content">
                      <ul>
                        <li>
                          Make sure to add <strong>your current IP</strong> before enabling, or you'll
                          lose access
                        </li>
                        <li>Use CIDR notation for ranges (e.g., 192.168.1.0/24)</li>
                        <li>Gateway restart required for changes to take effect</li>
                      </ul>
                    </div>
                  </div>
                </div>

                <div class="ip-add-form">
                  <div class="form-group">
                    <label>Add IP Address or CIDR Range:</label>
                    <div class="input-group">
                      <input
                        type="text"
                        class="form-input"
                        placeholder="192.168.1.100 or 192.168.1.0/24"
                        .value=${props.newIpInput || ""}
                        @input=${(e: Event) => {
                          const value = (e.target as HTMLInputElement).value;
                          props.onNewIpInputChange?.(value);
                        }}
                        @keypress=${(e: KeyboardEvent) => {
                          if (e.key === "Enter") {
                            const value = (e.target as HTMLInputElement).value.trim();
                            if (value) {
                              props.onAddIp?.(value);
                            }
                          }
                        }}
                      />
                      <button
                        class="btn btn-primary"
                        @click=${() => {
                          const value = props.newIpInput?.trim();
                          if (value) {
                            props.onAddIp?.(value);
                          }
                        }}
                      >
                        ➕ Add IP
                      </button>
                    </div>
                    <div class="form-hint">
                      <span class="muted">
                        Examples: 192.168.1.100, 10.0.0.0/8, 192.168.1.0/24
                      </span>
                    </div>
                  </div>
                </div>

                <div class="ip-list">
                  <h4>Allowed IP Addresses (${(props.allowedIps || []).length})</h4>
                  ${(props.allowedIps || []).length === 0
                    ? html`
                        <div class="empty-state">
                          <p class="muted">No IPs in allowlist. Add IPs above to restrict access.</p>
                        </div>
                      `
                    : html`
                        <div class="table-container">
                          <table class="data-table">
                            <thead>
                              <tr>
                                <th>IP Address / CIDR Range</th>
                                <th>Type</th>
                                <th>Actions</th>
                              </tr>
                            </thead>
                            <tbody>
                              ${(props.allowedIps || []).map(
                                (ip) => html`
                                  <tr>
                                    <td><code>${ip}</code></td>
                                    <td>
                                      ${ip.includes("/")
                                        ? html`<span class="badge">CIDR Range</span>`
                                        : html`<span class="badge">Single IP</span>`}
                                    </td>
                                    <td>
                                      <button
                                        class="btn btn-sm btn-danger"
                                        @click=${() => props.onRemoveIp?.(ip)}
                                      >
                                        🗑️ Remove
                                      </button>
                                    </td>
                                  </tr>
                                `,
                              )}
                            </tbody>
                          </table>
                        </div>
                      `}
                </div>

                <div class="allowlist-helpers">
                  <h4>Quick Add Common Ranges:</h4>
                  <div class="quick-add-buttons">
                    <button
                      class="btn btn-sm btn-secondary"
                      @click=${() => props.onAddIp?.("192.168.0.0/16")}
                      title="Entire 192.168.x.x range"
                    >
                      192.168.0.0/16 (Home Network)
                    </button>
                    <button
                      class="btn btn-sm btn-secondary"
                      @click=${() => props.onAddIp?.("10.0.0.0/8")}
                      title="Entire 10.x.x.x range"
                    >
                      10.0.0.0/8 (Private Network)
                    </button>
                    <button
                      class="btn btn-sm btn-secondary"
                      @click=${() => props.onAddIp?.("172.16.0.0/12")}
                      title="172.16.x.x to 172.31.x.x"
                    >
                      172.16.0.0/12 (Private Network)
                    </button>
                    <button
                      class="btn btn-sm btn-secondary"
                      @click=${() => props.onAddIp?.("127.0.0.1")}
                      title="Localhost only"
                    >
                      127.0.0.1 (Localhost)
                    </button>
                  </div>
                </div>
              `
            : html`
                <div class="allowlist-info">
                  <div class="info-box">
                    <div class="info-header">ℹ️ IP Allowlist Disabled</div>
                    <div class="info-content">
                      <p>
                        Currently, all IP addresses can connect to the gateway (token auth still
                        required).
                      </p>
                      <p>Enable the IP allowlist above to restrict access to specific IP addresses.</p>
                    </div>
                  </div>
                </div>
              `}
        </div>
      </div>

      <div class="section">
        <h3>Active Connections</h3>
        <div class="table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>Client ID</th>
                <th>IP Address</th>
                <th>Connected</th>
                <th>Requests</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colspan="5" class="muted">No active connections (feature coming soon)...</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="section">
        <h3>Rate Limiting</h3>
        <div class="rate-limit-config">
          <div class="form-group">
            <label>Max Requests per Minute:</label>
            <input type="number" class="form-input" value="60" />
          </div>
          <div class="form-group">
            <label>Max Concurrent Connections:</label>
            <input type="number" class="form-input" value="100" />
          </div>
          <button class="btn btn-primary">Save Settings</button>
          <div class="form-hint">
            <span class="muted">Rate limiting feature coming soon</span>
          </div>
        </div>
      </div>

      <div class="section">
        <h3>Device Management</h3>
        <div class="table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>Device ID</th>
                <th>Name</th>
                <th>Last Seen</th>
                <th>Authorized</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colspan="5" class="muted">No devices registered (feature coming soon)...</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}
