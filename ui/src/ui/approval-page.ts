import { LitElement, css, html, svg } from "lit";
import { customElement, state } from "lit/decorators.js";
import type { Content, ContentStatus, Platform } from "./types.js";
import "./common/content-card.js";
import "./common/modal.js";

// Lucide icon - Check Circle
const checkCircleIcon = svg`<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>`;

type FilterOption = Platform | "all";
type SortOption = "date-desc" | "date-asc";

const MOCK_ACCOUNTS: Record<string, string> = {
  user_x_01: "@tech_kazuto",
  user_x_02: "@tech_kazuto",
  user_note_01: "@kazuto",
  channel_yt_01: "@dev_kazuto",
  user_ig_01: "@photo_kazuto",
  user_tt_01: "@tiktok_kazuto",
};

@customElement("indra-approval-page")
export class ApprovalPageElement extends LitElement {
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

    .controls {
      display: flex;
      gap: 12px;
      align-items: center;
    }

    select {
      padding: 8px 12px;
      border: 1px solid var(--border, #e0e0e0);
      border-radius: 8px;
      font-family: var(--font-family, "Geist Mono", monospace);
      font-size: 14px;
      background: white;
      cursor: pointer;
    }

    select:focus {
      outline: none;
      border-color: var(--primary, #2e7d32);
    }

    .content-list {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .empty-state {
      text-align: center;
      padding: 60px 24px;
      background: white;
      border-radius: 12px;
      color: var(--text-secondary, #636e72);
    }

    .empty-state-icon {
      width: 48px;
      height: 48px;
      margin: 0 auto 16px;
    }

    .empty-state-icon svg {
      width: 100%;
      height: 100%;
      fill: none;
      stroke: var(--text-secondary, #636e72);
      stroke-width: 1.5;
      stroke-linecap: round;
      stroke-linejoin: round;
    }

    .empty-state-text {
      font-size: 16px;
    }

    .preview-content {
      padding: 16px 0;
    }

    .preview-meta {
      display: flex;
      gap: 16px;
      margin-bottom: 16px;
      font-size: 14px;
      color: var(--text-secondary, #636e72);
    }

    .preview-text {
      white-space: pre-wrap;
      line-height: 1.6;
      font-size: 14px;
    }

    .close-btn {
      padding: 10px 20px;
      border-radius: 8px;
      border: 1px solid var(--border, #e0e0e0);
      background: var(--bg-tertiary, #f5f5f5);
      cursor: pointer;
      font-family: inherit;
    }

    .close-btn:hover {
      background: var(--border, #e0e0e0);
    }
  `;

  @state()
  private contents: Content[] = [
    {
      id: "1",
      platform: "x",
      accountId: "user_x_01",
      text: "AIは創造性を奪うのではなく、拡張する。人間の想像力とAIの処理能力が組み合わさることで、これまで不可能だったことが可能になる。",
      status: "pending",
      createdAt: Date.now() - 1000 * 60 * 30,
      updatedAt: Date.now() - 1000 * 60 * 30,
    },
    {
      id: "2",
      platform: "x",
      accountId: "user_x_02",
      text: "週末イベントの告知です！AIとクリエイティビティをテーマにしたワークショップを開催します。",
      status: "pending",
      createdAt: Date.now() - 1000 * 60 * 60 * 2,
      updatedAt: Date.now() - 1000 * 60 * 60 * 2,
    },
    {
      id: "3",
      platform: "note",
      accountId: "user_note_01",
      text: "AI時代の働き方について考える。これからのキャリア形成に必要なスキルとマインドセットとは何か。",
      status: "pending",
      createdAt: Date.now() - 1000 * 60 * 60 * 5,
      updatedAt: Date.now() - 1000 * 60 * 60 * 5,
    },
    {
      id: "4",
      platform: "instagram",
      accountId: "user_ig_01",
      text: "オフィスの新しいコーヒーマシンが到着しました！ #office #coffee",
      status: "pending",
      createdAt: Date.now() - 1000 * 60 * 60 * 8,
      updatedAt: Date.now() - 1000 * 60 * 60 * 8,
    },
  ];

  @state()
  private filterPlatform: FilterOption = "all";

  @state()
  private sortOrder: SortOption = "date-desc";

  @state()
  private previewContent: Content | null = null;

  private get displayContents(): Content[] {
    const pending = this.contents.filter((c) => c.status === "pending");
    const filtered =
      this.filterPlatform === "all"
        ? pending
        : pending.filter((c) => c.platform === this.filterPlatform);

    return [...filtered].sort((a, b) =>
      this.sortOrder === "date-desc"
        ? b.createdAt - a.createdAt
        : a.createdAt - b.createdAt,
    );
  }

  private handleFilterChange(e: Event): void {
    this.filterPlatform = (e.target as HTMLSelectElement).value as FilterOption;
  }

  private handleSortChange(e: Event): void {
    this.sortOrder = (e.target as HTMLSelectElement).value as SortOption;
  }

  private handleAction(e: CustomEvent): void {
    const { action, content } = e.detail as {
      action: string;
      content: Content;
    };

    const statusActions: Record<string, ContentStatus> = {
      approve: "approved",
      reject: "rejected",
    };

    if (action in statusActions) {
      this.updateStatus(content.id, statusActions[action]);
      return;
    }

    if (action === "preview" || action === "edit") {
      this.previewContent = content;
    }
  }

  private updateStatus(id: string, newStatus: ContentStatus): void {
    this.contents = this.contents.map((c) =>
      c.id === id ? { ...c, status: newStatus, updatedAt: Date.now() } : c,
    );
  }

  private closeModal(): void {
    this.previewContent = null;
  }

  private getAccountName(accountId: string): string {
    return MOCK_ACCOUNTS[accountId] ?? accountId;
  }

  render() {
    return html`
      <div class="page-header">
        <span class="page-title">Approval</span>
        <div class="controls">
          <select
            .value="${this.filterPlatform}"
            @change="${this.handleFilterChange}"
          >
            <option value="all">All Platforms</option>
            <option value="x">X (Twitter)</option>
            <option value="note">note</option>
            <option value="youtube">YouTube</option>
            <option value="instagram">Instagram</option>
            <option value="tiktok">TikTok</option>
            <option value="other">Other</option>
          </select>

          <select .value="${this.sortOrder}" @change="${this.handleSortChange}">
            <option value="date-desc">Newest First</option>
            <option value="date-asc">Oldest First</option>
          </select>
        </div>
      </div>

      <div class="content-list">
        ${this.displayContents.length > 0
          ? this.displayContents.map(
              (content) => html`
                <indra-content-card
                  .content="${content}"
                  .accountName="${this.getAccountName(content.accountId)}"
                  @action="${this.handleAction}"
                ></indra-content-card>
              `,
            )
          : html`
              <div class="empty-state">
                <div class="empty-state-icon">
                  <svg viewBox="0 0 24 24">${checkCircleIcon}</svg>
                </div>
                <div class="empty-state-text">No pending contents</div>
              </div>
            `}
      </div>

      <indra-modal
        ?open="${this.previewContent !== null}"
        title="Content Preview"
        @close="${this.closeModal}"
      >
        ${this.previewContent
          ? html`
              <div class="preview-content">
                <div class="preview-meta">
                  <span>Platform: ${this.previewContent.platform}</span>
                  <span>
                    Account:
                    ${this.getAccountName(this.previewContent.accountId)}
                  </span>
                </div>
                <div class="preview-text">${this.previewContent.text}</div>
              </div>
            `
          : null}
        <div slot="footer">
          <button class="close-btn" @click="${this.closeModal}">Close</button>
        </div>
      </indra-modal>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "indra-approval-page": ApprovalPageElement;
  }
}
