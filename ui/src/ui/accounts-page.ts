import { LitElement, css, html } from "lit";
import { customElement, state } from "lit/decorators.js";
import type { Account, Platform } from "./types.js";
import "./common/platform-badge.js";
import "./common/modal.js";

type AccountStatus = Account["status"];

const STATUS_LABELS: Record<AccountStatus, string> = {
  active: "\u2705 Active",
  expired: "\u26A0\uFE0F Expired",
  error: "\u274C Error",
};

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
    }

    .btn-primary {
      background: var(--primary, #2e7d32);
      color: white;
      border: none;
    }

    .btn-primary:hover {
      background: #1b5e20;
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
  `;

  @state()
  private accounts: Account[] = [
    {
      id: "1",
      platform: "x",
      accountName: "@tech_kazuto",
      displayName: "Tech & AI についてのアカウント",
      status: "active",
      contentCount: 45,
      lastPostedAt: Date.now() - 1000 * 60 * 60 * 24,
    },
    {
      id: "2",
      platform: "note",
      accountName: "@kazuto",
      displayName: "長文記事用アカウント",
      status: "expired",
      contentCount: 12,
      lastPostedAt: Date.now() - 1000 * 60 * 60 * 48,
    },
    {
      id: "3",
      platform: "youtube",
      accountName: "@dev_kazuto",
      displayName: "開発ログ動画チャンネル",
      status: "error",
      contentCount: 8,
      lastPostedAt: Date.now() - 1000 * 60 * 60 * 72,
    },
  ];

  @state()
  private isModalOpen = false;

  @state()
  private newAccountPlatform: Platform = "x";

  @state()
  private newAccountName = "";

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
    if (confirm("このアカウントを削除しますか？")) {
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
      displayName: "新しいアカウント",
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
        <button class="btn btn-primary" @click="${this.openModal}">
          + アカウント追加
        </button>
      </div>

      <div class="account-grid">
        ${this.accounts.map(
          (account) => html`
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
                <span>投稿数: ${account.contentCount}件</span>
                <span>最終投稿: ${this.formatDate(account.lastPostedAt)}</span>
              </div>

              <div class="card-actions">
                ${account.status !== "active"
                  ? html`
                      <button
                        class="btn btn-secondary btn-sm"
                        @click="${() => this.handleReauth(account.id)}"
                      >
                        再認証
                      </button>
                    `
                  : null}
                <button
                  class="btn btn-secondary btn-sm"
                  @click="${() => this.handleSettings(account.id)}"
                >
                  設定
                </button>
                <button
                  class="btn btn-danger btn-sm"
                  @click="${() => this.handleDelete(account.id)}"
                >
                  削除
                </button>
              </div>
            </div>
          `,
        )}
      </div>

      <indra-modal
        ?open="${this.isModalOpen}"
        title="アカウント追加"
        @close="${this.closeModal}"
      >
        <div class="form-group">
          <label>プラットフォーム</label>
          <select
            .value="${this.newAccountPlatform}"
            @change="${this.handlePlatformChange}"
          >
            <option value="x">X (Twitter)</option>
            <option value="note">note</option>
            <option value="youtube">YouTube</option>
            <option value="instagram">Instagram</option>
            <option value="tiktok">TikTok</option>
            <option value="other">その他</option>
          </select>
        </div>
        <div class="form-group">
          <label>アカウント名</label>
          <input
            type="text"
            placeholder="@username"
            .value="${this.newAccountName}"
            @input="${this.handleNameChange}"
          />
        </div>
        <div slot="footer" class="modal-actions">
          <button class="btn btn-secondary" @click="${this.closeModal}">
            キャンセル
          </button>
          <button class="btn btn-primary" @click="${this.handleAddAccount}">
            追加
          </button>
        </div>
      </indra-modal>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "indra-accounts-page": AccountsPageElement;
  }
}
