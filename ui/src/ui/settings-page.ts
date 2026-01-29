import { LitElement, css, html, svg } from "lit";
import { customElement, state } from "lit/decorators.js";
import { buildWsUrl } from "../services/ws-url.js";

// Lucide icon - Bot
const botIcon = svg`<path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/>`;

// Lucide icon - Play
const playIcon = svg`<polygon points="5 3 19 12 5 21 5 3"/>`;

// Lucide icon - Trash
const trashIcon = svg`<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>`;

// Lucide icon - Edit
const editIcon = svg`<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>`;

// Lucide icon - Plus
const plusIcon = svg`<path d="M5 12h14"/><path d="M12 5v14"/>`;

type TabId = "general" | "llm" | "cron" | "sources";
type Language = "en" | "ja" | "zh";
type Theme = "light" | "dark" | "auto";
type NewsSourceType = "x-account" | "rss" | "web" | "github";

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

interface ScheduledTask {
  id: string;
  name: string;
  description?: string;
  taskType: string;
  cronExpression: string;
  enabled: boolean;
  lastRunAt?: string;
  nextRunAt?: string;
  createdAt: string;
  updatedAt: string;
}

interface TaskTypeDefinition {
  type: string;
  name: string;
  description: string;
  defaultCron?: string;
}

interface XAccountConfig {
  handle: string;
  maxTweets?: number;
  hoursBack?: number;
  includeRetweets?: boolean;
  includeReplies?: boolean;
}

interface GitHubChangelogConfig {
  owner: string;
  repo: string;
  branch?: string;
  filePath?: string;
}

interface NewsSourceDefinition {
  id: string;
  name: string;
  sourceType: NewsSourceType;
  sourceConfig:
    | XAccountConfig
    | GitHubChangelogConfig
    | Record<string, unknown>;
  enabled: boolean;
  lastFetchedAt?: string;
  createdAt: string;
  updatedAt: string;
}

const TABS: { id: TabId; label: string }[] = [
  { id: "general", label: "General" },
  { id: "llm", label: "LLM" },
  { id: "cron", label: "Cron" },
  { id: "sources", label: "Sources" },
];

