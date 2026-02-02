import { LitElement, css, html, svg } from "lit";
import { customElement, property, state } from "lit/decorators.js";

import type { LogEntry } from "./types.js";
import { formatLogForExport } from "./types.js";

const chevronDownIcon = svg`<polyline points="6 9 12 15 18 9"/>`;
const chevronUpIcon = svg`<polyline points="18 15 12 9 6 15"/>`;
const copyIcon = svg`<rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>`;

@customElement("indra-log-timeline-item")
export class LogTimelineItemElement extends LitElement {
  static styles = css`
    :host {
      display: block;
      font-family: var(--font-family, "Geist Mono", monospace);
    }

    .item {
      background: white;
      border-radius: 12px;
      padding: 16px 20px;
      cursor: pointer;
      transition:
        box-shadow 0.2s,
        transform 0.2s;
    }

    .item:hover {
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    }

    .item.expanded {
      cursor: default;
    }

    .header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 12px;
    }

    .header-left {
      display: flex;
      flex-direction: column;
      gap: 8px;
      flex: 1;
      min-width: 0;
    }

    .title-row {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .badge {
      display: inline-flex;
      align-items: center;
      padding: 4px 10px;
      border-radius: 12px;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      white-space: nowrap;
    }

    .badge.agent {
      background: rgba(33, 150, 243, 0.1);
      color: #1976d2;
    }

    .badge.prompt {
      background: rgba(46, 125, 50, 0.1);
      color: #2e7d32;
    }

    .badge.system {
      background: rgba(117, 117, 117, 0.1);
      color: #616161;
    }

    .badge.execution {
      background: rgba(156, 39, 176, 0.1);
      color: #7b1fa2;
    }

    .badge.outcome {
      background: rgba(255, 152, 0, 0.1);
      color: #f57c00;
    }

    .badge.api {
      background: rgba(21, 101, 192, 0.1);
      color: #1565c0;
    }

    .badge.approval {
      background: rgba(56, 142, 60, 0.1);
      color: #388e3c;
    }

    .badge.scheduler {
      background: rgba(123, 31, 162, 0.1);
      color: #7b1fa2;
    }

    .badge.browser {
      background: rgba(0, 151, 167, 0.1);
      color: #0097a7;
    }

    .badge.auth {
      background: rgba(230, 81, 0, 0.1);
      color: #e65100;
    }

    .badge.memory {
      background: rgba(48, 63, 159, 0.1);
      color: #303f9f;
    }

    .badge.user {
      background: rgba(194, 24, 91, 0.1);
      color: #c2185b;
    }

    .action-badge {
      display: inline-flex;
      align-items: center;
      padding: 2px 8px;
      border-radius: 8px;
      font-size: 10px;
      font-weight: 500;
      background: rgba(0, 0, 0, 0.05);
      color: var(--text-secondary, #636e72);
    }

    .level-badge {
      display: inline-flex;
      align-items: center;
      padding: 2px 8px;
      border-radius: 8px;
      font-size: 10px;
      font-weight: 500;
    }

    .level-badge.info {
      background: rgba(33, 150, 243, 0.1);
      color: #1976d2;
    }

    .level-badge.warn {
      background: rgba(255, 152, 0, 0.1);
      color: #f57c00;
    }

    .level-badge.error {
      background: rgba(244, 67, 54, 0.1);
      color: #d32f2f;
    }

    .title {
      font-size: 14px;
      font-weight: 500;
      color: var(--text-primary, #2d3436);
      line-height: 1.4;
    }

    .summary {
      font-size: 13px;
      color: var(--text-secondary, #636e72);
      line-height: 1.5;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    .meta {
      font-size: 12px;
      color: var(--text-secondary, #636e72);
      margin-top: 4px;
    }

    .toggle-icon {
      width: 24px;
      height: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      color: var(--text-secondary, #636e72);
    }

    .toggle-icon svg {
      width: 18px;
      height: 18px;
      stroke: currentColor;
      stroke-width: 2;
      stroke-linecap: round;
      stroke-linejoin: round;
      fill: none;
    }

    .content {
      margin-top: 16px;
      padding-top: 16px;
      border-top: 1px solid var(--border, #e0e0e0);
    }

    .detail-row {
      margin-bottom: 12px;
    }

    .detail-label {
      font-size: 11px;
      font-weight: 600;
      color: var(--text-secondary, #636e72);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 4px;
    }

    .detail-value {
      font-size: 13px;
      color: var(--text-primary, #2d3436);
      line-height: 1.5;
      white-space: pre-wrap;
      word-break: break-word;
    }

    .detail-value.code {
      background: var(--bg-tertiary, #f5f5f5);
      padding: 8px 12px;
      border-radius: 8px;
      font-family: "Geist Mono", monospace;
      font-size: 12px;
      overflow-x: auto;
    }

    .copy-btn {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 4px 8px;
      border-radius: 6px;
      border: 1px solid var(--border, #e0e0e0);
      background: white;
      color: var(--text-secondary, #636e72);
      font-family: inherit;
      font-size: 11px;
      cursor: pointer;
      transition: all 0.2s;
    }

    .copy-btn:hover {
      background: var(--bg-tertiary, #f5f5f5);
      color: var(--text-primary, #2d3436);
    }

    .copy-btn svg {
      width: 12px;
      height: 12px;
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

    .content-footer {
      display: flex;
      justify-content: flex-end;
      margin-top: 12px;
      padding-top: 12px;
      border-top: 1px solid var(--border, #e0e0e0);
    }
  `;

