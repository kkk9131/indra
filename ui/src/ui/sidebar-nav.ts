import { LitElement, css, html } from "lit";
import { customElement, property } from "lit/decorators.js";

interface NavItem {
  id: string;
  icon: string;
  label: string;
  path: string;
}

const NAV_ITEMS: NavItem[] = [
  { id: "home", icon: "🏠", label: "Home", path: "/" },
  { id: "approval", icon: "✅", label: "承認", path: "/approval" },
  { id: "schedule", icon: "📅", label: "予約", path: "/schedule" },
  { id: "history", icon: "📊", label: "履歴", path: "/history" },
  { id: "account", icon: "👤", label: "Account", path: "/accounts" },
  { id: "settings", icon: "⚙️", label: "設定", path: "/settings" },
];

@customElement("indra-sidebar-nav")
export class SidebarNavElement extends LitElement {
  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      width: 200px;
      height: 100%;
      background: var(--bg-secondary, #ffffff);
      border-right: 1px solid var(--border, #e0e0e0);
      padding: 24px 16px;
      gap: 24px;
      box-sizing: border-box;
      font-family: var(--font-family, "Inter", system-ui, sans-serif);
    }

    .logo {
      font-size: 24px;
      font-weight: 700;
      color: var(--primary, #2e7d32);
    }

    .nav-group {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .nav-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 0 12px;
      height: 40px;
      border-radius: 8px;
      cursor: pointer;
      text-decoration: none;
      color: var(--text-secondary, #636e72);
      font-size: 14px;
      transition: background-color 0.15s ease;
    }

    .nav-item:hover {
      background: var(--bg-tertiary, #f5f5f5);
    }

    .nav-item.active {
      background: var(--bg-tertiary, #f5f5f5);
      color: var(--text-primary, #2d3436);
      font-weight: 500;
    }

    .nav-icon {
      font-size: 18px;
      width: 24px;
      text-align: center;
    }
  `;

  @property()
  active = "home";

  private handleNavClick(item: NavItem) {
    this.active = item.id;
    this.dispatchEvent(
      new CustomEvent("navigate", {
        detail: { path: item.path, id: item.id },
        bubbles: true,
        composed: true,
      }),
    );
  }

  render() {
    return html`
      <div class="logo">indra</div>
      <nav class="nav-group">
        ${NAV_ITEMS.map(
          (item) => html`
            <a
              class="nav-item ${this.active === item.id ? "active" : ""}"
              @click="${() => this.handleNavClick(item)}"
            >
              <span class="nav-icon">${item.icon}</span>
              <span>${item.label}</span>
            </a>
          `,
        )}
      </nav>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "indra-sidebar-nav": SidebarNavElement;
  }
}
