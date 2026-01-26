import { LitElement, css, html, svg } from "lit";
import { customElement, state } from "lit/decorators.js";

// Lucide icon - Bot
const botIcon = svg`<path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/>`;

type TabId = "general" | "llm" | "sns" | "cron";
type Language = "en" | "ja" | "zh";
type Theme = "light" | "dark" | "auto";

interface LLMConfig {
  model: string;
  systemPrompt?: string;
}

interface GeneralConfig {
  language: Language;
  theme: Theme;
  notifications: boolean;
  autoSave: boolean;
}

interface Config {
  general: GeneralConfig;
  llm: LLMConfig;
}

const TABS: { id: TabId; label: string }[] = [
  { id: "general", label: "General" },
  { id: "llm", label: "LLM" },
  { id: "sns", label: "SNS" },
  { id: "cron", label: "Cron" },
];

const MODELS = [
  { value: "sonnet", label: "Claude Sonnet (Recommended)" },
  { value: "opus", label: "Claude Opus" },
  { value: "haiku", label: "Claude Haiku" },
];

@customElement("indra-settings-page")
export class SettingsPageElement extends LitElement {
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

    .tabs {
      display: flex;
      gap: 0;
      border-bottom: 1px solid var(--border, #e0e0e0);
    }

    .tab {
      padding: 12px 16px;
      background: transparent;
      border: none;
      border-bottom: 2px solid transparent;
      cursor: pointer;
      font-size: 14px;
      font-weight: normal;
      color: var(--text-secondary, #636e72);
      font-family: var(--font-family, "Geist Mono", monospace);
      transition: all 0.15s ease;
      margin-bottom: -1px;
    }

    .tab:hover {
      color: var(--primary, #2e7d32);
    }

    .tab.active {
      color: var(--primary, #2e7d32);
      font-weight: 600;
      border-bottom-color: var(--primary, #2e7d32);
    }

    .tab-content {
      background: white;
      border-radius: 12px;
      padding: 32px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
    }

    .form-group {
      margin-bottom: 24px;
    }

    .form-group label {
      display: block;
      margin-bottom: 8px;
      font-size: 14px;
      font-weight: 600;
      color: var(--text-primary, #2d3436);
    }

    .form-group input,
    .form-group select,
    .form-group textarea {
      width: 100%;
      padding: 10px 12px;
      border: 1px solid var(--border, #e0e0e0);
      border-radius: 8px;
      font-size: 14px;
      font-family: "Geist Mono", "Inter", system-ui, monospace;
      box-sizing: border-box;
    }

    .form-group textarea {
      min-height: 80px;
      resize: vertical;
    }

    .form-group input:focus,
    .form-group select:focus,
    .form-group textarea:focus {
      outline: none;
      border-color: var(--primary, #2e7d32);
      box-shadow: 0 0 0 3px rgba(46, 125, 50, 0.1);
    }

    .form-group .description {
      margin-top: 6px;
      font-size: 12px;
      color: var(--text-secondary, #636e72);
    }

    .section-title {
      font-size: 18px;
      font-weight: 700;
      margin-bottom: 20px;
      color: var(--primary, #2e7d32);
      padding-bottom: 12px;
      border-bottom: 2px solid var(--bg-tertiary, #f5f5f5);
    }

    .provider-badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 12px 16px;
      background: var(--bg-primary, #e8f5e9);
      border-radius: 8px;
      margin-bottom: 24px;
    }

    .provider-badge .icon {
      width: 24px;
      height: 24px;
    }

    .provider-badge .icon svg {
      width: 100%;
      height: 100%;
      fill: none;
      stroke: var(--primary, #2e7d32);
      stroke-width: 2;
      stroke-linecap: round;
      stroke-linejoin: round;
    }

    .provider-badge .text {
      font-size: 14px;
      font-weight: 600;
      color: var(--primary, #2e7d32);
    }

    .provider-badge .subtext {
      font-size: 12px;
      color: var(--text-secondary, #636e72);
    }

    .btn {
      padding: 10px 20px;
      background: var(--primary, #2e7d32);
      color: white;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 500;
      font-family: "Geist Mono", "Inter", system-ui, monospace;
    }

    .btn:hover:not(:disabled) {
      background: #1b5e20;
    }

    .btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .btn-secondary {
      background: var(--bg-tertiary, #f5f5f5);
      color: var(--text-primary, #2d3436);
    }

    .btn-secondary:hover:not(:disabled) {
      background: var(--border, #e0e0e0);
    }

    .actions {
      display: flex;
      gap: 12px;
      margin-top: 32px;
      padding-top: 24px;
      border-top: 1px solid var(--border, #e0e0e0);
    }

    .list-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px;
      background: var(--bg-primary, #e8f5e9);
      border-radius: 8px;
      margin-bottom: 12px;
    }

    .list-item-info {
      flex: 1;
    }

    .list-item-title {
      font-weight: 600;
      margin-bottom: 4px;
    }

    .list-item-desc {
      font-size: 12px;
      color: var(--text-secondary, #636e72);
    }

    .switch {
      position: relative;
      width: 44px;
      height: 24px;
      background: var(--border, #e0e0e0);
      border-radius: 12px;
      cursor: pointer;
      transition: background 0.15s ease;
    }

    .switch.active {
      background: var(--primary, #2e7d32);
    }

    .switch::after {
      content: "";
      position: absolute;
      width: 20px;
      height: 20px;
      background: white;
      border-radius: 50%;
      top: 2px;
      left: 2px;
      transition: transform 0.15s ease;
    }

    .switch.active::after {
      transform: translateX(20px);
    }

    .status-message {
      padding: 12px 16px;
      border-radius: 8px;
      font-size: 14px;
      margin-bottom: 16px;
    }

    .status-message.success {
      background: #e8f5e9;
      color: #2e7d32;
    }

    .status-message.error {
      background: #ffebee;
      color: #c62828;
    }

    .loading {
      opacity: 0.6;
      pointer-events: none;
    }
  `;

  @state()
  activeTab: TabId = "general";

  @state()
  config: Config = {
    general: {
      language: "en",
      theme: "auto",
      notifications: true,
      autoSave: true,
    },
    llm: {
      model: "sonnet",
      systemPrompt: "",
    },
  };

  @state()
  private loading = false;

  @state()
  private statusMessage: { type: "success" | "error"; text: string } | null =
    null;

  @state()
  private testingConnection = false;

  private ws: WebSocket | null = null;
  private pendingRequests = new Map<
    string,
    { resolve: (value: unknown) => void; reject: (reason: unknown) => void }
  >();

  connectedCallback(): void {
    super.connectedCallback();
    this.connectWebSocket();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    if (this.ws) {
      this.ws.close();
    }
  }

  private connectWebSocket(): void {
    this.ws = new WebSocket("ws://localhost:3001");

    this.ws.onopen = () => {
      this.loadConfig();
    };

    this.ws.onmessage = (event) => {
      try {
        const frame = JSON.parse(event.data);
        if (frame.type === "res" && frame.id) {
          const pending = this.pendingRequests.get(frame.id);
          if (pending) {
            this.pendingRequests.delete(frame.id);
            if (frame.ok) {
              pending.resolve(frame.payload);
            } else {
              pending.reject(
                new Error(frame.error?.message ?? "Unknown error"),
              );
            }
          }
        }
      } catch {
        // Ignore parse errors
      }
    };

    this.ws.onerror = () => {
      this.statusMessage = {
        type: "error",
        text: "WebSocket connection error",
      };
    };
  }

  private async sendRequest(
    method: string,
    params?: unknown,
  ): Promise<unknown> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error("WebSocket not connected");
    }

    const id = crypto.randomUUID();
    const frame = { type: "req", id, method, params };

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject });
      this.ws!.send(JSON.stringify(frame));

      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error("Request timeout"));
        }
      }, 30000);
    });
  }

  private getErrorText(error: unknown): string {
    return error instanceof Error ? error.message : "Unknown error";
  }

  private setError(prefix: string, error: unknown): void {
    this.statusMessage = {
      type: "error",
      text: `${prefix}: ${this.getErrorText(error)}`,
    };
  }

  private async loadConfig(): Promise<void> {
    try {
      this.loading = true;
      const result = (await this.sendRequest("config.get")) as {
        config: Config;
      };
      this.config = result.config;
    } catch (error) {
      this.setError("Failed to load config", error);
    } finally {
      this.loading = false;
    }
  }

  private async saveConfig(): Promise<void> {
    try {
      this.loading = true;
      this.statusMessage = null;
      const result = (await this.sendRequest("config.set", this.config)) as {
        config: Config;
      };
      this.config = result.config;
      this.statusMessage = { type: "success", text: "Configuration saved!" };
    } catch (error) {
      this.setError("Failed to save config", error);
    } finally {
      this.loading = false;
    }
  }

  private async testConnection(): Promise<void> {
    try {
      this.testingConnection = true;
      this.statusMessage = null;

      await this.sendRequest("config.set", this.config);

      const result = (await this.sendRequest("llm.test")) as {
        success: boolean;
        response: string;
      };
      this.statusMessage = {
        type: "success",
        text: `Connection successful! Response: ${result.response.slice(0, 100)}...`,
      };
    } catch (error) {
      this.setError("Connection failed", error);
    } finally {
      this.testingConnection = false;
    }
  }

  private handleTabClick(tabId: TabId): void {
    this.activeTab = tabId;
    this.statusMessage = null;
  }

  private updateGeneralConfig<K extends keyof GeneralConfig>(
    key: K,
    value: GeneralConfig[K],
  ): void {
    this.config = {
      ...this.config,
      general: { ...this.config.general, [key]: value },
    };
  }

  private handleModelChange(e: Event): void {
    const select = e.target as HTMLSelectElement;
    this.config = {
      ...this.config,
      llm: {
        ...this.config.llm,
        model: select.value,
      },
    };
  }

  private handleSystemPromptChange(e: Event): void {
    const target = e.target as HTMLTextAreaElement;
    this.config = {
      ...this.config,
      llm: {
        ...this.config.llm,
        systemPrompt: target.value || undefined,
      },
    };
  }

  private renderTabContent() {
    const tabRenderers: Record<TabId, () => ReturnType<typeof html>> = {
      general: () => this.renderGeneralTab(),
      llm: () => this.renderLLMTab(),
      sns: () => this.renderSNSTab(),
      cron: () => this.renderCronTab(),
    };
    return tabRenderers[this.activeTab]();
  }

  private renderGeneralTab() {
    return html`
      <h2 class="section-title">General Settings</h2>

      <div class="form-group">
        <label>Application Name</label>
        <input type="text" value="indra" disabled />
        <div class="description">The name of your application</div>
      </div>

      <div class="form-group">
        <label>Default Language</label>
        <select
          .value="${this.config.general.language}"
          @change="${(e: Event) =>
            this.updateGeneralConfig(
              "language",
              (e.target as HTMLSelectElement).value as Language,
            )}"
        >
          <option value="en">English</option>
          <option value="ja">Japanese</option>
          <option value="zh">Chinese</option>
        </select>
      </div>

      <div class="form-group">
        <label>Theme</label>
        <select
          .value="${this.config.general.theme}"
          @change="${(e: Event) =>
            this.updateGeneralConfig(
              "theme",
              (e.target as HTMLSelectElement).value as Theme,
            )}"
        >
          <option value="light">Light</option>
          <option value="dark">Dark</option>
          <option value="auto">Auto</option>
        </select>
      </div>

      <div class="list-item">
        <div class="list-item-info">
          <div class="list-item-title">Notifications</div>
          <div class="list-item-desc">Enable desktop notifications</div>
        </div>
        <div
          class="switch ${this.config.general.notifications ? "active" : ""}"
          @click="${() =>
            this.updateGeneralConfig(
              "notifications",
              !this.config.general.notifications,
            )}"
        ></div>
      </div>

      <div class="list-item">
        <div class="list-item-info">
          <div class="list-item-title">Auto-save</div>
          <div class="list-item-desc">Automatically save changes</div>
        </div>
        <div
          class="switch ${this.config.general.autoSave ? "active" : ""}"
          @click="${() =>
            this.updateGeneralConfig(
              "autoSave",
              !this.config.general.autoSave,
            )}"
        ></div>
      </div>

      <div class="actions">
        <button
          class="btn"
          ?disabled="${this.loading}"
          @click="${this.saveConfig}"
        >
          Save Changes
        </button>
      </div>
    `;
  }

  private renderLLMTab() {
    return html`
      <h2 class="section-title">LLM Configuration</h2>

      ${this.statusMessage
        ? html`<div class="status-message ${this.statusMessage.type}">
            ${this.statusMessage.text}
          </div>`
        : ""}

      <div class="provider-badge">
        <span class="icon"><svg viewBox="0 0 24 24">${botIcon}</svg></span>
        <div>
          <div class="text">Claude Agent SDK</div>
          <div class="subtext">Using Claude subscription authentication</div>
        </div>
      </div>

      <div class="form-group">
        <label>Model</label>
        <select
          .value="${this.config.llm.model}"
          @change="${this.handleModelChange}"
        >
          ${MODELS.map(
            (m) => html`<option value="${m.value}">${m.label}</option>`,
          )}
        </select>
        <div class="description">
          Select the Claude model to use for AI interactions
        </div>
      </div>

      <div class="form-group">
        <label>System Prompt</label>
        <textarea
          placeholder="You are a helpful assistant..."
          .value="${this.config.llm.systemPrompt ?? ""}"
          @input="${this.handleSystemPromptChange}"
        ></textarea>
        <div class="description">
          Optional instructions that guide the AI's behavior
        </div>
      </div>

      <div class="actions">
        <button
          class="btn"
          ?disabled="${this.loading}"
          @click="${this.saveConfig}"
        >
          Save Configuration
        </button>
        <button
          class="btn btn-secondary"
          ?disabled="${this.testingConnection}"
          @click="${this.testConnection}"
        >
          ${this.testingConnection ? "Testing..." : "Test Connection"}
        </button>
      </div>
    `;
  }

  private renderSNSTab() {
    return html`
      <h2 class="section-title">SNS Integration</h2>

      <div class="list-item">
        <div class="list-item-info">
          <div class="list-item-title">Twitter / X</div>
          <div class="list-item-desc">Connect your Twitter account</div>
        </div>
        <div class="switch"></div>
      </div>

      <div class="form-group">
        <label>API Key</label>
        <input type="password" placeholder="Twitter API Key" />
      </div>

      <div class="form-group">
        <label>API Secret</label>
        <input type="password" placeholder="Twitter API Secret" />
      </div>

      <div class="form-group">
        <label>Access Token</label>
        <input type="password" placeholder="Access Token" />
      </div>

      <div class="form-group">
        <label>Access Token Secret</label>
        <input type="password" placeholder="Access Token Secret" />
      </div>

      <div class="list-item">
        <div class="list-item-info">
          <div class="list-item-title">Auto-post</div>
          <div class="list-item-desc">Automatically post approved content</div>
        </div>
        <div class="switch active"></div>
      </div>

      <div class="actions">
        <button class="btn">Save Configuration</button>
        <button class="btn btn-secondary">Authorize</button>
      </div>
    `;
  }

  private renderCronTab() {
    return html`
      <h2 class="section-title">Cron Jobs</h2>

      <div class="list-item">
        <div class="list-item-info">
          <div class="list-item-title">Daily Backup</div>
          <div class="list-item-desc">Run daily at 2:00 AM</div>
        </div>
        <div class="switch active"></div>
      </div>

      <div class="list-item">
        <div class="list-item-info">
          <div class="list-item-title">Content Sync</div>
          <div class="list-item-desc">Sync content every hour</div>
        </div>
        <div class="switch active"></div>
      </div>

      <div class="list-item">
        <div class="list-item-info">
          <div class="list-item-title">Cleanup Logs</div>
          <div class="list-item-desc">Clean up old logs weekly</div>
        </div>
        <div class="switch"></div>
      </div>

      <div class="form-group">
        <label>Add New Cron Job</label>
        <input type="text" placeholder="* * * * *" />
        <div class="description">Cron expression (e.g., 0 2 * * *)</div>
      </div>

      <div class="form-group">
        <label>Job Command</label>
        <textarea placeholder="Enter command to execute..."></textarea>
      </div>

      <div class="actions">
        <button class="btn">Add Job</button>
        <button class="btn btn-secondary">View Logs</button>
      </div>
    `;
  }

  render() {
    return html`
      <div class="page-header">
        <span class="page-title">Settings</span>
      </div>

      <div class="tabs">
        ${TABS.map(
          (tab) => html`
            <button
              class="tab ${this.activeTab === tab.id ? "active" : ""}"
              @click="${() => this.handleTabClick(tab.id)}"
            >
              ${tab.label}
            </button>
          `,
        )}
      </div>

      <div class="tab-content ${this.loading ? "loading" : ""}">
        ${this.renderTabContent()}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "indra-settings-page": SettingsPageElement;
  }
}
