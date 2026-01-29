import { LitElement, css, html, svg } from "lit";
import { customElement, state } from "lit/decorators.js";

import type {
  EvalTask,
  EvalTrial,
  EvalMetrics,
} from "../services/ws-client.js";
import { wsClient } from "../services/ws-client.js";

const refreshIcon = svg`<path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 16h5v5"/>`;
const plusIcon = svg`<path d="M12 5v14M5 12h14"/>`;
const trashIcon = svg`<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>`;
const playIcon = svg`<polygon points="5 3 19 12 5 21 5 3"/>`;

type TaskType = "xpost" | "report" | "chat" | "browser" | "other";

const TASK_TYPE_LABELS: Record<TaskType, string> = {
  xpost: "X Post",
  report: "Report",
  chat: "Chat",
  browser: "Browser",
  other: "Other",
};

@customElement("indra-evaluation-page")
export class EvaluationPageElement extends LitElement {
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

    .header-actions {
      display: flex;
      gap: 8px;
    }

    .btn {
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

    .btn:hover:not(:disabled) {
      background: var(--bg-tertiary, #f5f5f5);
    }

    .btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .btn svg {
      width: 16px;
      height: 16px;
      stroke: currentColor;
      stroke-width: 2;
      stroke-linecap: round;
      stroke-linejoin: round;
      fill: none;
    }

    .btn-primary {
      background: var(--primary, #2e7d32);
      color: white;
      border-color: var(--primary, #2e7d32);
    }

    .btn-primary:hover:not(:disabled) {
      background: var(--primary-dark, #1b5e20);
    }

    .btn-danger {
      color: #c62828;
      border-color: #c62828;
    }

    .btn-danger:hover:not(:disabled) {
      background: #ffebee;
    }

    .btn.loading svg {
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

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 16px;
    }

    .stat-card {
      background: white;
      border-radius: 12px;
      padding: 20px;
      border: 1px solid var(--border, #e0e0e0);
    }

    .stat-label {
      font-size: 12px;
      color: var(--text-secondary, #636e72);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 8px;
    }

    .stat-value {
      font-size: 28px;
      font-weight: 600;
      color: var(--text-primary, #2d3436);
    }

    .stat-value.success {
      color: #2e7d32;
    }
    .stat-value.warning {
      color: #f57c00;
    }
    .stat-value.error {
      color: #c62828;
    }

    .task-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .task-card {
      background: white;
      border-radius: 12px;
      padding: 16px 20px;
      border: 1px solid var(--border, #e0e0e0);
      cursor: pointer;
      transition:
        box-shadow 0.2s,
        border-color 0.2s;
    }

    .task-card:hover {
      border-color: var(--primary, #2e7d32);
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
    }

    .task-card.selected {
      border-color: var(--primary, #2e7d32);
      background: #f1f8e9;
    }

    .task-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 12px;
    }

    .task-name {
      font-size: 16px;
      font-weight: 600;
      color: var(--text-primary, #2d3436);
    }

    .task-type-badge {
      display: inline-flex;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 500;
      text-transform: uppercase;
      background: var(--bg-tertiary, #f5f5f5);
      color: var(--text-secondary, #636e72);
    }

    .task-type-badge.xpost {
      background: #e3f2fd;
      color: #1976d2;
    }
    .task-type-badge.report {
      background: #f3e5f5;
      color: #7b1fa2;
    }
    .task-type-badge.chat {
      background: #e8f5e9;
      color: #388e3c;
    }
    .task-type-badge.browser {
      background: #fff3e0;
      color: #f57c00;
    }

    .task-metrics {
      display: flex;
      gap: 24px;
      flex-wrap: wrap;
    }

    .metric-item {
      display: flex;
      flex-direction: column;
    }

    .metric-label {
      font-size: 11px;
      color: var(--text-secondary, #636e72);
      margin-bottom: 2px;
    }

    .metric-value {
      font-size: 14px;
      font-weight: 600;
    }

    .metric-value.pass {
      color: #2e7d32;
    }
    .metric-value.fail {
      color: #c62828;
    }

    .safety-badge {
      display: inline-flex;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 10px;
      font-weight: 500;
      background: #fff3e0;
      color: #e65100;
      margin-left: 8px;
    }

    .detail-panel {
      background: white;
      border-radius: 12px;
      padding: 24px;
      border: 1px solid var(--border, #e0e0e0);
    }

    .detail-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 20px;
      padding-bottom: 16px;
      border-bottom: 1px solid var(--border, #e0e0e0);
    }

    .detail-title {
      font-size: 20px;
      font-weight: 600;
    }

    .detail-actions {
      display: flex;
      gap: 8px;
    }

    .detail-section {
      margin-bottom: 24px;
    }

    .detail-section:last-child {
      margin-bottom: 0;
    }

    .section-title {
      font-size: 14px;
      font-weight: 600;
      color: var(--text-secondary, #636e72);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 12px;
    }

    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
      gap: 16px;
    }

    .metric-box {
      text-align: center;
      padding: 16px;
      background: var(--bg-tertiary, #f5f5f5);
      border-radius: 8px;
    }

    .metric-box-value {
      font-size: 24px;
      font-weight: 600;
      margin-bottom: 4px;
    }

    .metric-box-label {
      font-size: 12px;
      color: var(--text-secondary, #636e72);
    }

    .trial-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
      max-height: 300px;
      overflow-y: auto;
    }

    .trial-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px;
      background: var(--bg-tertiary, #f5f5f5);
      border-radius: 8px;
    }

    .trial-info {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .trial-status {
      width: 8px;
      height: 8px;
      border-radius: 50%;
    }

    .trial-status.pass {
      background: #2e7d32;
    }
    .trial-status.fail {
      background: #c62828;
    }

    .trial-number {
      font-weight: 500;
    }

    .trial-score {
      font-size: 12px;
      color: var(--text-secondary, #636e72);
    }

    .trial-duration {
      font-size: 12px;
      color: var(--text-secondary, #636e72);
    }

    .empty-state {
      text-align: center;
      padding: 60px 24px;
      background: white;
      border-radius: 12px;
      color: var(--text-secondary, #636e72);
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
    }

    .grader-status {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
    }

    .grader-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
    }

    .grader-dot.available {
      background: #2e7d32;
    }
    .grader-dot.unavailable {
      background: #c62828;
    }

    .interpretation {
      padding: 12px 16px;
      background: var(--bg-tertiary, #f5f5f5);
      border-radius: 8px;
      font-size: 14px;
      color: var(--text-secondary, #636e72);
    }
  `;

  @state()
  private tasks: EvalTask[] = [];

  @state()
  private selectedTaskId: string | null = null;

  @state()
  private selectedTask: EvalTask | null = null;

  @state()
  private selectedMetrics: EvalMetrics | null = null;

  @state()
  private selectedTrials: EvalTrial[] = [];

  @state()
  private loading = false;

  @state()
  private refreshing = false;

  @state()
  private error: string | null = null;

  @state()
  private graderAvailable = false;

  connectedCallback(): void {
    super.connectedCallback();
    this.loadTasks();
    this.checkGraderStatus();
  }

  private async loadTasks(): Promise<void> {
    if (!wsClient.isConnected) {
      wsClient.addEventListener("connected", () => this.loadTasks(), {
        once: true,
      });
      return;
    }

    this.loading = true;
    this.error = null;

    try {
      this.tasks = await wsClient.evalTaskList({ withMetrics: true });
    } catch (err) {
      this.error = err instanceof Error ? err.message : "Failed to load tasks";
    } finally {
      this.loading = false;
    }
  }

  private async checkGraderStatus(): Promise<void> {
    if (!wsClient.isConnected) {
      wsClient.addEventListener("connected", () => this.checkGraderStatus(), {
        once: true,
      });
      return;
    }

    try {
      const status = await wsClient.evalGraderStatus();
      this.graderAvailable = status.available;
    } catch {
      this.graderAvailable = false;
    }
  }

  private async handleRefresh(): Promise<void> {
    if (this.refreshing) return;

    this.refreshing = true;
    this.error = null;

    try {
      this.tasks = await wsClient.evalTaskList({ withMetrics: true });
      if (this.selectedTaskId) {
        await this.loadTaskDetail(this.selectedTaskId);
      }
    } catch (err) {
      this.error = err instanceof Error ? err.message : "Failed to refresh";
    } finally {
      this.refreshing = false;
    }
  }

  private async handleTaskSelect(taskId: string): Promise<void> {
    if (this.selectedTaskId === taskId) {
      this.selectedTaskId = null;
      this.selectedTask = null;
      this.selectedMetrics = null;
      this.selectedTrials = [];
      return;
    }

    await this.loadTaskDetail(taskId);
  }

  private async loadTaskDetail(taskId: string): Promise<void> {
    try {
      const detail = await wsClient.evalTaskGet(taskId);
      this.selectedTaskId = taskId;
      this.selectedTask = detail.task;
      this.selectedMetrics = detail.metrics;
      this.selectedTrials = detail.trials;
    } catch (err) {
      this.error =
        err instanceof Error ? err.message : "Failed to load task detail";
    }
  }

  private async handleDeleteTask(taskId: string): Promise<void> {
    if (!confirm("このタスクと全てのトライアルを削除しますか？")) {
      return;
    }

    try {
      await wsClient.evalTaskDelete(taskId);
      this.tasks = this.tasks.filter((t) => t.id !== taskId);
      if (this.selectedTaskId === taskId) {
        this.selectedTaskId = null;
        this.selectedTask = null;
        this.selectedMetrics = null;
        this.selectedTrials = [];
      }
    } catch (err) {
      this.error = err instanceof Error ? err.message : "Failed to delete task";
    }
  }

  private getPassRateClass(rate: number): string {
    if (rate >= 0.8) return "success";
    if (rate >= 0.5) return "warning";
    return "error";
  }

  private interpretMetrics(passAtK: number, passK: number): string {
    if (passAtK >= 0.8 && passK < 0.6) {
      return "High potential but unstable - succeeds sometimes but not reliably";
    }
    if (passAtK >= 0.8 && passK >= 0.6) {
      return "Excellent - reliable and consistent performance";
    }
    if (passAtK < 0.5) {
      return "Needs improvement - fundamental capability issues";
    }
    if (passAtK >= 0.5 && passAtK < 0.8) {
      return "Moderate - has potential but needs tuning";
    }
    return "Results require further analysis";
  }

  private renderStats(): ReturnType<typeof html> {
    const totalTasks = this.tasks.length;
    const totalTrials = this.tasks.reduce(
      (sum, t) => sum + (t.metrics?.totalTrials ?? 0),
      0,
    );
    const avgPassAtK =
      this.tasks.length > 0
        ? this.tasks.reduce((sum, t) => sum + (t.metrics?.passAtK ?? 0), 0) /
          this.tasks.length
        : 0;
    const avgPassK =
      this.tasks.length > 0
        ? this.tasks.reduce((sum, t) => sum + (t.metrics?.passK ?? 0), 0) /
          this.tasks.length
        : 0;

    return html`
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-label">Total Tasks</div>
          <div class="stat-value">${totalTasks}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Total Trials</div>
          <div class="stat-value">${totalTrials}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Avg Pass@5</div>
          <div class="stat-value ${this.getPassRateClass(avgPassAtK)}">
            ${(avgPassAtK * 100).toFixed(1)}%
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Avg Pass 5</div>
          <div class="stat-value ${this.getPassRateClass(avgPassK)}">
            ${(avgPassK * 100).toFixed(1)}%
          </div>
        </div>
      </div>
    `;
  }

  private renderTaskCard(task: EvalTask): ReturnType<typeof html> {
    const metrics = task.metrics;
    const passRate =
      metrics && metrics.totalTrials > 0
        ? metrics.passedTrials / metrics.totalTrials
        : 0;

    return html`
      <div
        class="task-card ${this.selectedTaskId === task.id ? "selected" : ""}"
        @click="${() => this.handleTaskSelect(task.id)}"
      >
        <div class="task-header">
          <div>
            <span class="task-name">${task.name}</span>
            ${task.shouldFail
              ? html`<span class="safety-badge">Safety Test</span>`
              : ""}
          </div>
          <span class="task-type-badge ${task.taskType}">
            ${TASK_TYPE_LABELS[task.taskType as TaskType] ?? task.taskType}
          </span>
        </div>
        <div class="task-metrics">
          <div class="metric-item">
            <span class="metric-label">Trials</span>
            <span class="metric-value">
              ${metrics?.passedTrials ?? 0}/${metrics?.totalTrials ?? 0}
            </span>
          </div>
          <div class="metric-item">
            <span class="metric-label">Pass@5</span>
            <span
              class="metric-value ${metrics?.passAtK && metrics.passAtK >= 0.8
                ? "pass"
                : metrics?.passAtK && metrics.passAtK < 0.5
                  ? "fail"
                  : ""}"
            >
              ${metrics ? (metrics.passAtK * 100).toFixed(1) + "%" : "N/A"}
            </span>
          </div>
          <div class="metric-item">
            <span class="metric-label">Pass 5</span>
            <span
              class="metric-value ${metrics?.passK && metrics.passK >= 0.6
                ? "pass"
                : ""}"
            >
              ${metrics ? (metrics.passK * 100).toFixed(1) + "%" : "N/A"}
            </span>
          </div>
          <div class="metric-item">
            <span class="metric-label">Avg Score</span>
            <span class="metric-value">
              ${metrics ? metrics.averageScore.toFixed(1) : "N/A"}
            </span>
          </div>
        </div>
      </div>
    `;
  }

  private renderDetailPanel(): ReturnType<typeof html> {
    if (!this.selectedTask) return html``;

    const task = this.selectedTask;
    const metrics = this.selectedMetrics;
    const trials = this.selectedTrials;

    return html`
      <div class="detail-panel">
        <div class="detail-header">
          <div>
            <div class="detail-title">${task.name}</div>
            <span class="task-type-badge ${task.taskType}">
              ${TASK_TYPE_LABELS[task.taskType as TaskType] ?? task.taskType}
            </span>
            ${task.shouldFail
              ? html`<span class="safety-badge">Safety Test</span>`
              : ""}
          </div>
          <div class="detail-actions">
            <button
              class="btn btn-danger"
              @click="${(e: Event) => {
                e.stopPropagation();
                this.handleDeleteTask(task.id);
              }}"
            >
              <svg viewBox="0 0 24 24">${trashIcon}</svg>
              Delete
            </button>
          </div>
        </div>

        <div class="detail-section">
          <div class="section-title">Task Details</div>
          <p><strong>Input:</strong> ${task.input}</p>
          <p><strong>Success Criteria:</strong> ${task.successCriteria}</p>
        </div>

        ${metrics
          ? html`
              <div class="detail-section">
                <div class="section-title">Metrics (K=${metrics.k})</div>
                <div class="metrics-grid">
                  <div class="metric-box">
                    <div
                      class="metric-box-value ${this.getPassRateClass(
                        metrics.passAtK,
                      )}"
                    >
                      ${(metrics.passAtK * 100).toFixed(1)}%
                    </div>
                    <div class="metric-box-label">Pass@${metrics.k}</div>
                  </div>
                  <div class="metric-box">
                    <div
                      class="metric-box-value ${this.getPassRateClass(
                        metrics.passK,
                      )}"
                    >
                      ${(metrics.passK * 100).toFixed(1)}%
                    </div>
                    <div class="metric-box-label">Pass ${metrics.k}</div>
                  </div>
                  <div class="metric-box">
                    <div class="metric-box-value">
                      ${metrics.passedTrials}/${metrics.totalTrials}
                    </div>
                    <div class="metric-box-label">Passed/Total</div>
                  </div>
                  <div class="metric-box">
                    <div class="metric-box-value">
                      ${metrics.averageScore.toFixed(1)}
                    </div>
                    <div class="metric-box-label">Avg Score</div>
                  </div>
                  ${metrics.averageDuration
                    ? html`
                        <div class="metric-box">
                          <div class="metric-box-value">
                            ${metrics.averageDuration.toFixed(0)}ms
                          </div>
                          <div class="metric-box-label">Avg Duration</div>
                        </div>
                      `
                    : ""}
                </div>
                <div class="interpretation" style="margin-top: 16px;">
                  ${this.interpretMetrics(metrics.passAtK, metrics.passK)}
                </div>
              </div>
            `
          : ""}

        <div class="detail-section">
          <div class="section-title">Trials (${trials.length})</div>
          ${trials.length > 0
            ? html`
                <div class="trial-list">
                  ${trials.map(
                    (trial) => html`
                      <div class="trial-item">
                        <div class="trial-info">
                          <div
                            class="trial-status ${trial.passed
                              ? "pass"
                              : "fail"}"
                          ></div>
                          <span class="trial-number"
                            >Trial #${trial.trialNumber}</span
                          >
                          ${trial.graderResults?.[0]
                            ? html`<span class="trial-score"
                                >Score: ${trial.graderResults[0].score}</span
                              >`
                            : ""}
                        </div>
                        <span class="trial-duration">
                          ${trial.duration ? `${trial.duration}ms` : "N/A"}
                        </span>
                      </div>
                    `,
                  )}
                </div>
              `
            : html`<div class="empty-state">No trials yet</div>`}
        </div>
      </div>
    `;
  }

  private renderContent(): ReturnType<typeof html> {
    if (this.error) {
      return html`<div class="error-state">${this.error}</div>`;
    }

    if (this.loading) {
      return html`<div class="loading-state">Loading evaluation tasks...</div>`;
    }

    if (this.tasks.length === 0) {
      return html`
        <div class="empty-state">
          <p>No evaluation tasks found.</p>
          <p>Create tasks using the CLI: <code>indra eval create</code></p>
        </div>
      `;
    }

    return html`
      ${this.renderStats()}

      <div class="task-list">
        ${this.tasks.map((task) => this.renderTaskCard(task))}
      </div>

      ${this.selectedTask ? this.renderDetailPanel() : ""}
    `;
  }

  render() {
    return html`
      <div class="page-header">
        <span class="page-title">Evaluation</span>
        <div class="header-actions">
          <div class="grader-status">
            <div
              class="grader-dot ${this.graderAvailable
                ? "available"
                : "unavailable"}"
            ></div>
            GLM Grader ${this.graderAvailable ? "Available" : "Unavailable"}
          </div>
          <button
            class="btn ${this.refreshing ? "loading" : ""}"
            @click="${this.handleRefresh}"
            ?disabled="${this.refreshing}"
          >
            <svg viewBox="0 0 24 24">${refreshIcon}</svg>
            ${this.refreshing ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </div>

      ${this.renderContent()}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "indra-evaluation-page": EvaluationPageElement;
  }
}
