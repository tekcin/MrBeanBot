import { html } from "lit";

export type FilesProps = {
  connected: boolean;
};

export function renderFiles(props: FilesProps) {
  if (!props.connected) {
    return html`
      <div class="view">
        <div class="view__header">
          <h2>File Manager</h2>
          <p class="muted">Browse, upload, download, and edit configuration files.</p>
        </div>
        <div class="placeholder">
          <p>Disconnected. Connect to the gateway to browse files.</p>
        </div>
      </div>
    `;
  }

  return html`
    <div class="view">
      <div class="view__header">
        <h2>File Manager</h2>
        <p class="muted">Browse, upload, download, and edit configuration files.</p>
      </div>

      <div class="section">
        <h3>File Browser</h3>
        <div class="file-browser">
          <div class="file-toolbar">
            <div class="breadcrumb">
              <span class="breadcrumb-item">~</span>
              <span class="breadcrumb-separator">/</span>
              <span class="breadcrumb-item">.MrBeanBot</span>
            </div>
            <div class="file-actions">
              <button class="btn btn-sm btn-primary">Upload</button>
              <button class="btn btn-sm btn-secondary">New Folder</button>
              <button class="btn btn-sm btn-secondary">Refresh</button>
            </div>
          </div>
          <div class="table-container">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Size</th>
                  <th>Modified</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>📁 ..</td>
                  <td>Parent Directory</td>
                  <td>-</td>
                  <td>-</td>
                  <td></td>
                </tr>
                <tr>
                  <td>📄 MrBeanBot.json</td>
                  <td>Configuration</td>
                  <td>2.5 KB</td>
                  <td>2024-01-27 10:30</td>
                  <td>
                    <button class="btn btn-sm btn-secondary">Edit</button>
                    <button class="btn btn-sm btn-secondary">Download</button>
                  </td>
                </tr>
                <tr>
                  <td>📁 sessions</td>
                  <td>Directory</td>
                  <td>-</td>
                  <td>2024-01-27 10:20</td>
                  <td>
                    <button class="btn btn-sm btn-secondary">Open</button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div class="section">
        <h3>Quick Access</h3>
        <div class="quick-access">
          <button class="btn btn-secondary">Config Directory</button>
          <button class="btn btn-secondary">Sessions Directory</button>
          <button class="btn btn-secondary">Logs Directory</button>
          <button class="btn btn-secondary">Skills Directory</button>
        </div>
      </div>

      <div class="section">
        <h3>File Editor</h3>
        <div class="file-editor">
          <div class="editor-toolbar">
            <span class="editor-title">No file selected</span>
            <div class="editor-actions">
              <button class="btn btn-sm btn-primary" disabled>Save</button>
              <button class="btn btn-sm btn-secondary" disabled>Close</button>
            </div>
          </div>
          <textarea class="editor-content" disabled placeholder="Select a file to edit..."></textarea>
        </div>
      </div>
    </div>
  `;
}
