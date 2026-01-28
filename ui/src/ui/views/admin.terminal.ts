import { html } from "lit";

export type TerminalProps = {
  connected: boolean;
};

export function renderTerminal(props: TerminalProps) {
  if (!props.connected) {
    return html`
      <div class="view">
        <div class="view__header">
          <h2>Terminal</h2>
          <p class="muted">Shell access, task scheduler, and notifications.</p>
        </div>
        <div class="placeholder">
          <p>Disconnected. Connect to the gateway to access terminal.</p>
        </div>
      </div>
    `;
  }

  return html`
    <div class="view">
      <div class="view__header">
        <h2>Terminal</h2>
        <p class="muted">Shell access, task scheduler, and notifications.</p>
      </div>

      <div class="section">
        <h3>Shell Terminal</h3>
        <div class="terminal-container">
          <div class="terminal-toolbar">
            <button class="btn btn-sm btn-primary">New Session</button>
            <button class="btn btn-sm btn-danger">Close Session</button>
            <button class="btn btn-sm btn-secondary">Clear</button>
          </div>
          <div class="terminal-output">
            <pre class="terminal-content">$ Welcome to MrBeanBot Terminal
$ Type commands here...
$ </pre>
          </div>
          <div class="terminal-input-wrapper">
            <span class="terminal-prompt">$</span>
            <input type="text" class="terminal-input" placeholder="Enter command..." />
          </div>
        </div>
      </div>

      <div class="section">
        <h3>Task Scheduler</h3>
        <div class="task-scheduler">
          <button class="btn btn-primary">New Task</button>
          <div class="table-container">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Task Name</th>
                  <th>Command</th>
                  <th>Schedule</th>
                  <th>Last Run</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td colspan="6" class="muted">No scheduled tasks...</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div class="section">
        <h3>Command History</h3>
        <div class="table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Command</th>
                <th>Exit Code</th>
                <th>Duration</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colspan="5" class="muted">No command history yet...</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="section">
        <h3>Notifications</h3>
        <div class="notifications-panel">
          <button class="btn btn-primary">Send Test Notification</button>
          <div class="notification-settings">
            <div class="form-group">
              <label>
                <input type="checkbox" />
                Enable desktop notifications
              </label>
            </div>
            <div class="form-group">
              <label>
                <input type="checkbox" />
                Show command completion notifications
              </label>
            </div>
          </div>
          <div class="notification-log">
            <h4>Recent Notifications:</h4>
            <div class="notification-list">
              <p class="muted">No notifications...</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}
