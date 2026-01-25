import { LitElement, css, html } from "lit";
import { customElement, property } from "lit/decorators.js";
import type { PendingItem } from "./pending-list.js";
import type { ScheduleItem } from "./schedule-list.js";
import "./pending-list.js";
import "./schedule-list.js";

@customElement("indra-home-page")
export class HomePageElement extends LitElement {
  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      gap: 24px;
      font-family: var(--font-family, "Inter", system-ui, sans-serif);
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

    .page-date {
      font-size: 14px;
      color: var(--text-secondary, #636e72);
    }
  `;

  @property({ type: Array })
  pendingItems: PendingItem[] = [];

  @property({ type: Array })
  scheduleItems: ScheduleItem[] = [];

  private getFormattedDate(): string {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    const weekdays = ["日", "月", "火", "水", "木", "金", "土"];
    const weekday = weekdays[now.getDay()];
    return `${month}/${day} (${weekday})`;
  }

  render() {
    return html`
      <div class="page-header">
        <span class="page-title">Home</span>
        <span class="page-date">${this.getFormattedDate()}</span>
      </div>
      <indra-pending-list .items="${this.pendingItems}"></indra-pending-list>
      <indra-schedule-list .items="${this.scheduleItems}"></indra-schedule-list>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "indra-home-page": HomePageElement;
  }
}
