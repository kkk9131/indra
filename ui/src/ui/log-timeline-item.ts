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

  private getTitle(): string {
    if (this.log.type === "agent") {
      if (this.log.tool) {
        return `Tool: ${this.log.tool}`;
      }
      if (this.log.text) {
        return (
          this.log.text.substring(0, 50) +
          (this.log.text.length > 50 ? "..." : "")
        );
      }
      return this.log.agentAction || "Agent Action";
    }
    if (this.log.type === "prompt") {
      return (
        this.log.prompt?.substring(0, 50) +
          (this.log.prompt && this.log.prompt.length > 50 ? "..." : "") ||
        "Prompt"
      );
    }
    if (this.log.type === "system") {
      return (
        this.log.message?.substring(0, 50) +
          (this.log.message && this.log.message.length > 50 ? "..." : "") ||
        "System"
      );
    }
    return "Log Entry";
  }

  private getSummary(): string | null {
    if (this.expanded) return null;
    if (this.log.type === "agent") {
      if (this.log.toolResult) {
        return (
          this.log.toolResult.substring(0, 100) +
          (this.log.toolResult.length > 100 ? "..." : "")
        );
      }
      return null;
    }
    if (this.log.type === "prompt" && this.log.response) {
      return (
        this.log.response.substring(0, 100) +
        (this.log.response.length > 100 ? "..." : "")
      );
    }
    return null;
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