const SOURCE_TYPES: { value: NewsSourceType; label: string }[] = [
  { value: "x-account", label: "X Account" },
  { value: "rss", label: "RSS Feed" },
  { value: "web", label: "Web Page" },
  { value: "github", label: "GitHub Changelog" },
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

    /* Cron tab specific styles */
    .task-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
      margin-bottom: 24px;
    }

    .task-item {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 16px;
      background: var(--bg-primary, #e8f5e9);
      border-radius: 8px;
    }

    .task-item.disabled {
      opacity: 0.6;
    }

    .task-info {
      flex: 1;
      min-width: 0;
    }

    .task-header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 4px;
    }

    .task-name {
      font-weight: 600;
      font-size: 14px;
    }

    .task-type {
      font-size: 11px;
      padding: 2px 6px;
      background: var(--primary, #2e7d32);
      color: white;
      border-radius: 4px;
    }

    .task-meta {
      display: flex;
      gap: 16px;
      font-size: 12px;
      color: var(--text-secondary, #636e72);
    }

    .task-meta span {
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .task-actions {
      display: flex;
      gap: 8px;
      align-items: center;
    }

    .icon-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      padding: 0;
      background: transparent;
      border: 1px solid var(--border, #e0e0e0);
      border-radius: 6px;
      cursor: pointer;
      transition: all 0.15s ease;
    }

    .icon-btn:hover:not(:disabled) {
      background: var(--bg-tertiary, #f5f5f5);
      border-color: var(--primary, #2e7d32);
    }

    .icon-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .icon-btn svg {
      width: 16px;
      height: 16px;
      fill: none;
      stroke: var(--text-secondary, #636e72);
      stroke-width: 2;
      stroke-linecap: round;
      stroke-linejoin: round;
    }

    .icon-btn:hover:not(:disabled) svg {
      stroke: var(--primary, #2e7d32);
    }

    .icon-btn.danger:hover:not(:disabled) {
      border-color: #c62828;
    }

    .icon-btn.danger:hover:not(:disabled) svg {
      stroke: #c62828;
    }

    .icon-btn.running {
      animation: pulse 1s infinite;
    }

    @keyframes pulse {
      0%,
      100% {
        opacity: 1;
      }
      50% {
        opacity: 0.5;
      }
    }

    .task-form {
      background: var(--bg-tertiary, #f5f5f5);
      border-radius: 8px;
      padding: 24px;
      margin-bottom: 24px;
    }

    .task-form-title {
      font-size: 16px;
      font-weight: 600;
      margin-bottom: 16px;
    }

    .task-form-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
    }

    .task-form-actions {
      display: flex;
      gap: 12px;
      margin-top: 16px;
    }

    .btn-icon {
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }

    .btn-icon svg {
      width: 16px;
      height: 16px;
      fill: none;
      stroke: currentColor;
      stroke-width: 2;
      stroke-linecap: round;
      stroke-linejoin: round;
    }

    .empty-state {
      text-align: center;
      padding: 48px 24px;
      color: var(--text-secondary, #636e72);
    }

    .empty-state-text {
      margin-bottom: 16px;
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

  // Cron tab state
  @state()
  private scheduledTasks: ScheduledTask[] = [];

  @state()
  private taskTypes: TaskTypeDefinition[] = [];

  @state()
  private showTaskForm = false;

  @state()
  private editingTaskId: string | null = null;

  @state()
  private taskForm = {
    name: "",
    description: "",
    taskType: "",
    cronExpression: "",
  };

  @state()
  private runningTaskIds = new Set<string>();

  // Sources tab state
  @state()
  private newsSources: NewsSourceDefinition[] = [];

  @state()
  private showSourceForm = false;

  @state()
  private editingSourceId: string | null = null;

  @state()
  private sourceForm = {
    name: "",
    sourceType: "x-account" as NewsSourceType,
    handle: "",
    maxTweets: 20,
    hoursBack: 0, // 0 = 無制限
    includeRetweets: false,
    includeReplies: false,
    // GitHub用プロパティ
    owner: "",
    repo: "",
    branch: "main",
    filePath: "CHANGELOG.md",
  };

  @state()
  private fetchingSourceIds = new Set<string>();

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
    this.ws = new WebSocket(buildWsUrl());

    this.ws.onopen = () => {
      this.loadConfig();
      this.loadScheduledTasks();
      this.loadNewsSources();
    };

    this.ws.onmessage = (event) => {
      try {
        const frame = JSON.parse(event.data);

        // Handle response frames
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

        // Handle event frames
        if (frame.type === "evt") {
          this.handleEvent(frame.event, frame.payload);
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

  private handleEvent(event: string, payload: unknown): void {
    switch (event) {
      case "schedule.updated": {
        const { task } = payload as { task: ScheduledTask };
        this.scheduledTasks = this.scheduledTasks.map((t) =>
          t.id === task.id ? task : t,
        );
        break;
      }
      case "schedule.executed": {
        const { id, success, error } = payload as {
          id: string;
          success: boolean;
          error?: string;
        };
        this.runningTaskIds = new Set(
          [...this.runningTaskIds].filter((tid) => tid !== id),
        );
        if (success) {
          this.statusMessage = {
            type: "success",
            text: "タスクが実行されました",
          };
        } else {
          this.statusMessage = {
            type: "error",
            text: `タスク実行エラー: ${error}`,
          };
        }
        // Refresh task list to get updated lastRunAt
        this.loadScheduledTasks();
        break;
      }
      case "newsSource.updated": {
        const { source } = payload as { source: NewsSourceDefinition };
        this.newsSources = this.newsSources.map((s) =>
          s.id === source.id ? source : s,
        );
        // フェッチ完了時にフェッチ中状態をクリア
        this.fetchingSourceIds = new Set(
          [...this.fetchingSourceIds].filter((sid) => sid !== source.id),
        );
        break;
      }
      case "newsSource.deleted": {
        const { id } = payload as { id: string };
        this.newsSources = this.newsSources.filter((s) => s.id !== id);
        break;
      }
    }
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

  private getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : "Unknown error";
  }

  private showError(prefix: string, error: unknown): void {
    this.statusMessage = {
      type: "error",
      text: `${prefix}: ${this.getErrorMessage(error)}`,
    };
  }

  private showSuccess(text: string): void {
    this.statusMessage = { type: "success", text };
  }

  private async loadConfig(): Promise<void> {
    try {
      this.loading = true;
      const result = (await this.sendRequest("config.get")) as {
        config: Config;
      };
      this.config = result.config;
    } catch (error) {
      this.showError("Failed to load config", error);
    } finally {
      this.loading = false;
    }
  }

  // ===== Schedule Methods =====

  private async loadScheduledTasks(): Promise<void> {
    try {
      const [tasksResult, typesResult] = await Promise.all([
        this.sendRequest("schedule.list") as Promise<{
          tasks: ScheduledTask[];
        }>,
        this.sendRequest("schedule.taskTypes") as Promise<{
          taskTypes: TaskTypeDefinition[];
        }>,
      ]);
      this.scheduledTasks = tasksResult.tasks;
      this.taskTypes = typesResult.taskTypes;
    } catch (error) {
      this.showError("Failed to load scheduled tasks", error);
    }
  }

  private async createTask(): Promise<void> {
    try {
      this.loading = true;
      const result = (await this.sendRequest("schedule.create", {
        name: this.taskForm.name,
        description: this.taskForm.description || undefined,
        taskType: this.taskForm.taskType,
        cronExpression: this.taskForm.cronExpression,
        enabled: true,
      })) as { task: ScheduledTask };
      this.scheduledTasks = [...this.scheduledTasks, result.task];
      this.resetTaskForm();
      this.showSuccess("タスクを作成しました");
    } catch (error) {
      this.showError("タスク作成エラー", error);
    } finally {
      this.loading = false;
    }
  }

  private async updateTask(): Promise<void> {
    if (!this.editingTaskId) return;
    try {
      this.loading = true;
      const result = (await this.sendRequest("schedule.update", {
        id: this.editingTaskId,
        name: this.taskForm.name,
        description: this.taskForm.description || undefined,
        cronExpression: this.taskForm.cronExpression,
      })) as { task: ScheduledTask };
      this.scheduledTasks = this.scheduledTasks.map((t) =>
        t.id === result.task.id ? result.task : t,
      );
      this.resetTaskForm();
      this.showSuccess("タスクを更新しました");
    } catch (error) {
      this.showError("タスク更新エラー", error);
    } finally {
      this.loading = false;
    }
  }

  private async deleteTask(id: string): Promise<void> {
    if (!confirm("このタスクを削除しますか？")) return;
    try {
      await this.sendRequest("schedule.delete", { id });
      this.scheduledTasks = this.scheduledTasks.filter((t) => t.id !== id);
      this.showSuccess("タスクを削除しました");
    } catch (error) {
      this.showError("タスク削除エラー", error);
    }
  }

  private async toggleTask(id: string, enabled: boolean): Promise<void> {
    try {
      const result = (await this.sendRequest("schedule.toggle", {
        id,
        enabled,
      })) as { task: ScheduledTask };
      this.scheduledTasks = this.scheduledTasks.map((t) =>
        t.id === result.task.id ? result.task : t,
      );
    } catch (error) {
      this.showError("タスク切り替えエラー", error);
    }
  }

  private async runTaskNow(id: string): Promise<void> {
    try {
      this.runningTaskIds = new Set([...this.runningTaskIds, id]);
      await this.sendRequest("schedule.runNow", { id });
      this.showSuccess("タスクを開始しました");
    } catch (error) {
      this.runningTaskIds = new Set(
        [...this.runningTaskIds].filter((tid) => tid !== id),
      );
      this.showError("タスク実行エラー", error);
    }
  }

  private startEditTask(task: ScheduledTask): void {
    this.editingTaskId = task.id;
    this.taskForm = {
      name: task.name,
      description: task.description ?? "",
      taskType: task.taskType,
      cronExpression: task.cronExpression,
    };
    this.showTaskForm = true;
  }

  private startCreateTask(): void {
    this.editingTaskId = null;
    const defaultType = this.taskTypes[0];
    this.taskForm = {
      name: "",
      description: "",
      taskType: defaultType?.type ?? "",
      cronExpression: defaultType?.defaultCron ?? "0 * * * *",
    };
    this.showTaskForm = true;
  }

  private resetTaskForm(): void {
    this.showTaskForm = false;
    this.editingTaskId = null;
    this.taskForm = {
      name: "",
      description: "",
      taskType: "",
      cronExpression: "",
    };
  }

  private handleTaskFormSubmit(): void {
    if (this.editingTaskId) {
      this.updateTask();
    } else {
      this.createTask();
    }
  }

  private handleTaskTypeChange(e: Event): void {
    const select = e.target as HTMLSelectElement;
    const type = this.taskTypes.find((t) => t.type === select.value);
    this.taskForm = {
      ...this.taskForm,
      taskType: select.value,
      cronExpression: type?.defaultCron ?? this.taskForm.cronExpression,
    };
  }

  private formatDateTime(isoString?: string): string {
    if (!isoString) return "-";
    const date = new Date(isoString);
    return date.toLocaleString("ja-JP", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  // ===== NewsSource Methods =====

  private async loadNewsSources(): Promise<void> {
    try {
      const result = (await this.sendRequest("newsSource.list")) as {
        sources: NewsSourceDefinition[];
      };
      this.newsSources = result.sources;
    } catch (error) {
      this.showError("Failed to load news sources", error);
    }
  }

  private buildXAccountConfig(): XAccountConfig {
    return {
      handle: this.sourceForm.handle,
      maxTweets: this.sourceForm.maxTweets,
      hoursBack: this.sourceForm.hoursBack || undefined,
      includeRetweets: this.sourceForm.includeRetweets,
      includeReplies: this.sourceForm.includeReplies,
    };
  }

  private buildGitHubConfig(): GitHubChangelogConfig {
    return {
      owner: this.sourceForm.owner,
      repo: this.sourceForm.repo,
      branch: this.sourceForm.branch || undefined,
      filePath: this.sourceForm.filePath || undefined,
    };
  }

  private async createNewsSource(): Promise<void> {
    try {
      this.loading = true;
      const sourceConfig =
        this.sourceForm.sourceType === "github"
          ? this.buildGitHubConfig()
          : this.buildXAccountConfig();
      const result = (await this.sendRequest("newsSource.create", {
        name: this.sourceForm.name,
        sourceType: this.sourceForm.sourceType,
        sourceConfig,
        enabled: true,
      })) as { source: NewsSourceDefinition };
      this.newsSources = [...this.newsSources, result.source];
      this.resetSourceForm();
      this.showSuccess("ソースを作成しました");
    } catch (error) {
      this.showError("ソース作成エラー", error);
    } finally {
      this.loading = false;
    }
  }

  private async updateNewsSource(): Promise<void> {
    if (!this.editingSourceId) return;
    try {
      this.loading = true;
      const sourceConfig =
        this.sourceForm.sourceType === "github"
          ? this.buildGitHubConfig()
          : this.buildXAccountConfig();
      const result = (await this.sendRequest("newsSource.update", {
        id: this.editingSourceId,
        name: this.sourceForm.name,
        sourceConfig,
      })) as { source: NewsSourceDefinition };
      this.newsSources = this.newsSources.map((s) =>
        s.id === result.source.id ? result.source : s,
      );
      this.resetSourceForm();
      this.showSuccess("ソースを更新しました");
    } catch (error) {
      this.showError("ソース更新エラー", error);
    } finally {
      this.loading = false;
    }
  }

  private async deleteNewsSource(id: string): Promise<void> {
    if (!confirm("このソースを削除しますか？")) return;
    try {
      await this.sendRequest("newsSource.delete", { id });
      this.newsSources = this.newsSources.filter((s) => s.id !== id);
      this.showSuccess("ソースを削除しました");
    } catch (error) {
      this.showError("ソース削除エラー", error);
    }
  }

  private async toggleNewsSource(id: string, enabled: boolean): Promise<void> {
    try {
      const result = (await this.sendRequest("newsSource.toggle", {
        id,
        enabled,
      })) as { source: NewsSourceDefinition };
      this.newsSources = this.newsSources.map((s) =>
        s.id === result.source.id ? result.source : s,
      );
    } catch (error) {
      this.showError("ソース切り替えエラー", error);
    }
  }

  private async fetchNewsSourceNow(id: string): Promise<void> {
    try {
      this.fetchingSourceIds = new Set([...this.fetchingSourceIds, id]);
      await this.sendRequest("newsSource.fetchNow", { id });
      this.showSuccess("フェッチを開始しました");
    } catch (error) {
      this.fetchingSourceIds = new Set(
        [...this.fetchingSourceIds].filter((sid) => sid !== id),
      );
      this.showError("フェッチエラー", error);
    }
  }

  private startEditSource(source: NewsSourceDefinition): void {
    this.editingSourceId = source.id;
    if (source.sourceType === "github") {
      const config = source.sourceConfig as GitHubChangelogConfig;
      this.sourceForm = {
        name: source.name,
        sourceType: source.sourceType,
        handle: "",
        maxTweets: 20,
        hoursBack: 0,
        includeRetweets: false,
        includeReplies: false,
        owner: config.owner ?? "",
        repo: config.repo ?? "",
        branch: config.branch ?? "main",
        filePath: config.filePath ?? "CHANGELOG.md",
      };
    } else {
      const config = source.sourceConfig as XAccountConfig;
      this.sourceForm = {
        name: source.name,
        sourceType: source.sourceType,
        handle: config.handle ?? "",
        maxTweets: config.maxTweets ?? 20,
        hoursBack: config.hoursBack ?? 0,
        includeRetweets: config.includeRetweets ?? false,
        includeReplies: config.includeReplies ?? false,
        owner: "",
        repo: "",
        branch: "main",
        filePath: "CHANGELOG.md",
      };
    }
    this.showSourceForm = true;
  }

  private startCreateSource(): void {
    this.editingSourceId = null;
    this.sourceForm = {
      name: "",
      sourceType: "x-account",
      handle: "",
      maxTweets: 20,
      hoursBack: 0,
      includeRetweets: false,
      includeReplies: false,
      owner: "",
      repo: "",
      branch: "main",
      filePath: "CHANGELOG.md",
    };
    this.showSourceForm = true;
  }

  private resetSourceForm(): void {
    this.showSourceForm = false;
    this.editingSourceId = null;
    this.sourceForm = {
      name: "",
      sourceType: "x-account",
      handle: "",
      maxTweets: 20,
      hoursBack: 0,
      includeRetweets: false,
      includeReplies: false,
      owner: "",
      repo: "",
      branch: "main",
      filePath: "CHANGELOG.md",
    };
  }

  private handleSourceFormSubmit(): void {
    if (this.editingSourceId) {
      this.updateNewsSource();
    } else {
      this.createNewsSource();
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
      this.showSuccess("Configuration saved!");
    } catch (error) {
      this.showError("Failed to save config", error);
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
      this.showSuccess(
        `Connection successful! Response: ${result.response.slice(0, 100)}...`,
      );
    } catch (error) {
      this.showError("Connection failed", error);
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
      cron: () => this.renderCronTab(),
      sources: () => this.renderSourcesTab(),
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

  private renderCronTab() {
    return html`
      <h2 class="section-title">Scheduled Tasks</h2>

      ${this.statusMessage
        ? html`<div class="status-message ${this.statusMessage.type}">
            ${this.statusMessage.text}
          </div>`
        : ""}
      ${this.showTaskForm ? this.renderTaskForm() : ""}
      ${!this.showTaskForm
        ? html`
            <button class="btn btn-icon" @click="${this.startCreateTask}">
              <svg viewBox="0 0 24 24">${plusIcon}</svg>
              新規タスク追加
            </button>
          `
        : ""}

      <div class="task-list" style="margin-top: 24px;">
        ${this.scheduledTasks.length === 0
          ? html`
              <div class="empty-state">
                <div class="empty-state-text">
                  スケジュールされたタスクがありません
                </div>
              </div>
            `
          : this.scheduledTasks.map((task) => this.renderTaskItem(task))}
      </div>
    `;
  }

  private renderTaskItem(task: ScheduledTask) {
    const isRunning = this.runningTaskIds.has(task.id);
    const taskType = this.taskTypes.find((t) => t.type === task.taskType);

    return html`
      <div class="task-item ${task.enabled ? "" : "disabled"}">
        <div
          class="switch ${task.enabled ? "active" : ""}"
          @click="${() => this.toggleTask(task.id, !task.enabled)}"
        ></div>

        <div class="task-info">
          <div class="task-header">
            <span class="task-name">${task.name}</span>
            <span class="task-type">${taskType?.name ?? task.taskType}</span>
          </div>
          <div class="task-meta">
            <span>Cron: ${task.cronExpression}</span>
            <span>次回: ${this.formatDateTime(task.nextRunAt)}</span>
            <span>前回: ${this.formatDateTime(task.lastRunAt)}</span>
          </div>
        </div>

        <div class="task-actions">
          <button
            class="icon-btn ${isRunning ? "running" : ""}"
            title="今すぐ実行"
            ?disabled="${isRunning || !task.enabled}"
            @click="${() => this.runTaskNow(task.id)}"
          >
            <svg viewBox="0 0 24 24">${playIcon}</svg>
          </button>
          <button
            class="icon-btn"
            title="編集"
            @click="${() => this.startEditTask(task)}"
          >
            <svg viewBox="0 0 24 24">${editIcon}</svg>
          </button>
          <button
            class="icon-btn danger"
            title="削除"
            @click="${() => this.deleteTask(task.id)}"
          >
            <svg viewBox="0 0 24 24">${trashIcon}</svg>
          </button>
        </div>
      </div>
    `;
  }

  private renderTaskForm() {
    const isEditing = this.editingTaskId !== null;

    return html`
      <div class="task-form">
        <div class="task-form-title">
          ${isEditing ? "タスクを編集" : "新規タスク"}
        </div>

        <div class="task-form-row">
          <div class="form-group">
            <label>タスク名</label>
            <input
              type="text"
              .value="${this.taskForm.name}"
              @input="${(e: Event) => {
                this.taskForm = {
                  ...this.taskForm,
                  name: (e.target as HTMLInputElement).value,
                };
              }}"
              placeholder="タスク名を入力"
            />
          </div>

          <div class="form-group">
            <label>タスク種類</label>
            <select
              .value="${this.taskForm.taskType}"
              @change="${this.handleTaskTypeChange}"
              ?disabled="${isEditing}"
            >
              ${this.taskTypes.map(
                (t) =>
                  html`<option value="${t.type}">
                    ${t.name} - ${t.description}
                  </option>`,
              )}
            </select>
          </div>
        </div>

        <div class="form-group">
          <label>説明</label>
          <input
            type="text"
            .value="${this.taskForm.description}"
            @input="${(e: Event) => {
              this.taskForm = {
                ...this.taskForm,
                description: (e.target as HTMLInputElement).value,
              };
            }}"
            placeholder="タスクの説明（オプション）"
          />
        </div>

        <div class="form-group">
          <label>Cron式</label>
          <input
            type="text"
            .value="${this.taskForm.cronExpression}"
            @input="${(e: Event) => {
              this.taskForm = {
                ...this.taskForm,
                cronExpression: (e.target as HTMLInputElement).value,
              };
            }}"
            placeholder="0 6 * * *"
          />
          <div class="description">
            形式: 分 時 日 月 曜日 (例: 0 6 * * * = 毎日6:00)
          </div>
        </div>

        <div class="task-form-actions">
          <button
            class="btn"
            ?disabled="${this.loading ||
            !this.taskForm.name ||
            !this.taskForm.cronExpression}"
            @click="${this.handleTaskFormSubmit}"
          >
            ${isEditing ? "更新" : "作成"}
          </button>
          <button class="btn btn-secondary" @click="${this.resetTaskForm}">
            キャンセル
          </button>
        </div>
      </div>
    `;
  }

  private renderSourcesTab() {
    return html`
      <h2 class="section-title">News Sources</h2>

      ${this.statusMessage
        ? html`<div class="status-message ${this.statusMessage.type}">
            ${this.statusMessage.text}
          </div>`
        : ""}
      ${this.showSourceForm ? this.renderSourceForm() : ""}
      ${!this.showSourceForm
        ? html`
            <button class="btn btn-icon" @click="${this.startCreateSource}">
              <svg viewBox="0 0 24 24">${plusIcon}</svg>
              新規ソース追加
            </button>
          `
        : ""}

      <div class="task-list" style="margin-top: 24px;">
        ${this.newsSources.length === 0
          ? html`
              <div class="empty-state">
                <div class="empty-state-text">ニュースソースがありません</div>
              </div>
            `
          : this.newsSources.map((source) => this.renderSourceItem(source))}
      </div>
    `;
  }

  private renderSourceMeta(source: NewsSourceDefinition) {
    switch (source.sourceType) {
      case "x-account": {
        const config = source.sourceConfig as XAccountConfig;
        return html`<span>Handle: ${config.handle}</span>`;
      }
      case "github": {
        const config = source.sourceConfig as GitHubChangelogConfig;
        return html`<span>${config.owner}/${config.repo}</span>`;
      }
      default:
        return "";
    }
  }

  private renderSourceItem(source: NewsSourceDefinition) {
    const isFetching = this.fetchingSourceIds.has(source.id);
    const sourceTypeLabel =
      SOURCE_TYPES.find((t) => t.value === source.sourceType)?.label ??
      source.sourceType;

    return html`
      <div class="task-item ${source.enabled ? "" : "disabled"}">
        <div
          class="switch ${source.enabled ? "active" : ""}"
          @click="${() => this.toggleNewsSource(source.id, !source.enabled)}"
        ></div>

        <div class="task-info">
          <div class="task-header">
            <span class="task-name">${source.name}</span>
            <span class="task-type">${sourceTypeLabel}</span>
          </div>
          <div class="task-meta">
            ${this.renderSourceMeta(source)}
            <span>前回取得: ${this.formatDateTime(source.lastFetchedAt)}</span>
          </div>
        </div>

        <div class="task-actions">
          <button
            class="icon-btn ${isFetching ? "running" : ""}"
            title="今すぐ取得"
            ?disabled="${isFetching || !source.enabled}"
            @click="${() => this.fetchNewsSourceNow(source.id)}"
          >
            <svg viewBox="0 0 24 24">${playIcon}</svg>
          </button>
          <button
            class="icon-btn"
            title="編集"
            @click="${() => this.startEditSource(source)}"
          >
            <svg viewBox="0 0 24 24">${editIcon}</svg>
          </button>
          <button
            class="icon-btn danger"
            title="削除"
            @click="${() => this.deleteNewsSource(source.id)}"
          >
            <svg viewBox="0 0 24 24">${trashIcon}</svg>
          </button>
        </div>
      </div>
    `;
  }

  private renderSourceForm() {
    const isEditing = this.editingSourceId !== null;

    return html`
      <div class="task-form">
        <div class="task-form-title">
          ${isEditing ? "ソースを編集" : "新規ソース"}
        </div>

        <div class="task-form-row">
          <div class="form-group">
            <label>ソース名</label>
            <input
              type="text"
              .value="${this.sourceForm.name}"
              @input="${(e: Event) => {
                this.sourceForm = {
                  ...this.sourceForm,
                  name: (e.target as HTMLInputElement).value,
                };
              }}"
              placeholder="例: Anthropic公式"
            />
          </div>

          <div class="form-group">
            <label>ソースタイプ</label>
            <select
              .value="${this.sourceForm.sourceType}"
              @change="${(e: Event) => {
                this.sourceForm = {
                  ...this.sourceForm,
                  sourceType: (e.target as HTMLSelectElement)
                    .value as NewsSourceType,
                };
              }}"
              ?disabled="${isEditing}"
            >
              ${SOURCE_TYPES.map(
                (t) => html`<option value="${t.value}">${t.label}</option>`,
              )}
            </select>
          </div>
        </div>

        ${this.sourceForm.sourceType === "x-account"
          ? this.renderXAccountFields()
          : this.sourceForm.sourceType === "github"
            ? this.renderGitHubFields()
            : ""}

        <div class="task-form-actions">
          <button
            class="btn"
            ?disabled="${this.loading ||
            !this.sourceForm.name ||
            (this.sourceForm.sourceType === "x-account" &&
              !this.sourceForm.handle) ||
            (this.sourceForm.sourceType === "github" &&
              (!this.sourceForm.owner || !this.sourceForm.repo))}"
            @click="${this.handleSourceFormSubmit}"
          >
            ${isEditing ? "更新" : "作成"}
          </button>
          <button class="btn btn-secondary" @click="${this.resetSourceForm}">
            キャンセル
          </button>
        </div>
      </div>
    `;
  }

  private renderXAccountFields() {
    return html`
      <div class="form-group">
        <label>Xハンドル</label>
        <input
          type="text"
          .value="${this.sourceForm.handle}"
          @input="${(e: Event) => {
            this.sourceForm = {
              ...this.sourceForm,
              handle: (e.target as HTMLInputElement).value,
            };
          }}"
          placeholder="@AnthropicAI"
        />
        <div class="description">@を含めたハンドル名を入力</div>
      </div>

      <div class="task-form-row">
        <div class="form-group">
          <label>最大取得件数</label>
          <input
            type="number"
            .value="${String(this.sourceForm.maxTweets)}"
            @input="${(e: Event) => {
              this.sourceForm = {
                ...this.sourceForm,
                maxTweets: parseInt((e.target as HTMLInputElement).value, 10),
              };
            }}"
            min="1"
            max="100"
          />
        </div>
        <div class="form-group">
          <label>直近○時間</label>
          <input
            type="number"
            .value="${String(this.sourceForm.hoursBack)}"
            @input="${(e: Event) => {
              this.sourceForm = {
                ...this.sourceForm,
                hoursBack: parseInt((e.target as HTMLInputElement).value, 10),
              };
            }}"
            min="0"
            max="720"
          />
          <div class="description">0 = 無制限</div>
        </div>
      </div>

      <div class="list-item" style="margin-bottom: 12px;">
        <div class="list-item-info">
          <div class="list-item-title">リツイートを含む</div>
          <div class="list-item-desc">リツイートも取得対象に含める</div>
        </div>
        <div
          class="switch ${this.sourceForm.includeRetweets ? "active" : ""}"
          @click="${() => {
            this.sourceForm = {
              ...this.sourceForm,
              includeRetweets: !this.sourceForm.includeRetweets,
            };
          }}"
        ></div>
      </div>

      <div class="list-item">
        <div class="list-item-info">
          <div class="list-item-title">リプライを含む</div>
          <div class="list-item-desc">リプライも取得対象に含める</div>
        </div>
        <div
          class="switch ${this.sourceForm.includeReplies ? "active" : ""}"
          @click="${() => {
            this.sourceForm = {
              ...this.sourceForm,
              includeReplies: !this.sourceForm.includeReplies,
            };
          }}"
        ></div>
      </div>
    `;
  }

  private renderGitHubFields() {
    return html`
      <div class="task-form-row">
        <div class="form-group">
          <label>Owner</label>
          <input
            type="text"
            .value="${this.sourceForm.owner}"
            @input="${(e: Event) => {
              this.sourceForm = {
                ...this.sourceForm,
                owner: (e.target as HTMLInputElement).value,
              };
            }}"
            placeholder="例: anthropics"
          />
          <div class="description">GitHubユーザー名または組織名</div>
        </div>
        <div class="form-group">
          <label>Repository</label>
          <input
            type="text"
            .value="${this.sourceForm.repo}"
            @input="${(e: Event) => {
              this.sourceForm = {
                ...this.sourceForm,
                repo: (e.target as HTMLInputElement).value,
              };
            }}"
            placeholder="例: claude-code"
          />
        </div>
      </div>
      <div class="task-form-row">
        <div class="form-group">
          <label>Branch</label>
          <input
            type="text"
            .value="${this.sourceForm.branch}"
            @input="${(e: Event) => {
              this.sourceForm = {
                ...this.sourceForm,
                branch: (e.target as HTMLInputElement).value,
              };
            }}"
            placeholder="main"
          />
        </div>
        <div class="form-group">
          <label>File Path</label>
          <input
            type="text"
            .value="${this.sourceForm.filePath}"
            @input="${(e: Event) => {
              this.sourceForm = {
                ...this.sourceForm,
                filePath: (e.target as HTMLInputElement).value,
              };
            }}"
            placeholder="CHANGELOG.md"
          />
        </div>
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
