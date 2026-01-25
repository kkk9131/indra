import { LitElement, css, html } from "lit";
import { customElement, property } from "lit/decorators.js";

@customElement("indra-status-bar")
export class StatusBarElement extends LitElement {
  static styles = css`
    :host {
      display: flex;
      align-items: center;
      gap: 16px;
      height: 32px;
      padding: 0 16px;
      background: var(--bg-secondary, #ffffff);
      border-top: 1px solid var(--border, #e0e0e0);
      font-family: var(--font-family, "Inter", system-ui, sans-serif);
      font-size: 12px;
    }

    .status-left {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .status-dot {
      width: 8px;
      height: 8px;
      border-radius: 4px;
      background: var(--success, #2e7d32);
    }

    .status-dot.disconnected {
      background: var(--danger, #e74c3c);
    }

    .divider {
      width: 1px;
      height: 16px;
      background: var(--border, #e0e0e0);
    }

    .text-secondary {
      color: var(--text-secondary, #636e72);
    }

    .pending-status {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .pending-count {
      color: var(--primary, #2e7d32);
      font-weight: 600;
    }
  `;

  @property({ type: Boolean })
  connected = true;

  @property()
  llm = "Claude";

  @property({ type: Number })
  pendingCount = 0;

  render() {
    return html`
      <div class="status-left">
        <div class="status-dot ${this.connected ? "" : "disconnected"}"></div>
        <span class="text-secondary"
          >${this.connected ? "Connected" : "Disconnected"}</span
        >
      </div>
      <div class="divider"></div>
      <span class="text-secondary">${this.llm}</span>
      <div class="divider"></div>
      <div class="pending-status">
        <span class="text-secondary">承認待ち:</span>
        <span class="pending-count">${this.pendingCount}</span>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "indra-status-bar": StatusBarElement;
  }
}