  @property({ type: Object })
  log!: LogEntry;

  @property({ type: Boolean })
  expanded = false;

  @state()
  private copied = false;

  private handleClick(): void {
    this.dispatchEvent(
      new CustomEvent("toggle", {
        detail: { id: this.log.id },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private formatTimestamp(timestamp: string): string {
    const date = new Date(timestamp);
    return date.toLocaleString("ja-JP", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  }

  private truncate(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + "...";
  }

  private getTitle(): string {
    switch (this.log.type) {
      case "agent": {
        if (this.log.tool) return `Tool: ${this.log.tool}`;
        if (this.log.text) return this.truncate(this.log.text, 50);
        return this.log.agentAction ?? "Agent Action";
      }
      case "prompt":
        return this.log.prompt ? this.truncate(this.log.prompt, 50) : "Prompt";
      case "system":
        return this.log.message
          ? this.truncate(this.log.message, 50)
          : "System";
      case "execution": {
        const action = this.log.executionAction ?? "unknown";
        return `Execution: ${action}`;
      }
      case "outcome": {
        const type = this.log.outcomeType ?? "unknown";
        const stage = this.log.outcomeStage;
        return `Outcome: ${type}${stage ? ` (${stage})` : ""}`;
      }
      case "api": {
        const service = this.log.apiService ?? "unknown";
        const method = this.log.apiMethod ?? "";
        const endpoint = this.log.apiEndpoint ?? "";
        return `${method} ${service}: ${endpoint}`.trim();
      }
      case "approval": {
        const action = this.log.approvalAction ?? "unknown";
        const platform = this.log.approvalPlatform;
        return `Approval: ${action}${platform ? ` (${platform})` : ""}`;
      }
      case "scheduler": {
        const action = this.log.schedulerAction ?? "unknown";
        const taskName = this.log.schedulerTaskName;
        return `Scheduler: ${action}${taskName ? ` - ${taskName}` : ""}`;
      }
      case "browser": {
        const action = this.log.browserAction ?? "unknown";
        const url = this.log.browserUrl;
        return `Browser: ${action}${url ? ` - ${this.truncate(url, 30)}` : ""}`;
      }
      case "auth": {
        const action = this.log.authAction ?? "unknown";
        const provider = this.log.authProvider;
        return `Auth: ${action}${provider ? ` (${provider})` : ""}`;
      }
      case "memory":
        return `Memory: ${this.log.memoryAction ?? "unknown"}`;
      case "user": {
        const action = this.log.userAction ?? "unknown";
        const channel = this.log.userChannel;
        return `User: ${action}${channel ? ` (${channel})` : ""}`;
      }
      default:
        return "Log Entry";
    }
  }

  private getSummary(): string | null {
    if (this.expanded) return null;

    switch (this.log.type) {
      case "agent":
        return this.log.toolResult
          ? this.truncate(this.log.toolResult, 100)
          : null;

      case "prompt":
        return this.log.response ? this.truncate(this.log.response, 100) : null;

      case "execution": {
        if (this.log.executionAction === "start" && this.log.executionConfig) {
          return `Model: ${this.log.executionConfig.model}, Tools: ${this.log.executionConfig.tools.length}`;
        }
        if (this.log.executionAction === "end" && this.log.executionResult) {
          const duration = (this.log.executionResult.duration / 1000).toFixed(
            1,
          );
          return `Duration: ${duration}s, Turns: ${this.log.executionResult.totalTurns}, Tokens: ${this.log.executionResult.totalTokens}`;
        }
        if (this.log.executionAction === "error" && this.log.executionError) {
          return `Error: ${this.log.executionError.message}`;
        }
        return null;
      }

      case "outcome": {
        const content = this.log.outcomeContent;
        if (!content) return null;
        if (content.posts && content.posts.length > 0) {
          return this.truncate(content.posts[0].text, 100);
        }
        if (content.report) return content.report.title;
        if (content.finalResponse) {
          return this.truncate(content.finalResponse, 100);
        }
        if (content.files && content.files.length > 0) {
          return `${content.files.length} file(s): ${content.files.map((f) => f.path).join(", ")}`;
        }
        return null;
      }

      case "api": {
        if (this.log.apiError) return `Error: ${this.log.apiError.message}`;
        if (this.log.apiResponseStatus) {
          const duration = this.log.apiDuration
            ? ` (${this.log.apiDuration}ms)`
            : "";
          return `Status: ${this.log.apiResponseStatus}${duration}`;
        }
        return null;
      }

      case "approval": {
        if (this.log.approvalContent) {
          return this.truncate(this.log.approvalContent.text, 100);
        }
        return this.log.approvalReason ?? null;
      }

      case "scheduler": {
        if (this.log.schedulerError) {
          return `Error: ${this.log.schedulerError.message}`;
        }
        if (this.log.schedulerDuration) {
          return `Duration: ${this.log.schedulerDuration}ms`;
        }
        return this.log.schedulerCronExpression
          ? `Cron: ${this.log.schedulerCronExpression}`
          : null;
      }

      case "browser": {
        if (this.log.browserError) {
          return `Error: ${this.log.browserError.message}`;
        }
        return this.log.browserUrl ?? null;
      }

      case "auth": {
        if (this.log.authError) return `Error: ${this.log.authError.message}`;
        return this.log.authProvider
          ? `Provider: ${this.log.authProvider}`
          : null;
      }

      case "memory": {
        if (this.log.memoryFilePath) return this.log.memoryFilePath;
        return this.log.memoryQuery
          ? `Query: ${this.truncate(this.log.memoryQuery, 50)}`
          : null;
      }

      case "user": {
        if (this.log.userInput) return this.truncate(this.log.userInput, 100);
        return this.log.userCommand ? `Command: ${this.log.userCommand}` : null;
      }

      default:
        return null;
    }
  }

  private renderExpandedContent(): ReturnType<typeof html> {
    if (this.log.type === "agent") {
      return html`
        ${this.log.tool
          ? html`
              <div class="detail-row">
                <div class="detail-label">Tool Name</div>
                <div class="detail-value">${this.log.tool}</div>
              </div>
            `
          : null}
        ${this.log.toolInput
          ? html`
              <div class="detail-row">
                <div class="detail-label">Input</div>
                <div class="detail-value code">
                  ${JSON.stringify(this.log.toolInput, null, 2)}
                </div>
              </div>
            `
          : null}
        ${this.log.toolResult
          ? html`
              <div class="detail-row">
                <div class="detail-label">Result</div>
                <div class="detail-value code">${this.log.toolResult}</div>
              </div>
            `
          : null}
        ${this.log.text
          ? html`
              <div class="detail-row">
                <div class="detail-label">Text</div>
                <div class="detail-value">${this.log.text}</div>
              </div>
            `
          : null}
        ${this.log.turnNumber !== undefined
          ? html`
              <div class="detail-row">
                <div class="detail-label">Turn</div>
                <div class="detail-value">${this.log.turnNumber}</div>
              </div>
            `
          : null}
      `;
    }

    if (this.log.type === "prompt") {
      return html`
        ${this.log.prompt
          ? html`
              <div class="detail-row">
                <div class="detail-label">Prompt</div>
                <div class="detail-value">${this.log.prompt}</div>
              </div>
            `
          : null}
        ${this.log.response
          ? html`
              <div class="detail-row">
                <div class="detail-label">Response</div>
                <div class="detail-value">${this.log.response}</div>
              </div>
            `
          : null}
        ${this.log.model
          ? html`
              <div class="detail-row">
                <div class="detail-label">Model</div>
                <div class="detail-value">${this.log.model}</div>
              </div>
            `
          : null}
      `;
    }

    if (this.log.type === "system") {
      return html`
        ${this.log.message
          ? html`
              <div class="detail-row">
                <div class="detail-label">Message</div>
                <div class="detail-value">${this.log.message}</div>
              </div>
            `
          : null}
      `;
    }

    if (this.log.type === "execution") {
      return html`
        ${this.log.executionId
          ? html`
              <div class="detail-row">
                <div class="detail-label">Execution ID</div>
                <div class="detail-value">${this.log.executionId}</div>
              </div>
            `
          : null}
        ${this.log.executionConfig
          ? html`
              <div class="detail-row">
                <div class="detail-label">Config</div>
                <div class="detail-value code">
                  ${JSON.stringify(this.log.executionConfig, null, 2)}
                </div>
              </div>
            `
          : null}
        ${this.log.input
          ? html`
              <div class="detail-row">
                <div class="detail-label">Input</div>
                <div class="detail-value">${this.log.input}</div>
              </div>
            `
          : null}
        ${this.log.executionResult
          ? html`
              <div class="detail-row">
                <div class="detail-label">Result</div>
                <div class="detail-value code">
                  ${JSON.stringify(this.log.executionResult, null, 2)}
                </div>
              </div>
            `
          : null}
        ${this.log.executionError
          ? html`
              <div class="detail-row">
                <div class="detail-label">Error</div>
                <div class="detail-value code">
                  ${JSON.stringify(this.log.executionError, null, 2)}
                </div>
              </div>
            `
          : null}
      `;
    }

    if (this.log.type === "outcome") {
      return html`
        ${this.log.outcomeId
          ? html`
              <div class="detail-row">
                <div class="detail-label">Outcome ID</div>
                <div class="detail-value">${this.log.outcomeId}</div>
              </div>
            `
          : null}
        ${this.log.outcomeType
          ? html`
              <div class="detail-row">
                <div class="detail-label">Type</div>
                <div class="detail-value">${this.log.outcomeType}</div>
              </div>
            `
          : null}
        ${this.log.outcomeStage
          ? html`
              <div class="detail-row">
                <div class="detail-label">Stage</div>
                <div class="detail-value">${this.log.outcomeStage}</div>
              </div>
            `
          : null}
        ${this.log.outcomeContent
          ? html`
              <div class="detail-row">
                <div class="detail-label">Content</div>
                <div class="detail-value code">
                  ${JSON.stringify(this.log.outcomeContent, null, 2)}
                </div>
              </div>
            `
          : null}
        ${this.log.previousOutcomeId
          ? html`
              <div class="detail-row">
                <div class="detail-label">Previous Outcome ID</div>
                <div class="detail-value">${this.log.previousOutcomeId}</div>
              </div>
            `
          : null}
        ${this.log.metadata
          ? html`
              <div class="detail-row">
                <div class="detail-label">Metadata</div>
                <div class="detail-value code">
                  ${JSON.stringify(this.log.metadata, null, 2)}
                </div>
              </div>
            `
          : null}
      `;
    }

    if (this.log.type === "api") {
      return html`
        ${this.log.apiService
          ? html`<div class="detail-row">
              <div class="detail-label">Service</div>
              <div class="detail-value">${this.log.apiService}</div>
            </div>`
          : null}
        ${this.log.apiEndpoint
          ? html`<div class="detail-row">
              <div class="detail-label">Endpoint</div>
              <div class="detail-value">${this.log.apiEndpoint}</div>
            </div>`
          : null}
        ${this.log.apiMethod
          ? html`<div class="detail-row">
              <div class="detail-label">Method</div>
              <div class="detail-value">${this.log.apiMethod}</div>
            </div>`
          : null}
        ${this.log.apiRequestData
          ? html`<div class="detail-row">
              <div class="detail-label">Request</div>
              <div class="detail-value code">
                ${JSON.stringify(this.log.apiRequestData, null, 2)}
              </div>
            </div>`
          : null}
        ${this.log.apiResponseStatus
          ? html`<div class="detail-row">
              <div class="detail-label">Status</div>
              <div class="detail-value">${this.log.apiResponseStatus}</div>
            </div>`
          : null}
        ${this.log.apiResponseData
          ? html`<div class="detail-row">
              <div class="detail-label">Response</div>
              <div class="detail-value code">
                ${JSON.stringify(this.log.apiResponseData, null, 2)}
              </div>
            </div>`
          : null}
        ${this.log.apiDuration
          ? html`<div class="detail-row">
              <div class="detail-label">Duration</div>
              <div class="detail-value">${this.log.apiDuration}ms</div>
            </div>`
          : null}
        ${this.log.apiError
          ? html`<div class="detail-row">
              <div class="detail-label">Error</div>
              <div class="detail-value code">
                ${JSON.stringify(this.log.apiError, null, 2)}
              </div>
            </div>`
          : null}
      `;
    }

    if (this.log.type === "approval") {
      return html`
        ${this.log.approvalId
          ? html`<div class="detail-row">
              <div class="detail-label">Approval ID</div>
              <div class="detail-value">${this.log.approvalId}</div>
            </div>`
          : null}
        ${this.log.approvalAction
          ? html`<div class="detail-row">
              <div class="detail-label">Action</div>
              <div class="detail-value">${this.log.approvalAction}</div>
            </div>`
          : null}
        ${this.log.approvalPlatform
          ? html`<div class="detail-row">
              <div class="detail-label">Platform</div>
              <div class="detail-value">${this.log.approvalPlatform}</div>
            </div>`
          : null}
        ${this.log.approvalContent
          ? html`<div class="detail-row">
              <div class="detail-label">Content</div>
              <div class="detail-value code">
                ${JSON.stringify(this.log.approvalContent, null, 2)}
              </div>
            </div>`
          : null}
        ${this.log.approvalBy
          ? html`<div class="detail-row">
              <div class="detail-label">Approved By</div>
              <div class="detail-value">${this.log.approvalBy}</div>
            </div>`
          : null}
        ${this.log.approvalReason
          ? html`<div class="detail-row">
              <div class="detail-label">Reason</div>
              <div class="detail-value">${this.log.approvalReason}</div>
            </div>`
          : null}
      `;
    }

    if (this.log.type === "scheduler") {
      return html`
        ${this.log.schedulerTaskId
          ? html`<div class="detail-row">
              <div class="detail-label">Task ID</div>
              <div class="detail-value">${this.log.schedulerTaskId}</div>
            </div>`
          : null}
        ${this.log.schedulerTaskType
          ? html`<div class="detail-row">
              <div class="detail-label">Task Type</div>
              <div class="detail-value">${this.log.schedulerTaskType}</div>
            </div>`
          : null}
        ${this.log.schedulerTaskName
          ? html`<div class="detail-row">
              <div class="detail-label">Task Name</div>
              <div class="detail-value">${this.log.schedulerTaskName}</div>
            </div>`
          : null}
        ${this.log.schedulerAction
          ? html`<div class="detail-row">
              <div class="detail-label">Action</div>
              <div class="detail-value">${this.log.schedulerAction}</div>
            </div>`
          : null}
        ${this.log.schedulerCronExpression
          ? html`<div class="detail-row">
              <div class="detail-label">Cron Expression</div>
              <div class="detail-value">
                ${this.log.schedulerCronExpression}
              </div>
            </div>`
          : null}
        ${this.log.schedulerDuration
          ? html`<div class="detail-row">
              <div class="detail-label">Duration</div>
              <div class="detail-value">${this.log.schedulerDuration}ms</div>
            </div>`
          : null}
        ${this.log.schedulerNextRunAt
          ? html`<div class="detail-row">
              <div class="detail-label">Next Run At</div>
              <div class="detail-value">${this.log.schedulerNextRunAt}</div>
            </div>`
          : null}
        ${this.log.schedulerError
          ? html`<div class="detail-row">
              <div class="detail-label">Error</div>
              <div class="detail-value code">
                ${JSON.stringify(this.log.schedulerError, null, 2)}
              </div>
            </div>`
          : null}
      `;
    }

    if (this.log.type === "browser") {
      return html`
        ${this.log.browserAction
          ? html`<div class="detail-row">
              <div class="detail-label">Action</div>
              <div class="detail-value">${this.log.browserAction}</div>
            </div>`
          : null}
        ${this.log.browserSession
          ? html`<div class="detail-row">
              <div class="detail-label">Session</div>
              <div class="detail-value">${this.log.browserSession}</div>
            </div>`
          : null}
        ${this.log.browserUrl
          ? html`<div class="detail-row">
              <div class="detail-label">URL</div>
              <div class="detail-value">${this.log.browserUrl}</div>
            </div>`
          : null}
        ${this.log.browserSelector
          ? html`<div class="detail-row">
              <div class="detail-label">Selector</div>
              <div class="detail-value code">${this.log.browserSelector}</div>
            </div>`
          : null}
        ${this.log.browserInput
          ? html`<div class="detail-row">
              <div class="detail-label">Input</div>
              <div class="detail-value">${this.log.browserInput}</div>
            </div>`
          : null}
        ${this.log.browserDuration
          ? html`<div class="detail-row">
              <div class="detail-label">Duration</div>
              <div class="detail-value">${this.log.browserDuration}ms</div>
            </div>`
          : null}
        ${this.log.browserError
          ? html`<div class="detail-row">
              <div class="detail-label">Error</div>
              <div class="detail-value code">
                ${JSON.stringify(this.log.browserError, null, 2)}
              </div>
            </div>`
          : null}
      `;
    }

    if (this.log.type === "auth") {
      return html`
        ${this.log.authAction
          ? html`<div class="detail-row">
              <div class="detail-label">Action</div>
              <div class="detail-value">${this.log.authAction}</div>
            </div>`
          : null}
        ${this.log.authProvider
          ? html`<div class="detail-row">
              <div class="detail-label">Provider</div>
              <div class="detail-value">${this.log.authProvider}</div>
            </div>`
          : null}
        ${this.log.authUserId
          ? html`<div class="detail-row">
              <div class="detail-label">User ID</div>
              <div class="detail-value">${this.log.authUserId}</div>
            </div>`
          : null}
        ${this.log.authScopes
          ? html`<div class="detail-row">
              <div class="detail-label">Scopes</div>
              <div class="detail-value">${this.log.authScopes.join(", ")}</div>
            </div>`
          : null}
        ${this.log.authExpiresAt
          ? html`<div class="detail-row">
              <div class="detail-label">Expires At</div>
              <div class="detail-value">${this.log.authExpiresAt}</div>
            </div>`
          : null}
        ${this.log.authError
          ? html`<div class="detail-row">
              <div class="detail-label">Error</div>
              <div class="detail-value code">
                ${JSON.stringify(this.log.authError, null, 2)}
              </div>
            </div>`
          : null}
      `;
    }

    if (this.log.type === "memory") {
      return html`
        ${this.log.memoryAction
          ? html`<div class="detail-row">
              <div class="detail-label">Action</div>
              <div class="detail-value">${this.log.memoryAction}</div>
            </div>`
          : null}
        ${this.log.memoryFilePath
          ? html`<div class="detail-row">
              <div class="detail-label">File Path</div>
              <div class="detail-value">${this.log.memoryFilePath}</div>
            </div>`
          : null}
        ${this.log.memoryChunkCount
          ? html`<div class="detail-row">
              <div class="detail-label">Chunk Count</div>
              <div class="detail-value">${this.log.memoryChunkCount}</div>
            </div>`
          : null}
        ${this.log.memoryTokenCount
          ? html`<div class="detail-row">
              <div class="detail-label">Token Count</div>
              <div class="detail-value">${this.log.memoryTokenCount}</div>
            </div>`
          : null}
        ${this.log.memoryQuery
          ? html`<div class="detail-row">
              <div class="detail-label">Query</div>
              <div class="detail-value">${this.log.memoryQuery}</div>
            </div>`
          : null}
        ${this.log.memoryResultCount
          ? html`<div class="detail-row">
              <div class="detail-label">Result Count</div>
              <div class="detail-value">${this.log.memoryResultCount}</div>
            </div>`
          : null}
        ${this.log.memoryDuration
          ? html`<div class="detail-row">
              <div class="detail-label">Duration</div>
              <div class="detail-value">${this.log.memoryDuration}ms</div>
            </div>`
          : null}
      `;
    }

    if (this.log.type === "user") {
      return html`
        ${this.log.userAction
          ? html`<div class="detail-row">
              <div class="detail-label">Action</div>
              <div class="detail-value">${this.log.userAction}</div>
            </div>`
          : null}
        ${this.log.userChannel
          ? html`<div class="detail-row">
              <div class="detail-label">Channel</div>
              <div class="detail-value">${this.log.userChannel}</div>
            </div>`
          : null}
        ${this.log.userInput
          ? html`<div class="detail-row">
              <div class="detail-label">Input</div>
              <div class="detail-value">${this.log.userInput}</div>
            </div>`
          : null}
        ${this.log.userCommand
          ? html`<div class="detail-row">
              <div class="detail-label">Command</div>
              <div class="detail-value">${this.log.userCommand}</div>
            </div>`
          : null}
        ${this.log.userResponse
          ? html`<div class="detail-row">
              <div class="detail-label">Response</div>
              <div class="detail-value">${this.log.userResponse}</div>
            </div>`
          : null}
      `;
    }

    return html``;
  }

  private async handleCopy(e: Event): Promise<void> {
    e.stopPropagation();

    try {
      const exportData = formatLogForExport(this.log);
      await navigator.clipboard.writeText(JSON.stringify(exportData, null, 2));
      this.copied = true;
      setTimeout(() => {
        this.copied = false;
      }, 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  }

  render() {
    const summary = this.getSummary();

    return html`
      <article
        class="item ${this.expanded ? "expanded" : ""}"
        @click="${this.handleClick}"
      >
        <div class="header">
          <div class="header-left">
            <div class="title-row">
              <span class="badge ${this.log.type}">${this.log.type}</span>
              ${this.log.type === "agent" && this.log.agentAction
                ? html`<span class="action-badge"
                    >${this.log.agentAction}</span
                  >`
                : null}
              ${this.log.type === "system" && this.log.level
                ? html`<span class="level-badge ${this.log.level}"
                    >${this.log.level}</span
                  >`
                : null}
              ${this.log.type === "execution" && this.log.executionAction
                ? html`<span class="action-badge"
                    >${this.log.executionAction}</span
                  >`
                : null}
              ${this.log.type === "outcome" && this.log.outcomeStage
                ? html`<span class="action-badge"
                    >${this.log.outcomeStage}</span
                  >`
                : null}
              ${this.log.type === "api" && this.log.apiMethod
                ? html`<span class="action-badge">${this.log.apiMethod}</span>`
                : null}
              ${this.log.type === "approval" && this.log.approvalAction
                ? html`<span class="action-badge"
                    >${this.log.approvalAction}</span
                  >`
                : null}
              ${this.log.type === "scheduler" && this.log.schedulerAction
                ? html`<span class="action-badge"
                    >${this.log.schedulerAction}</span
                  >`
                : null}
              ${this.log.type === "browser" && this.log.browserAction
                ? html`<span class="action-badge"
                    >${this.log.browserAction}</span
                  >`
                : null}
              ${this.log.type === "auth" && this.log.authAction
                ? html`<span class="action-badge">${this.log.authAction}</span>`
                : null}
              ${this.log.type === "memory" && this.log.memoryAction
                ? html`<span class="action-badge"
                    >${this.log.memoryAction}</span
                  >`
                : null}
              ${this.log.type === "user" && this.log.userAction
                ? html`<span class="action-badge">${this.log.userAction}</span>`
                : null}
              <span class="title">${this.getTitle()}</span>
            </div>
            ${summary ? html`<div class="summary">${summary}</div>` : null}
            <div class="meta">${this.formatTimestamp(this.log.timestamp)}</div>
          </div>
          <div class="toggle-icon">
            <svg viewBox="0 0 24 24">
              ${this.expanded ? chevronUpIcon : chevronDownIcon}
            </svg>
          </div>
        </div>

        ${this.expanded
          ? html`
              <div class="content">
                ${this.renderExpandedContent()}
                <div class="content-footer">
                  <button
                    class="copy-btn ${this.copied ? "copied" : ""}"
                    @click="${this.handleCopy}"
                  >
                    <svg viewBox="0 0 24 24">${copyIcon}</svg>
                    ${this.copied ? "Copied!" : "Copy JSON"}
                  </button>
                </div>
              </div>
            `
          : null}
      </article>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "indra-log-timeline-item": LogTimelineItemElement;
  }
}
