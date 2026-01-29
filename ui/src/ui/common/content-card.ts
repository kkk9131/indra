import { LitElement, css, html } from "lit";
import { customElement, property } from "lit/decorators.js";
import type { Content } from "../types.js";
import { STATUS_CONFIG } from "./styles.js";
import "./platform-badge.js";

@customElement("indra-content-card")
export class ContentCardElement extends LitElement {
  static styles = css`
    :host {
      display: block;
    }

    .card {
      background: white;
      border-radius: 12px;
      padding: 20px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
      transition:
        transform 0.15s ease,
        box-shadow 0.15s ease;
    }

    .card:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    }

    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 12px;
    }

    .header-left {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .account {
      font-size: 14px;
      font-weight: 500;
      color: var(--text-primary, #2d3436);
    }

    .date {
      font-size: 12px;
      color: var(--text-secondary, #636e72);
    }

    .content-text {
      font-size: 14px;
      line-height: 1.6;
      color: var(--text-primary, #2d3436);
      margin-bottom: 16px;
      white-space: pre-wrap;
      word-break: break-word;
    }

    .content-text.truncated {
      display: -webkit-box;
      -webkit-line-clamp: 3;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    .footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .status {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 500;
    }

    .status svg {
      width: 14px;
      height: 14px;
      fill: none;
      stroke: currentColor;
      stroke-width: 2;
      stroke-linecap: round;
      stroke-linejoin: round;
    }

    .actions {
      display: flex;
      gap: 8px;
    }

    .action-btn {
      padding: 8px 12px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
      border: 1px solid var(--border, #e0e0e0);
      background: white;
      color: var(--text-primary, #2d3436);
      font-family: var(--font-family, "Geist Mono", monospace);
      transition: all 0.15s ease;
    }

    .action-btn:hover {
      background: var(--bg-tertiary, #f5f5f5);
    }

    .action-btn.primary {
      background: var(--primary, #2e7d32);
      color: white;
      border-color: var(--primary, #2e7d32);
    }

    .action-btn.primary:hover {
      background: #1b5e20;
    }

    .action-btn.danger {
      color: #dc3545;
      border-color: #dc3545;
    }

    .action-btn.danger:hover {
      background: #dc3545;
      color: white;
    }

    .dropdown {
      position: relative;
      display: inline-block;
    }

    .dropdown-menu {
      display: none;
      position: absolute;
      top: 100%;
      right: 0;
      background: white;
      border: 1px solid var(--border, #e0e0e0);
      border-radius: 6px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
      z-index: 10;
      min-width: 140px;
    }

    .dropdown:hover .dropdown-menu {
      display: block;
    }

    .dropdown-item {
      display: block;
      width: 100%;
      padding: 8px 12px;
      border: none;
      background: none;
      text-align: left;
      cursor: pointer;
      font-size: 12px;
      font-family: var(--font-family, "Geist Mono", monospace);
    }

    .dropdown-item:hover {
      background: var(--bg-tertiary, #f5f5f5);
    }
  `;

  @property({ type: Object })
  content!: Content;

  @property()
  accountName = "";

  @property({ type: Boolean })
  truncated = false;

  @property({ type: Boolean })
  showActions = true;

  private formatDate(timestamp: number): string {
    return new Date(timestamp).toLocaleDateString("ja-JP", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  private emitAction(action: string): void {
    this.dispatchEvent(
      new CustomEvent("action", {
        detail: { action, content: this.content },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private renderActions() {
    if (!this.showActions) {
      return null;
    }

    const isPending = this.content.status === "pending";
    const pendingActions = html`
      <button class="action-btn" @click="${() => this.emitAction("preview")}">
        Preview
      </button>
      <button class="action-btn" @click="${() => this.emitAction("edit")}">
        Edit
      </button>
      <div class="dropdown">
        <button class="action-btn primary dropdown-trigger">Approve ▼</button>
        <div class="dropdown-menu">
          <button
            class="dropdown-item"
            @click="${() => this.emitAction("approve")}"
          >
            今すぐ投稿
          </button>
          <button
            class="dropdown-item"
            @click="${() => this.emitAction("schedule")}"
          >
            予約投稿
          </button>
        </div>
      </div>
      <button
        class="action-btn danger"
        @click="${() => this.emitAction("reject")}"
      >
        Reject
      </button>
    `;
    const viewAction = html`
      <button class="action-btn" @click="${() => this.emitAction("view")}">
        View
      </button>
    `;

    return html`
      <div class="actions">${isPending ? pendingActions : viewAction}</div>
    `;
  }

  render() {
    const statusConfig = STATUS_CONFIG[this.content.status];
    const statusStyle = `background: ${statusConfig.color}20; color: ${statusConfig.color};`;

    return html`
      <div class="card">
        <div class="header">
          <div class="header-left">
            <indra-platform-badge
              .platform="${this.content.platform}"
            ></indra-platform-badge>
            <span class="account">${this.accountName}</span>
          </div>
          <span class="date">${this.formatDate(this.content.createdAt)}</span>
        </div>

        <div class="content-text ${this.truncated ? "truncated" : ""}">
          ${this.content.text}
        </div>

        <div class="footer">
          <span class="status" style="${statusStyle}">
            <svg viewBox="0 0 24 24">${statusConfig.icon}</svg>
            ${statusConfig.label}
          </span>
          ${this.renderActions()}
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "indra-content-card": ContentCardElement;
  }
}
