import { LitElement, css, html, svg } from "lit";
import { customElement, state } from "lit/decorators.js";

import type { LogEntry, LogType, LogSortOrder, DevlogEntry } from "./types.js";
import { formatLogForExport } from "./types.js";
import { wsClient } from "../services/ws-client.js";
import "./log-timeline-item.js";
import "./devlog-timeline-item.js";
import "./xpost-modal.js";
import type { ContentInput } from "./xpost-modal.js";

const refreshIcon = svg`<path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 16h5v5"/>`;
const copyIcon = svg`<rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>`;

type FilterOption = "all" | LogType | "devlog";

@customElement("indra-log-page")
export class LogPageElement extends LitElement {
  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      gap: 24px;
      font-family: var(--font-family, "Geist Mono", monospace);
      color: var(--text-primary, #2d3436);
    }

    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .page-title {
      font-size: 28px;
      font-weight: 600;
      color: var(--text-primary, #2d3436);
    }

    .refresh-btn {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 8px 16px;
      border-radius: 8px;
      border: 1px solid var(--border, #e0e0e0);
      background: white;
      color: var(--text-primary, #2d3436);
      font-family: inherit;
      font-size: 14px;
      cursor: pointer;
      transition: background 0.2s;
    }

    .refresh-btn:hover:not(:disabled) {
      background: var(--bg-tertiary, #f5f5f5);
    }

    .refresh-btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .refresh-btn svg {
      width: 16px;
      height: 16px;
      stroke: currentColor;
      stroke-width: 2;
      stroke-linecap: round;
      stroke-linejoin: round;
      fill: none;
    }

    .refresh-btn.loading svg {
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      from {
        transform: rotate(0deg);
      }
      to {
        transform: rotate(360deg);
      }
    }

    .controls {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 16px;
    }

    .tabs {
      display: flex;
      gap: 4px;
      padding: 4px;
      background: white;
      border-radius: 12px;
      overflow-x: auto;
      max-width: 100%;
      flex-wrap: wrap;
    }

    .tab {
      padding: 6px 12px;
      border-radius: 8px;
      border: none;
      background: transparent;
      color: var(--text-secondary, #636e72);
      font-family: inherit;
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
      transition:
        background 0.2s,
        color 0.2s;
      white-space: nowrap;
    }

    .tab:hover {
      background: var(--bg-tertiary, #f5f5f5);
    }

    .tab.active {
      background: var(--primary, #2e7d32);
      color: white;
    }

    .sort-select {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      border-radius: 8px;
      border: 1px solid var(--border, #e0e0e0);
      background: white;
      color: var(--text-primary, #2d3436);
      font-family: inherit;
      font-size: 14px;
      cursor: pointer;
      appearance: none;
      padding-right: 32px;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23636e72' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E");
      background-repeat: no-repeat;
      background-position: right 8px center;
    }

    .sort-select:hover {
      background-color: var(--bg-tertiary, #f5f5f5);
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23636e72' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E");
    }

    .timeline {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .empty-state {
      text-align: center;
      padding: 60px 24px;
      background: white;
      border-radius: 12px;
      color: var(--text-secondary, #636e72);
    }

    .empty-state-text {
      font-size: 16px;
    }

    .loading-state {
      text-align: center;
      padding: 60px 24px;
      background: white;
      border-radius: 12px;
      color: var(--text-secondary, #636e72);
    }

    .error-state {
      text-align: center;
      padding: 24px;
      background: #ffebee;
      border-radius: 12px;
      color: #c62828;
      font-size: 14px;
    }

    .header-actions {
      display: flex;
      gap: 8px;
    }

    .copy-btn {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 8px 16px;
      border-radius: 8px;
      border: 1px solid var(--border, #e0e0e0);
      background: white;
      color: var(--text-primary, #2d3436);
      font-family: inherit;
      font-size: 14px;
      cursor: pointer;
      transition: background 0.2s;
    }

    .copy-btn:hover {
      background: var(--bg-tertiary, #f5f5f5);
    }

    .copy-btn svg {
      width: 16px;
      height: 16px;
      stroke: currentColor;
      stroke-width: 2;
      stroke-linecap: round;
      stroke-linejoin: round;
      fill: none;
    }

    .copy-btn.copied {
      background: var(--primary, #2e7d32);
      color: white;
      border-color: var(--primary, #2e7d32);
    }
  `;

  @state()
  private filter: FilterOption = "all";

  @state()
  private sortOrder: LogSortOrder = "newest";

  @state()
  private logs: LogEntry[] = [];

  @state()
  private expandedId: string | null = null;

  @state()
  private loading = false;

  @state()
  private refreshing = false;

  @state()
  private error: string | null = null;

  @state()
  private copied = false;

  @state()
  private devlogs: DevlogEntry[] = [];

  @state()
  private selectedDevlog: DevlogEntry | null = null;

  @state()
  private xpostContent: ContentInput | null = null;

  connectedCallback(): void {
    super.connectedCallback();
    this.loadLogs();
    wsClient.addEventListener("logs.updated", this.handleLogsUpdated);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    wsClient.removeEventListener("logs.updated", this.handleLogsUpdated);
  }

  private handleLogsUpdated = (event: Event): void => {
    const customEvent = event as CustomEvent<{ log: LogEntry }>;
    this.logs = [...this.logs, customEvent.detail.log];
  };

  private async loadLogs(): Promise<void> {
    if (!wsClient.isConnected) {
      // Wait for connection
      wsClient.addEventListener("connected", () => this.loadLogs(), {
        once: true,
      });
      return;
    }

    this.loading = true;
    this.error = null;

    try {
      this.logs = await wsClient.logsList();
    } catch (err) {
      this.error = err instanceof Error ? err.message : "Failed to load logs";
    } finally {
      this.loading = false;
    }
  }

  private get displayLogs(): LogEntry[] {
    const filtered =
      this.filter === "all"
        ? this.logs
        : this.logs.filter((log) => log.type === this.filter);

    return [...filtered].sort((a, b) => {
      const dateA = new Date(a.timestamp).getTime();
      const dateB = new Date(b.timestamp).getTime();
      return this.sortOrder === "newest" ? dateB - dateA : dateA - dateB;
    });
  }

  private get displayDevlogs(): DevlogEntry[] {
    return [...this.devlogs].sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      return this.sortOrder === "newest" ? dateB - dateA : dateA - dateB;
    });
  }

  private async handleTabClick(filter: FilterOption): Promise<void> {
    this.filter = filter;
    if (filter === "devlog" && this.devlogs.length === 0) {
      await this.loadDevlogs();
    }
  }

  private async loadDevlogs(): Promise<void> {
    try {
      this.devlogs = await wsClient.devlogList({ limit: 30 });
    } catch (err) {
      this.error =
        err instanceof Error ? err.message : "Failed to load devlogs";
    }
  }

  private handleSortChange(e: Event): void {
    const select = e.target as HTMLSelectElement;
    this.sortOrder = select.value as LogSortOrder;
  }

  private async handleRefresh(): Promise<void> {
    if (this.refreshing) return;

    this.refreshing = true;
    this.error = null;

    try {
      this.logs = await wsClient.logsRefresh();
    } catch (err) {
      this.error =
        err instanceof Error ? err.message : "Failed to refresh logs";
    } finally {
      this.refreshing = false;
    }
  }

  private async handleCopyAll(): Promise<void> {
    const exportData = {
      logs: this.displayLogs.map(formatLogForExport),
      metadata: {
        exportedAt: new Date().toISOString(),
        totalCount: this.displayLogs.length,
        filters: {
          type: this.filter,
          sortOrder: this.sortOrder,
        },
      },
    };

    try {
      await navigator.clipboard.writeText(JSON.stringify(exportData, null, 2));
      this.copied = true;
      setTimeout(() => {
        this.copied = false;
      }, 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  }

  private handleToggle(e: CustomEvent): void {
    const { id } = e.detail;
    this.expandedId = this.expandedId === id ? null : id;
  }

  private handleDevlogToggle(e: CustomEvent): void {
    const { id } = e.detail;
    this.selectedDevlog =
      this.selectedDevlog?.id === id
        ? null
        : (this.devlogs.find((d) => d.id === id) ?? null);
  }

  private handlePostToX(e: CustomEvent<{ devlog: DevlogEntry }>): void {
    const devlog = e.detail.devlog;
    this.xpostContent = {
      id: `devlog_${devlog.id}`,
      title: `開発ログ ${devlog.date}`,
      url: "",
      content: this.formatDevlogForXpost(devlog),
      summary: `${devlog.stats.totalCommits}件のコミット`,
    };
  }

  private formatDevlogForXpost(entry: DevlogEntry): string {
    const commits = entry.commits
      .map((c) => `- ${c.type}: ${c.message}`)
      .join("\n");
    return `# ${entry.date}の開発ログ\n\n${commits}\n\n統計: ${entry.stats.filesChanged}ファイル変更, +${entry.stats.insertions}, -${entry.stats.deletions}`;
  }

  private handleCloseXpostModal(): void {
    this.xpostContent = null;
  }

  private renderContent(): ReturnType<typeof html> {
    if (this.filter === "devlog") {
      return this.renderDevlogContent();
    }

    if (this.error) {
      return html`<div class="error-state">${this.error}</div>`;
    }

    if (this.loading) {
      return html`<div class="loading-state">Loading logs...</div>`;
    }

    if (this.displayLogs.length === 0) {
      return html`
        <div class="empty-state">
          <div class="empty-state-text">
            No logs found. Logs will appear here as agent actions occur.
          </div>
        </div>
      `;
    }

    return html`
      <div class="timeline">
        ${this.displayLogs.map(
          (log) => html`
            <indra-log-timeline-item
              .log="${log}"
              .expanded="${this.expandedId === log.id}"
              @toggle="${this.handleToggle}"
            ></indra-log-timeline-item>
          `,
        )}
      </div>
    `;
  }

  private renderDevlogContent(): ReturnType<typeof html> {
    if (this.error) {
      return html`<div class="error-state">${this.error}</div>`;
    }

    if (this.devlogs.length === 0) {
      return html`<div class="empty-state">No devlogs found.</div>`;
    }

    return html`
      <div class="timeline">
        ${this.displayDevlogs.map(
          (devlog) => html`
            <indra-devlog-timeline-item
              .devlog="${devlog}"
              .expanded="${this.selectedDevlog?.id === devlog.id}"
              @toggle="${(e: CustomEvent) => this.handleDevlogToggle(e)}"
              @post-to-x="${(e: CustomEvent<{ devlog: DevlogEntry }>) =>
                this.handlePostToX(e)}"
            ></indra-devlog-timeline-item>
          `,
        )}
      </div>
    `;
  }

  render() {
    return html`
      <div class="page-header">
        <span class="page-title">Logs</span>
        <div class="header-actions">
          <button
            class="copy-btn ${this.copied ? "copied" : ""}"
            @click="${this.handleCopyAll}"
            ?disabled="${this.displayLogs.length === 0}"
          >
            <svg viewBox="0 0 24 24">${copyIcon}</svg>
            ${this.copied ? "Copied!" : "Copy All"}
          </button>
          <button
            class="refresh-btn ${this.refreshing ? "loading" : ""}"
            @click="${this.handleRefresh}"
            ?disabled="${this.refreshing}"
          >
            <svg viewBox="0 0 24 24">${refreshIcon}</svg>
            ${this.refreshing ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </div>

      <div class="controls">
        <div class="tabs">
          <button
            class="tab ${this.filter === "all" ? "active" : ""}"
            @click="${() => this.handleTabClick("all")}"
          >
            All
          </button>
          <button
            class="tab ${this.filter === "agent" ? "active" : ""}"
            @click="${() => this.handleTabClick("agent")}"
          >
            Agent
          </button>
          <button
            class="tab ${this.filter === "execution" ? "active" : ""}"
            @click="${() => this.handleTabClick("execution")}"
          >
            Execution
          </button>
          <button
            class="tab ${this.filter === "api" ? "active" : ""}"
            @click="${() => this.handleTabClick("api")}"
          >
            API
          </button>
          <button
            class="tab ${this.filter === "approval" ? "active" : ""}"
            @click="${() => this.handleTabClick("approval")}"
          >
            Approval
          </button>
          <button
            class="tab ${this.filter === "scheduler" ? "active" : ""}"
            @click="${() => this.handleTabClick("scheduler")}"
          >
            Scheduler
          </button>
          <button
            class="tab ${this.filter === "browser" ? "active" : ""}"
            @click="${() => this.handleTabClick("browser")}"
          >
            Browser
          </button>
          <button
            class="tab ${this.filter === "auth" ? "active" : ""}"
            @click="${() => this.handleTabClick("auth")}"
          >
            Auth
          </button>
          <button
            class="tab ${this.filter === "memory" ? "active" : ""}"
            @click="${() => this.handleTabClick("memory")}"
          >
            Memory
          </button>
          <button
            class="tab ${this.filter === "user" ? "active" : ""}"
            @click="${() => this.handleTabClick("user")}"
          >
            User
          </button>
          <button
            class="tab ${this.filter === "system" ? "active" : ""}"
            @click="${() => this.handleTabClick("system")}"
          >
            System
          </button>
          <button
            class="tab ${this.filter === "devlog" ? "active" : ""}"
            @click="${() => this.handleTabClick("devlog")}"
          >
            Devlog
          </button>
        </div>

        <select
          class="sort-select"
          .value="${this.sortOrder}"
          @change="${this.handleSortChange}"
        >
          <option value="newest">Newest First</option>
          <option value="oldest">Oldest First</option>
        </select>
      </div>

      ${this.renderContent()}
      ${this.xpostContent
        ? html`
            <indra-xpost-modal
              .contentInput="${this.xpostContent}"
              @close="${this.handleCloseXpostModal}"
              @approved="${this.handleCloseXpostModal}"
            ></indra-xpost-modal>
          `
        : null}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "indra-log-page": LogPageElement;
  }
}
