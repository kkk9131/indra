import { LitElement, css, html } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { PendingItem } from "./pending-list.js";
import type { ScheduleItem } from "./schedule-list.js";
import "./sidebar-nav.js";
import "./status-bar.js";
import "./home-page.js";

@customElement("indra-app-shell")
export class AppShellElement extends LitElement {
  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      width: 100%;
      height: 100vh;
      font-family: var(--font-family, "Inter", system-ui, sans-serif);
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
  `;

  @property({ type: Boolean })
  connected = true;

  @property()
  llm = "Claude";

  @state()
  private currentPage = "home";

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

  private handleNavigate(e: CustomEvent) {
    const { id } = e.detail;
    if (id) {
      this.currentPage = id;
    }
  }

  private renderPage() {
    switch (this.currentPage) {
      case "home":
        return html`
          <indra-home-page
            .pendingItems="${this.pendingItems}"
            .scheduleItems="${this.scheduleItems}"
          ></indra-home-page>
        `;
      default:
        return html`<div>Coming soon...</div>`;
    }
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
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "indra-app-shell": AppShellElement;
  }
}
