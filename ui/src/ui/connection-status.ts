import { LitElement, css, html } from "lit";
import { customElement, property, state } from "lit/decorators.js";

type ConnectionState = "disconnected" | "connecting" | "connected";

@customElement("indra-connection-status")
export class ConnectionStatusElement extends LitElement {
  static styles = css`
    :host {
      display: inline-block;
      font-family: system-ui, sans-serif;
      font-size: 14px;
    }

    .status {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 4px 8px;
      border-radius: 4px;
      background: #f5f5f5;
    }

    .indicator {
      width: 10px;
      height: 10px;
      border-radius: 50%;
    }

    .indicator.disconnected {
      background: #ef4444;
    }

    .indicator.connecting {
      background: #f59e0b;
      animation: pulse 1s infinite;
    }

    .indicator.connected {
      background: #22c55e;
    }

    @keyframes pulse {
      0%,
      100% {
        opacity: 1;
      }
      50% {
        opacity: 0.5;
      }
    }

    .text {
      color: #374151;
    }
  `;

  @property()
  connectionState: ConnectionState = "disconnected";

  @state()
  sessionId?: string;

  render() {
    return html`
      <div class="status">
        <span class="indicator ${this.connectionState}"></span>
        <span class="text">${this.statusText}</span>
      </div>
    `;
  }

  private get statusText(): string {
    switch (this.connectionState) {
      case "disconnected":
        return "Disconnected";
      case "connecting":
        return "Connecting...";
      case "connected":
        return `Connected${this.sessionId ? ` (${this.sessionId.slice(0, 8)})` : ""}`;
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "indra-connection-status": ConnectionStatusElement;
  }
}
