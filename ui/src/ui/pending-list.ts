import { LitElement, css, html } from "lit";
import { customElement, property } from "lit/decorators.js";

export interface PendingItem {
  id: string;
  platform: "x" | "note";
  account: string;
  preview: string;
}

@customElement("indra-pending-list")
export class PendingListElement extends LitElement {
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
      justify-content: space-between;
      align-items: center;
      padding: 12px 16px;
      border-bottom: 1px solid var(--border, #e0e0e0);
    }

    .item:last-child {
      border-bottom: none;
    }

    .item-left {
      display: flex;
      align-items: center;
      gap: 12px;
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

    .item-info {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .account {
      font-size: 13px;
      font-weight: 500;
      color: var(--text-primary, #2d3436);
    }

    .preview {
      font-size: 12px;
      color: var(--text-secondary, #636e72);
    }

    .approve-btn {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 6px 12px;
      background: var(--success, #2e7d32);
      color: white;
      border: none;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
      font-family: inherit;
    }

    .approve-btn:hover {
      opacity: 0.9;
    }
  `;

  @property({ type: Array })
  items: PendingItem[] = [];

  private handleApprove(item: PendingItem) {
    this.dispatchEvent(
      new CustomEvent("approve", {
        detail: { item },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private handleViewAll() {
    this.dispatchEvent(
      new CustomEvent("navigate", {
        detail: { path: "/approval" },
        bubbles: true,
        composed: true,
      }),
    );
  }

  render() {
    return html`
      <div class="section-header">
        <span class="section-title">Pending (${this.items.length})</span>
        <a class="view-all" @click="${this.handleViewAll}">View all →</a>
      </div>
      <div class="list">
        ${this.items.map(
          (item) => html`
            <div class="item">
              <div class="item-left">
                <div class="platform">${item.platform === "x" ? "X" : "n"}</div>
                <div class="item-info">
                  <span class="account">${item.account}</span>
                  <span class="preview">${item.preview}</span>
                </div>
              </div>
              <button
                class="approve-btn"
                @click="${() => this.handleApprove(item)}"
              >
                承認 ▼
              </button>
            </div>
          `,
        )}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "indra-pending-list": PendingListElement;
  }
}
