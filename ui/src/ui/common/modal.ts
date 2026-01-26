import { LitElement, css, html } from "lit";
import { customElement, property } from "lit/decorators.js";

type ModalSize = "small" | "default" | "large";

@customElement("indra-modal")
export class ModalElement extends LitElement {
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
      max-width: 500px;
      width: 100%;
      max-height: 80vh;
      display: flex;
      flex-direction: column;
      font-family: var(--font-family, "Geist Mono", monospace);
    }

    .modal.large {
      max-width: 700px;
    }

    .modal.small {
      max-width: 360px;
    }

    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 20px 24px;
      border-bottom: 1px solid var(--border, #e0e0e0);
    }

    .title {
      font-size: 18px;
      font-weight: 600;
      color: var(--text-primary, #2d3436);
    }

    .close-btn {
      width: 32px;
      height: 32px;
      border: none;
      background: transparent;
      cursor: pointer;
      border-radius: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--text-secondary, #636e72);
      transition: background 0.15s ease;
    }

    .close-btn:hover {
      background: var(--bg-tertiary, #f5f5f5);
    }

    .close-btn svg {
      width: 18px;
      height: 18px;
      stroke: currentColor;
      stroke-width: 2;
      stroke-linecap: round;
      stroke-linejoin: round;
      fill: none;
    }

    .content {
      padding: 24px;
      overflow-y: auto;
      flex: 1;
    }

    .footer {
      display: flex;
      gap: 12px;
      justify-content: flex-end;
      padding: 16px 24px;
      border-top: 1px solid var(--border, #e0e0e0);
    }
  `;

  @property({ type: Boolean, reflect: true })
  open = false;

  @property()
  title = "";

  @property()
  size: ModalSize = "default";

  private handleOverlayClick(e: MouseEvent): void {
    if (e.target === e.currentTarget) {
      this.close();
    }
  }

  private close(): void {
    this.open = false;
    this.dispatchEvent(
      new CustomEvent("close", { bubbles: true, composed: true }),
    );
  }

  render() {
    return html`
      <div class="overlay" @click="${this.handleOverlayClick}">
        <div class="modal ${this.size}">
          <div class="header">
            <span class="title">${this.title}</span>
            <button class="close-btn" @click="${this.close}">
              <svg viewBox="0 0 24 24">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
          <div class="content">
            <slot></slot>
          </div>
          <div class="footer">
            <slot name="footer"></slot>
          </div>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "indra-modal": ModalElement;
  }
}
