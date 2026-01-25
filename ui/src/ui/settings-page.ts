import { LitElement, css, html } from "lit";
import { customElement, state } from "lit/decorators.js";

type TabId = "general" | "llm" | "sns" | "cron";
type ProviderId = "anthropic" | "openai" | "google" | "ollama";
type Language = "en" | "ja" | "zh";
type Theme = "light" | "dark" | "auto";

interface LLMConfig {
  provider: ProviderId;
  apiKey?: string;
  model: string;
  temperature: number;
  maxTokens: number;
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

const PROVIDERS: { value: ProviderId; label: string }[] = [
  { value: "anthropic", label: "Anthropic Claude" },
  { value: "openai", label: "OpenAI" },
  { value: "google", label: "Google Gemini" },
  { value: "ollama", label: "Ollama (Local)" },
];

const DEFAULT_MODELS: Record<ProviderId, string> = {
  anthropic: "claude-sonnet-4-20250514",
  openai: "gpt-4o",
  google: "gemini-2.0-flash",
  ollama: "llama3.2",
};

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
      provider: "anthropic",
      apiKey: "",
      model: "claude-sonnet-4-20250514",
      temperature: 0.7,
      maxTokens: 2048,
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
              pending.resolve(frame.data);
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

  private async loadConfig(): Promise<void> {
    try {
      this.loading = true;
      const result = (await this.sendRequest("config.get")) as {
        config: Config;
      };
      this.config = result.config;
    } catch (error) {
      this.statusMessage = {
        type: "error",
        text: `Failed to load config: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
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
      this.statusMessage = {
        type: "error",
        text: `Failed to save config: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    } finally {
      this.loading = false;
    }
  }

  private async testConnection(): Promise<void> {
    try {
      this.testingConnection = true;
      this.statusMessage = null;

      // First save current config
      await this.sendRequest("config.set", this.config);

      // Then test connection
      const result = (await this.sendRequest("llm.test")) as {
        success: boolean;
        response: string;
      };
      this.statusMessage = {
        type: "success",
        text: `Connection successful! Response: ${result.response.slice(0, 100)}...`,
      };
    } catch (error) {
      this.statusMessage = {
        type: "error",
        text: `Connection failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
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

  private handleProviderChange(e: Event): void {
    const select = e.target as HTMLSelectElement;
    const provider = select.value as ProviderId;
    this.config = {
      ...this.config,
      llm: {
        ...this.config.llm,
        provider,
        model: DEFAULT_MODELS[provider],
      },
    };
  }

  private handleLLMInputChange(field: keyof LLMConfig, e: Event): void {
    const target = e.target as HTMLInputElement | HTMLTextAreaElement;
    let value: string | number = target.value;

    if (field === "temperature") {
      value = parseFloat(value) || 0.7;
    } else if (field === "maxTokens") {
      value = parseInt(value, 10) || 2048;
    }

    this.config = {
      ...this.config,
      llm: {
        ...this.config.llm,
        [field]: value,
      },
    };
  }

  private renderTabContent() {
    switch (this.activeTab) {
      case "general":
        return this.renderGeneralTab();
      case "llm":
        return this.renderLLMTab();
      case "sns":
        return this.renderSNSTab();
      case "cron":
        return this.renderCronTab();
    }
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

      <div class="form-group">
        <label>Provider</label>
        <select
          .value="${this.config.llm.provider}"
          @change="${this.handleProviderChange}"
        >
          ${PROVIDERS.map(
            (p) => html`<option value="${p.value}">${p.label}</option>`,
          )}
        </select>
      </div>

      <div class="form-group">
        <label>API Key</label>
        <input
          type="password"
          placeholder="sk-..."
          .value="${this.config.llm.apiKey ?? ""}"
          @input="${(e: Event) => this.handleLLMInputChange("apiKey", e)}"
        />
        <div class="description">Your API key for the selected provider</div>
      </div>

      <div class="form-group">
        <label>Model</label>
        <input
          type="text"
          placeholder="${DEFAULT_MODELS[this.config.llm.provider]}"
          .value="${this.config.llm.model}"
          @input="${(e: Event) => this.handleLLMInputChange("model", e)}"
        />
      </div>

      <div class="form-group">
        <label>Temperature</label>
        <input
          type="number"
          min="0"
          max="2"
          step="0.1"
          .value="${String(this.config.llm.temperature)}"
          @input="${(e: Event) => this.handleLLMInputChange("temperature", e)}"
        />
        <div class="description">
          Controls randomness: 0.0 = focused, 2.0 = creative
        </div>
      </div>

      <div class="form-group">
        <label>Max Tokens</label>
        <input
          type="number"
          min="1"
          step="1"
          .value="${String(this.config.llm.maxTokens)}"
          @input="${(e: Event) => this.handleLLMInputChange("maxTokens", e)}"
        />
      </div>

      <div class="form-group">
        <label>System Prompt</label>
        <textarea
          placeholder="You are a helpful assistant..."
          .value="${this.config.llm.systemPrompt ?? ""}"
          @input="${(e: Event) => this.handleLLMInputChange("systemPrompt", e)}"
        ></textarea>
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
