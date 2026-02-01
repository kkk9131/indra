import { LitElement, css, html, svg } from "lit";
import { customElement, property } from "lit/decorators.js";

interface NavItem {
  id: string;
  icon: string;
  label: string;
  path: string;
}

const NAV_ITEMS: NavItem[] = [
  { id: "home", icon: "home", label: "Home", path: "/" },
  { id: "news", icon: "newspaper", label: "News", path: "/news" },
  { id: "reports", icon: "book-open", label: "Reports", path: "/reports" },
  { id: "logs", icon: "scroll-text", label: "Logs", path: "/logs" },
  {
    id: "evaluation",
    icon: "chart",
    label: "Evaluation",
    path: "/evaluation",
  },
  {
    id: "approval",
    icon: "check-circle",
    label: "Approval",
    path: "/approval",
  },
  { id: "contents", icon: "file-text", label: "Contents", path: "/contents" },
  { id: "schedule", icon: "calendar", label: "Schedule", path: "/schedule" },
  { id: "accounts", icon: "user", label: "Accounts", path: "/accounts" },
  { id: "settings", icon: "settings", label: "Settings", path: "/settings" },
];

// Lucide icon SVG paths
const ICONS: Record<string, ReturnType<typeof svg>> = {
  home: svg`<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>`,
  newspaper: svg`<path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2"/><path d="M18 14h-8"/><path d="M15 18h-5"/><path d="M10 6h8v4h-8V6Z"/>`,
  "book-open": svg`<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>`,
  "scroll-text": svg`<path d="M8 21h12a2 2 0 0 0 2-2v-2H10v2a2 2 0 1 1-4 0V5a2 2 0 1 0-4 0v3h4"/><path d="M19 17V5a2 2 0 0 0-2-2H4"/><path d="M15 8h-5"/><path d="M15 12h-5"/>`,
  "check-circle": svg`<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>`,
  "file-text": svg`<path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/>`,
  calendar: svg`<rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/>`,
  user: svg`<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>`,
  settings: svg`<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>`,
  chart: svg`<line x1="18" x2="18" y1="20" y2="10"/><line x1="12" x2="12" y1="20" y2="4"/><line x1="6" x2="6" y1="20" y2="14"/>`,
};

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
      font-family: var(--font-family, "Geist Mono", monospace);
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
      width: 18px;
      height: 18px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .nav-icon svg {
      width: 18px;
      height: 18px;
      stroke: currentColor;
      stroke-width: 2;
      stroke-linecap: round;
      stroke-linejoin: round;
      fill: none;
    }
  `;

  @property()
  active = "home";

  private handleNavClick(item: NavItem): void {
    this.active = item.id;
    this.dispatchEvent(
      new CustomEvent("navigate", {
        detail: { path: item.path, id: item.id },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private renderIcon(iconName: string): ReturnType<typeof html> {
    return html`
      <svg viewBox="0 0 24 24">${ICONS[iconName] || ICONS.home}</svg>
    `;
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
              <span class="nav-icon">${this.renderIcon(item.icon)}</span>
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
