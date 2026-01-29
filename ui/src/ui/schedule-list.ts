import { LitElement, css, html, svg } from "lit";
import { customElement, property } from "lit/decorators.js";

// Lucide icon - Clock
const clockIcon = svg`<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>`;

export interface ScheduleItem {
  id: string;
  time: string;
  platform: "x" | "note";
  account: string;
  content: string;
}

@customElement("indra-schedule-list")
export class ScheduleListElement extends LitElement {
  static styles = css`
    :host {
      display: block;
      font-family: var(--font-family, "Inter", system-ui, sans-serif);
    }

    .section-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
    }

    .section-title {
      font-size: 16px;
      font-weight: 600;
      color: var(--text-primary, #2d3436);
    }

    .view-all {
      font-size: 13px;
      color: var(--primary, #2e7d32);
      cursor: pointer;
      text-decoration: none;
    }

    .view-all:hover {
      text-decoration: underline;
    }

    .list {
      background: var(--bg-secondary, #ffffff);
      border: 1px solid var(--border, #e0e0e0);
      border-radius: 8px;
      overflow: hidden;
    }

    .item {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 12px 16px;
      border-bottom: 1px solid var(--border, #e0e0e0);
    }

    .item:last-child {
      border-bottom: none;
    }

    .time {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 13px;
      font-weight: 600;
      color: var(--primary, #2e7d32);
    }

    .time-icon {
      width: 14px;
      height: 14px;
      display: flex;
      align-items: center;
    }

    .time-icon svg {
      width: 100%;
      height: 100%;
      fill: none;
      stroke: var(--primary, #2e7d32);
      stroke-width: 2;
      stroke-linecap: round;
      stroke-linejoin: round;
    }

    .platform {
      width: 24px;
      height: 24px;
      display: flex;
      justify-content: center;
      align-items: center;
      background: var(--bg-tertiary, #f5f5f5);
      border-radius: 4px;
      font-size: 12px;
      font-weight: 600;
      color: var(--text-primary, #2d3436);
    }

    .account {
      font-size: 13px;
      color: var(--text-secondary, #636e72);
    }

    .content {
      font-size: 13px;
      color: var(--text-primary, #2d3436);
    }
  `;

  @property({ type: Array })
  items: ScheduleItem[] = [];

  private handleViewAll() {
    this.dispatchEvent(
      new CustomEvent("navigate", {
        detail: { path: "/schedule" },
        bubbles: true,
        composed: true,
      }),
    );
  }

  render() {
    return html`
      <div class="section-header">
        <span class="section-title"
          >Today's Schedule (${this.items.length})</span
        >
        <a class="view-all" @click="${this.handleViewAll}">View all →</a>
      </div>
      <div class="list">
        ${this.items.map(
          (item) => html`
            <div class="item">
              <div class="time">
                <span class="time-icon"
                  ><svg viewBox="0 0 24 24">${clockIcon}</svg></span
                >
                <span>${item.time}</span>
              </div>
              <div class="platform">${item.platform === "x" ? "X" : "n"}</div>
              <span class="account">${item.account}</span>
              <span class="content">${item.content}</span>
            </div>
          `,
        )}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "indra-schedule-list": ScheduleListElement;
  }
}
