import { LitElement, css, html } from "lit";
import { customElement, property, state } from "lit/decorators.js";

@customElement("indra-schedule-modal")
export class ScheduleModalElement extends LitElement {
  static styles = css`
    :host {
      display: none;
    }

    :host([open]) {
      display: block;
    }

    .overlay {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.5);
      z-index: 1000;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
    }

    .modal {
      background: white;
      border-radius: 12px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
      max-width: 360px;
      width: 100%;
      padding: 24px;
      font-family: var(--font-family, "Geist Mono", monospace);
    }

    h3 {
      margin: 0 0 20px;
      font-size: 18px;
      font-weight: 600;
      color: var(--text-primary, #2d3436);
    }

    .form-group {
      margin-bottom: 16px;
    }

    label {
      display: block;
      margin-bottom: 6px;
      font-size: 12px;
      font-weight: 500;
      color: var(--text-secondary, #636e72);
    }

    input[type="date"],
    input[type="time"] {
      width: 100%;
      padding: 10px 12px;
      border: 1px solid var(--border, #e0e0e0);
      border-radius: 8px;
      font-size: 14px;
      font-family: var(--font-family, "Geist Mono", monospace);
      box-sizing: border-box;
    }

    input[type="date"]:focus,
    input[type="time"]:focus {
      outline: none;
      border-color: var(--primary, #2e7d32);
    }

    .actions {
      display: flex;
      gap: 12px;
      justify-content: flex-end;
      margin-top: 24px;
    }

    .btn-secondary {
      padding: 10px 16px;
      border-radius: 8px;
      border: 1px solid var(--border, #e0e0e0);
      background: var(--bg-tertiary, #f5f5f5);
      cursor: pointer;
      font-family: inherit;
      font-size: 14px;
    }

    .btn-secondary:hover {
      background: var(--border, #e0e0e0);
    }

    .btn-primary {
      padding: 10px 16px;
      border-radius: 8px;
      border: none;
      background: var(--primary, #2e7d32);
      color: white;
      cursor: pointer;
      font-family: inherit;
      font-size: 14px;
    }

    .btn-primary:hover {
      background: #1b5e20;
    }
  `;

  @property({ type: Boolean, reflect: true })
  open = false;

  @state()
  private dateValue = "";

  @state()
  private timeValue = "";

  connectedCallback() {
    super.connectedCallback();
    this.setDefaultDateTime();
  }

  updated(changedProperties: Map<string, unknown>) {
    // Reset to default when modal opens
    if (changedProperties.has("open") && this.open) {
      this.setDefaultDateTime();
    }
  }

  private setDefaultDateTime() {
    // Default: 1 hour from now
    const defaultTime = new Date(Date.now() + 60 * 60 * 1000);
    this.dateValue = defaultTime.toISOString().slice(0, 10);
    this.timeValue = defaultTime.toTimeString().slice(0, 5);
  }

  private handleConfirm() {
    const scheduledAt = new Date(
      `${this.dateValue}T${this.timeValue}`,
    ).toISOString();
    this.dispatchEvent(
      new CustomEvent("schedule", {
        detail: { scheduledAt },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private handleClose() {
    this.dispatchEvent(
      new CustomEvent("close", { bubbles: true, composed: true }),
    );
  }

  private handleOverlayClick(e: MouseEvent) {
    if (e.target === e.currentTarget) {
      this.handleClose();
    }
  }

  render() {
    return html`
      <div class="overlay" @click="${this.handleOverlayClick}">
        <div class="modal" @click="${(e: Event) => e.stopPropagation()}">
          <h3>予約投稿</h3>
          <div class="form-group">
            <label>日付</label>
            <input
              type="date"
              .value="${this.dateValue}"
              @input="${(e: Event) =>
                (this.dateValue = (e.target as HTMLInputElement).value)}"
            />
          </div>
          <div class="form-group">
            <label>時刻</label>
            <input
              type="time"
              .value="${this.timeValue}"
              @input="${(e: Event) =>
                (this.timeValue = (e.target as HTMLInputElement).value)}"
            />
          </div>
          <div class="actions">
            <button class="btn-secondary" @click="${this.handleClose}">
              キャンセル
            </button>
            <button class="btn-primary" @click="${this.handleConfirm}">
              予約する
            </button>
          </div>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "indra-schedule-modal": ScheduleModalElement;
  }
}
