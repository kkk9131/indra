import { LitElement, css, html } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { PendingItem } from "./pending-list.js";
import type { ScheduleItem } from "./schedule-list.js";
import { wsClient } from "../services/ws-client.js";
import "./sidebar-nav.js";
import "./status-bar.js";
import "./home-page.js";
import "./settings-page.js";
import "./chat-ui.js";
import "./approval-page.js";
import "./contents-page.js";
import "./accounts-page.js";
import "./schedule-page.js";
import "./news-page.js";
import "./log-page.js";

@customElement("indra-app-shell")
export class AppShellElement extends LitElement {
  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      width: 100%;
      height: 100vh;
      font-family: var(
        --font-family,
        "Geist Mono",
        "Inter",
        system-ui,
        monospace
      );
    }

    .body {
      display: flex;
      flex: 1;
      overflow: hidden;
    }

    .main-content {
      flex: 1;
      padding: 24px;
      background: var(--bg-primary, #e8f5e9);
      overflow-y: auto;
    }

    .chat-fab {
      position: fixed;
      bottom: 80px;
      right: 24px;
      width: 56px;
      height: 56px;
      border-radius: 50%;
      background: var(--primary, #2e7d32);
      color: white;
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      transition:
        transform 0.2s,
        box-shadow 0.2s;
      z-index: 999;
    }

    .chat-fab:hover {
      transform: scale(1.05);
      box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2);
    }

    .chat-fab svg {
      width: 24px;
      height: 24px;
      stroke: currentColor;
      stroke-width: 2;
      stroke-linecap: round;
      stroke-linejoin: round;
      fill: none;
    }
  `;

  @property({ type: Boolean })
  connected = true;

  @property()
  llm = "Claude";

  @state()
  private currentPage = "home";

  @state()
  private chatOpen = false;

  @property({ type: Array })
  pendingItems: PendingItem[] = [
    {
      id: "1",
      platform: "x",
      account: "@tech_kazuto",
      preview: "「AIは創造性を...」",
    },
    {
      id: "2",
      platform: "x",
      account: "@tech_kazuto",
      preview: "「週末イベント...」",
    },
    {
      id: "3",
      platform: "note",
      account: "@kazuto",
      preview: "「AI時代の働き方」",
    },
  ];

  @property({ type: Array })
  scheduleItems: ScheduleItem[] = [
    {
      id: "1",
      time: "18:00",
      platform: "x",
      account: "@tech_kazuto",
      content: "「週末イベントの告知」",
    },
    {
      id: "2",
      time: "21:00",
      platform: "x",
      account: "@tech_kazuto",
      content: "「今日の振り返り」",
    },
  ];

  connectedCallback(): void {
    super.connectedCallback();
    // Initialize WebSocket connection
    wsClient.connect();
    wsClient.addEventListener("connected", () => {
      this.connected = true;
    });
    wsClient.addEventListener("disconnected", () => {
      this.connected = false;
    });
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    wsClient.disconnect();
  }

  private handleNavigate(e: CustomEvent): void {
    const { id } = e.detail;
    if (id) {
      this.currentPage = id;
    }
  }

  private renderPage(): ReturnType<typeof html> {
    switch (this.currentPage) {
      case "home":
        return html`
          <indra-home-page
            .pendingItems="${this.pendingItems}"
            .scheduleItems="${this.scheduleItems}"
          ></indra-home-page>
        `;
      case "news":
        return html`<indra-news-page></indra-news-page>`;
      case "logs":
        return html`<indra-log-page></indra-log-page>`;
      case "approval":
        return html`<indra-approval-page></indra-approval-page>`;
      case "contents":
        return html`<indra-contents-page></indra-contents-page>`;
      case "schedule":
        return html`<indra-schedule-page></indra-schedule-page>`;
      case "accounts":
        return html`<indra-accounts-page></indra-accounts-page>`;
      case "settings":
        return html`<indra-settings-page></indra-settings-page>`;
      default:
        return html`<div style="padding: 40px; font-size: 18px;">
          Coming soon...
        </div>`;
    }
  }

  private toggleChat(): void {
    this.chatOpen = !this.chatOpen;
  }

  render() {
    return html`
      <div class="body">
        <indra-sidebar-nav
          .active="${this.currentPage}"
          @navigate="${this.handleNavigate}"
        ></indra-sidebar-nav>
        <main class="main-content">${this.renderPage()}</main>
      </div>
      <indra-status-bar
        .connected="${this.connected}"
        .llm="${this.llm}"
        .pendingCount="${this.pendingItems.length}"
      ></indra-status-bar>

      <button class="chat-fab" @click="${this.toggleChat}" title="Open Chat">
        <svg viewBox="0 0 24 24">
          <path
            d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"
          />
        </svg>
      </button>

      <indra-chat-ui
        ?open="${this.chatOpen}"
        @close="${() => (this.chatOpen = false)}"
      ></indra-chat-ui>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "indra-app-shell": AppShellElement;
  }
}
