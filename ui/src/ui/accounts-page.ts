import { LitElement, css, html, svg } from "lit";
import { customElement, state } from "lit/decorators.js";
import type { Account, Platform } from "./types.js";
import { wsClient } from "../services/ws-client.js";
import "./common/platform-badge.js";
import "./common/modal.js";
import "./x-auth-modal.js";

// X logo for the connect button
const xLogo = svg`<path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>`;

// Discord logo
const discordLogo = svg`<path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>`;

type AccountStatus = Account["status"];

const STATUS_LABELS: Record<AccountStatus, string> = {
  active: "Active",
  expired: "Expired",
  error: "Error",
};

interface XAuthStatus {
  authenticated: boolean;
  expired: boolean;
  username?: string;
  oauth2Configured: boolean;
  oauth1Configured: boolean;
}

interface DiscordStatus {
  connected: boolean;
  configured: boolean;
  botName: string | null;
}

@customElement("indra-accounts-page")
export class AccountsPageElement extends LitElement {
  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      gap: 24px;
      font-family: var(--font-family, "Geist Mono", monospace);
      color: var(--text-primary, #2d3436);
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

    .btn {
      padding: 10px 20px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      font-family: var(--font-family, "Geist Mono", monospace);
      transition: all 0.15s ease;
      display: inline-flex;
      align-items: center;
      gap: 8px;
    }

    .btn-primary {
      background: var(--primary, #2e7d32);
      color: white;
      border: none;
    }

    .btn-primary:hover {
      background: #1b5e20;
    }

    .btn-x {
      background: #000;
      color: #fff;
      border: none;
    }

    .btn-x:hover {
      background: #333;
    }

    .btn-secondary {
      background: var(--bg-tertiary, #f5f5f5);
      color: var(--text-primary, #2d3436);
      border: 1px solid var(--border, #e0e0e0);
    }

    .btn-secondary:hover {
      background: var(--border, #e0e0e0);
    }

    .btn-danger {
      background: #ffebee;
      color: #c62828;
      border: 1px solid #ffcdd2;
    }

    .btn-danger:hover {
      background: #ffcdd2;
    }

    .btn-sm {
      padding: 6px 12px;
      font-size: 12px;
    }

    .btn-icon {
      width: 16px;
      height: 16px;
    }

    .btn-icon svg {
      width: 100%;
      height: 100%;
      fill: currentColor;
    }

    .section {
      margin-bottom: 32px;
    }

    .section-title {
      font-size: 16px;
      font-weight: 600;
      color: var(--text-primary, #2d3436);
      margin-bottom: 16px;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .account-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
      gap: 16px;
    }

    .account-card {
      background: white;
      border-radius: 12px;
      padding: 20px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
      transition:
        transform 0.15s ease,
        box-shadow 0.15s ease;
    }

    .account-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    }

    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 12px;
    }

    .account-info {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .account-name {
      font-size: 16px;
      font-weight: 600;
      color: var(--text-primary, #2d3436);
    }

    .display-name {
      font-size: 12px;
      color: var(--text-secondary, #636e72);
    }

    .status-badge {
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 500;
    }

    .status-active {
      background: #e8f5e9;
      color: #2e7d32;
    }

    .status-expired {
      background: #fff3e0;
      color: #ef6c00;
    }

    .status-error {
      background: #ffebee;
      color: #c62828;
    }

    .card-stats {
      display: flex;
      gap: 16px;
      font-size: 12px;
      color: var(--text-secondary, #636e72);
      padding: 12px 0;
      border-top: 1px solid var(--bg-tertiary, #f5f5f5);
      margin-top: 12px;
    }

    .card-actions {
      display: flex;
      gap: 8px;
      justify-content: flex-end;
      margin-top: 12px;
    }

    .form-group {
      margin-bottom: 16px;
    }

    .form-group label {
      display: block;
      margin-bottom: 6px;
      font-size: 14px;
      font-weight: 500;
      color: var(--text-primary, #2d3436);
    }

    .form-group select,
    .form-group input {
      width: 100%;
      padding: 10px 12px;
      border: 1px solid var(--border, #e0e0e0);
      border-radius: 8px;
      font-size: 14px;
      font-family: inherit;
      box-sizing: border-box;
    }

    .form-group select:focus,
    .form-group input:focus {
      outline: none;
      border-color: var(--primary, #2e7d32);
    }

    .modal-actions {
      display: flex;
      gap: 12px;
      justify-content: flex-end;
    }

    .connect-card {
      color: white;
      padding: 24px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 24px;
    }

    .connect-card-x {
      background: linear-gradient(135deg, #1a1a1a 0%, #333 100%);
    }

    .connect-card-discord {
      background: linear-gradient(135deg, #5865f2 0%, #7289da 100%);
    }

    .connect-info {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .connect-title {
      font-size: 16px;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .connect-title svg {
      width: 20px;
      height: 20px;
      fill: white;
    }

    .connect-description {
      font-size: 13px;
      color: #b0b0b0;
    }

    .connect-status {
      font-size: 13px;
      color: #81c784;
    }

    .auth-method-badge {
      display: inline-block;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 10px;
      font-weight: 500;
      background: rgba(255, 255, 255, 0.1);
      color: #b0b0b0;
      margin-left: 8px;
    }
  `;

  @state()
  private accounts: Account[] = [];

  @state()
  private isModalOpen = false;

  @state()
  private isXAuthModalOpen = false;

  @state()
  private newAccountPlatform: Platform = "x";

  @state()
  private newAccountName = "";

  @state()
  private xAuthStatus: XAuthStatus | null = null;

  @state()
  private discordStatus: DiscordStatus | null = null;

  @state()
  private wsConnected = false;

  private handleConnected = () => {
    this.wsConnected = true;
    this.loadXAuthStatus();
    this.loadDiscordStatus();
  };

  private handleDisconnected = () => {
    this.wsConnected = false;
  };

  connectedCallback() {
    super.connectedCallback();

    wsClient.addEventListener("connected", this.handleConnected);
    wsClient.addEventListener("disconnected", this.handleDisconnected);

    if (!wsClient.isConnected) {
      wsClient.connect();
    } else {
      this.wsConnected = true;
      this.loadXAuthStatus();
      this.loadDiscordStatus();
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    wsClient.removeEventListener("connected", this.handleConnected);
    wsClient.removeEventListener("disconnected", this.handleDisconnected);
  }

  private async loadXAuthStatus(): Promise<void> {
    try {
      this.xAuthStatus = (await wsClient.authXStatus()) as XAuthStatus;
    } catch (err) {
      console.error("Failed to load X auth status:", err);
    }
  }

  private async loadDiscordStatus(): Promise<void> {
    try {
      this.discordStatus = await wsClient.authDiscordStatus();
    } catch (err) {
      console.error("Failed to load Discord status:", err);
    }
  }

  private formatDate(timestamp?: number): string {
    if (!timestamp) return "-";
    return new Date(timestamp).toLocaleDateString("ja-JP", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  private handleDelete(id: string): void {
    if (confirm("Delete this account?")) {
      this.accounts = this.accounts.filter((acc) => acc.id !== id);
    }
  }

  private handleReauth(id: string): void {
    this.accounts = this.accounts.map((acc) =>
      acc.id === id ? { ...acc, status: "active" as const } : acc,
    );
  }

  private handleSettings(id: string): void {
    console.log(`Settings for account: ${id}`);
  }

  private openModal(): void {
    this.isModalOpen = true;
  }

  private closeModal(): void {
    this.isModalOpen = false;
    this.newAccountName = "";
    this.newAccountPlatform = "x";
  }

  private openXAuthModal(): void {
    this.isXAuthModalOpen = true;
  }

  private closeXAuthModal(): void {
    this.isXAuthModalOpen = false;
  }

  private handleXAuthenticated(e: CustomEvent): void {
    this.closeXAuthModal();
    this.loadXAuthStatus();
    console.log("X authenticated:", e.detail);
  }

  private async handleXLogout(): Promise<void> {
    if (!confirm("Disconnect X account?")) return;

    try {
      await wsClient.authXLogout();
      this.xAuthStatus = null;
      await this.loadXAuthStatus();
    } catch (err) {
      console.error("Failed to logout:", err);
    }
  }

  private handlePlatformChange(e: Event): void {
    this.newAccountPlatform = (e.target as HTMLSelectElement).value as Platform;
  }

  private handleNameChange(e: Event): void {
    this.newAccountName = (e.target as HTMLInputElement).value;
  }

  private handleAddAccount(): void {
    if (!this.newAccountName.trim()) return;

    const newAccount: Account = {
      id: crypto.randomUUID(),
      platform: this.newAccountPlatform,
      accountName: this.newAccountName.startsWith("@")
        ? this.newAccountName
        : `@${this.newAccountName}`,
      displayName: "New account",
      status: "active",
      contentCount: 0,
    };

    this.accounts = [...this.accounts, newAccount];
    this.closeModal();
  }

  render() {
    return html`
      <div class="page-header">
        <span class="page-title">Accounts</span>
      </div>

      ${this.renderXConnectSection()} ${this.renderDiscordSection()}

      <div class="section">
        <div class="section-title">Connected Accounts</div>
        ${this.accounts.length > 0
          ? html`
              <div class="account-grid">
                ${this.accounts.map((account) =>
                  this.renderAccountCard(account),
                )}
              </div>
            `
          : html`
              <div style="color: var(--text-secondary); font-size: 14px;">
                No accounts connected yet.
              </div>
            `}
      </div>

      <indra-modal
        ?open="${this.isModalOpen}"
        title="Add Account"
        @close="${this.closeModal}"
      >
        <div class="form-group">
          <label>Platform</label>
          <select
            .value="${this.newAccountPlatform}"
            @change="${this.handlePlatformChange}"
          >
            <option value="x">X (Twitter)</option>
            <option value="note">note</option>
            <option value="youtube">YouTube</option>
            <option value="instagram">Instagram</option>
            <option value="tiktok">TikTok</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div class="form-group">
          <label>Account Name</label>
          <input
            type="text"
            placeholder="@username"
            .value="${this.newAccountName}"
            @input="${this.handleNameChange}"
          />
        </div>
        <div slot="footer" class="modal-actions">
          <button class="btn btn-secondary" @click="${this.closeModal}">
            Cancel
          </button>
          <button class="btn btn-primary" @click="${this.handleAddAccount}">
            Add
          </button>
        </div>
      </indra-modal>

      <indra-x-auth-modal
        ?open="${this.isXAuthModalOpen}"
        @close="${this.closeXAuthModal}"
        @authenticated="${this.handleXAuthenticated}"
      ></indra-x-auth-modal>
    `;
  }

  private renderXConnectSection() {
    const status = this.xAuthStatus;

    return html`
      <div class="section">
        <div class="section-title">
          <svg
            viewBox="0 0 24 24"
            style="width: 20px; height: 20px; fill: currentColor;"
          >
            ${xLogo}
          </svg>
          X (Twitter)
        </div>
        <div class="connect-card connect-card-x">
          <div class="connect-info">
            ${status?.authenticated
              ? html`
                  <div class="connect-title">
                    <svg viewBox="0 0 24 24">${xLogo}</svg>
                    @${status.username ?? "Connected"}
                    <span class="auth-method-badge">OAuth 2.0</span>
                  </div>
                  <div class="connect-status">
                    ${status.expired
                      ? "Token expired - re-authenticate"
                      : "Ready to post"}
                  </div>
                `
              : html`
                  <div class="connect-title">
                    <svg viewBox="0 0 24 24">${xLogo}</svg>
                    Connect X Account
                  </div>
                  <div class="connect-description">
                    ${status?.oauth2Configured
                      ? "Authorize indra to post on your behalf"
                      : status?.oauth1Configured
                        ? "Using OAuth 1.0a (environment variables)"
                        : "OAuth not configured. Set X_CLIENT_ID to enable."}
                  </div>
                `}
          </div>
          ${this.renderXConnectButton(status)}
        </div>
      </div>
    `;
  }

  private renderXConnectButton(status: XAuthStatus | null) {
    if (status?.authenticated && !status.expired) {
      return html`
        <button class="btn btn-secondary" @click="${this.handleXLogout}">
          Disconnect
        </button>
      `;
    }

    if (status?.oauth2Configured) {
      return html`
        <button class="btn btn-x" @click="${this.openXAuthModal}">
          <span class="btn-icon">
            <svg viewBox="0 0 24 24">${xLogo}</svg>
          </span>
          ${status.authenticated && status.expired
            ? "Re-authenticate"
            : "Connect"}
        </button>
      `;
    }

    if (status?.oauth1Configured) {
      return html`
        <span
          class="auth-method-badge"
          style="background: #2e7d32; color: white;"
        >
          OAuth 1.0a Active
        </span>
      `;
    }

    return html`
      <button class="btn btn-secondary" disabled>Not Configured</button>
    `;
  }

  private renderDiscordSection() {
    const status = this.discordStatus;

    return html`
      <div class="section">
        <div class="section-title">
          <svg
            viewBox="0 0 24 24"
            style="width: 20px; height: 20px; fill: currentColor;"
          >
            ${discordLogo}
          </svg>
          Discord Bot
        </div>
        <div class="connect-card connect-card-discord">
          <div class="connect-info">
            ${status?.configured
              ? html`
                  <div class="connect-title">
                    <svg viewBox="0 0 24 24">${discordLogo}</svg>
                    ${status.botName ?? "Discord Bot"}
                  </div>
                  <div class="connect-status">
                    ${status.connected ? "Connected" : "Offline"}
                  </div>
                `
              : html`
                  <div class="connect-title">
                    <svg viewBox="0 0 24 24">${discordLogo}</svg>
                    Discord Bot
                  </div>
                  <div class="connect-description">
                    Not configured. Set DISCORD_BOT_TOKEN and DISCORD_CLIENT_ID
                    to enable.
                  </div>
                `}
          </div>
          ${this.renderDiscordStatusBadge(status)}
        </div>
      </div>
    `;
  }

  private renderDiscordStatusBadge(status: DiscordStatus | null) {
    if (!status?.configured) {
      return html`
        <button class="btn btn-secondary" disabled>Not Configured</button>
      `;
    }

    if (status.connected) {
      return html`
        <button
          class="btn btn-secondary"
          disabled
          style="background: #4A50C7; color: white; border-color: #4A50C7;"
        >
          Connected
        </button>
      `;
    }

    return html` <button class="btn btn-secondary" disabled>Offline</button> `;
  }

  private renderAccountCard(account: Account) {
    return html`
      <div class="account-card">
        <div class="card-header">
          <div class="account-info">
            <indra-platform-badge
              .platform="${account.platform}"
            ></indra-platform-badge>
            <div class="account-name">${account.accountName}</div>
            <div class="display-name">${account.displayName ?? ""}</div>
          </div>
          <span class="status-badge status-${account.status}">
            ${STATUS_LABELS[account.status]}
          </span>
        </div>

        <div class="card-stats">
          <span>Posts: ${account.contentCount}</span>
          <span>Last post: ${this.formatDate(account.lastPostedAt)}</span>
        </div>

        <div class="card-actions">
          ${account.status !== "active"
            ? html`
                <button
                  class="btn btn-secondary btn-sm"
                  @click="${() => this.handleReauth(account.id)}"
                >
                  Re-auth
                </button>
              `
            : null}
          <button
            class="btn btn-secondary btn-sm"
            @click="${() => this.handleSettings(account.id)}"
          >
            Settings
          </button>
          <button
            class="btn btn-danger btn-sm"
            @click="${() => this.handleDelete(account.id)}"
          >
            Delete
          </button>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "indra-accounts-page": AccountsPageElement;
  }
}
