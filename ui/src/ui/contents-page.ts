import { LitElement, css, html } from "lit";
import { customElement, state } from "lit/decorators.js";
import type { Content, ContentStatus, Platform } from "./types.js";
import { STATUS_CONFIG } from "./common/styles.js";
import "./common/platform-badge.js";

type StatusFilter = ContentStatus | "all";
type PlatformFilter = Platform | "all";

const STATUS_TABS: StatusFilter[] = [
  "all",
  "pending",
  "approved",
  "rejected",
  "posted",
];

const PLATFORMS: PlatformFilter[] = [
  "all",
  "x",
  "note",
  "youtube",
  "instagram",
  "tiktok",
  "other",
];

const MOCK_CONTENTS: Content[] = [
  {
    id: "1",
    platform: "x",
    accountId: "@tech_kazuto",
    text: "AIは創造性を補完するツール。最前線の活用事例をシェアします。",
    status: "posted",
    createdAt: Date.now() - 86400000,
    updatedAt: Date.now() - 86400000,
  },
  {
    id: "2",
    platform: "x",
    accountId: "@tech_kazuto",
    text: "週末に開催するAIエンジニア向けイベントの詳細が決定しました！",
    status: "pending",
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: "3",
    platform: "note",
    accountId: "@kazuto",
    text: "AI時代の新しい働き方：リモート×AI×個人の可能性",
    status: "rejected",
    createdAt: Date.now() - 172800000,
    updatedAt: Date.now() - 172800000,
  },
  {
    id: "4",
    platform: "youtube",
    accountId: "@kazuto_tech",
    text: "【完全版】GPT-5の実力を徹底検証！実際に使ってみた結果...",
    status: "approved",
    createdAt: Date.now() - 259200000,
    updatedAt: Date.now() - 259200000,
  },
  {
    id: "5",
    platform: "instagram",
    accountId: "@kazuto_official",
    text: "日々の学びを記録。今日は新しいプロジェクトをスタート。",
    status: "scheduled",
    createdAt: Date.now() - 345600000,
    updatedAt: Date.now() - 345600000,
  },
  {
    id: "6",
    platform: "tiktok",
    accountId: "@kazuto_shorts",
    text: "1分でわかる！AIツールの使い方紹介",
    status: "posted",
    createdAt: Date.now() - 432000000,
    updatedAt: Date.now() - 432000000,
  },
  {
    id: "7",
    platform: "x",
    accountId: "@tech_kazuto",
    text: "開発者の生産性を3倍にする習慣まとめ",
    status: "pending",
    createdAt: Date.now() - 518400000,
    updatedAt: Date.now() - 518400000,
  },
];

@customElement("indra-contents-page")
export class ContentsPageElement extends LitElement {
  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      gap: 16px;
      font-family: var(--font-family, "Geist Mono", monospace);
    }

    .page-header {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .page-title {
      font-size: 24px;
      font-weight: 600;
      color: var(--text-primary, #2d3436);
    }

    .tabs {
      display: flex;
      gap: 8px;
      padding: 4px;
      background: var(--bg-tertiary, #f5f5f5);
      border-radius: 8px;
    }

    .tab {
      padding: 8px 16px;
      border: none;
      background: transparent;
      color: var(--text-secondary, #636e72);
      font-size: 13px;
      font-weight: 500;
      font-family: inherit;
      cursor: pointer;
      border-radius: 6px;
      transition: all 0.2s;
    }

    .tab:hover {
      background: rgba(0, 0, 0, 0.05);
    }

    .tab.active {
      background: white;
      color: var(--primary, #2e7d32);
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    }

    .filters {
      display: flex;
      gap: 12px;
      align-items: center;
      flex-wrap: wrap;
    }

    .filter-group {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .filter-group.search {
      flex: 1;
      min-width: 200px;
    }

    .filter-label {
      font-size: 13px;
      color: var(--text-secondary, #636e72);
      white-space: nowrap;
    }

    .search-input,
    .platform-select {
      padding: 8px 12px;
      border: 1px solid var(--border, #e0e0e0);
      border-radius: 6px;
      font-size: 13px;
      font-family: inherit;
      background: white;
    }

    .search-input {
      flex: 1;
    }

    .search-input:focus,
    .platform-select:focus {
      outline: none;
      border-color: var(--primary, #2e7d32);
    }

    .platform-select {
      cursor: pointer;
    }

    .table-container {
      background: white;
      border: 1px solid var(--border, #e0e0e0);
      border-radius: 8px;
      overflow: hidden;
    }

    .table {
      width: 100%;
      border-collapse: collapse;
    }

    .table-header {
      background: var(--bg-tertiary, #f5f5f5);
      border-bottom: 2px solid var(--border, #e0e0e0);
    }

    .table-header th {
      padding: 12px 16px;
      text-align: left;
      font-size: 12px;
      font-weight: 600;
      color: var(--text-secondary, #636e72);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .table-body {
      font-size: 13px;
    }

    .table-row {
      border-bottom: 1px solid var(--border, #e0e0e0);
      transition: background 0.2s;
    }

    .table-row:hover {
      background: var(--bg-primary, #e8f5e9);
    }

    .table-row:last-child {
      border-bottom: none;
    }

    .table-cell {
      padding: 12px 16px;
      color: var(--text-primary, #2d3436);
    }

    .cell-platform {
      width: 100px;
    }

    .cell-account {
      width: 150px;
    }

    .cell-content {
      max-width: 400px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .cell-status {
      width: 100px;
    }

    .cell-date {
      width: 80px;
      font-size: 12px;
      color: var(--text-secondary, #636e72);
    }

    .status-badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 500;
    }

    .empty-state {
      padding: 48px;
      text-align: center;
      color: var(--text-secondary, #636e72);
      font-size: 14px;
    }
  `;

  @state()
  private selectedStatus: StatusFilter = "all";

  @state()
  private selectedPlatform: PlatformFilter = "all";

  @state()
  private searchQuery = "";

  @state()
  private contents: Content[] = MOCK_CONTENTS;

  private get filteredContents(): Content[] {
    return this.contents.filter((content) => {
      const matchesStatus =
        this.selectedStatus === "all" || content.status === this.selectedStatus;
      const matchesPlatform =
        this.selectedPlatform === "all" ||
        content.platform === this.selectedPlatform;
      const matchesSearch =
        this.searchQuery === "" ||
        content.text.toLowerCase().includes(this.searchQuery.toLowerCase()) ||
        content.accountId
          .toLowerCase()
          .includes(this.searchQuery.toLowerCase());
      return matchesStatus && matchesPlatform && matchesSearch;
    });
  }

  private formatDate(timestamp: number): string {
    const date = new Date(timestamp);
    return `${date.getMonth() + 1}/${date.getDate()}`;
  }

  private capitalizeFirst(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  private handleStatusChange(status: StatusFilter): void {
    this.selectedStatus = status;
  }

  private handlePlatformChange(e: Event): void {
    this.selectedPlatform = (e.target as HTMLSelectElement)
      .value as PlatformFilter;
  }

  private handleSearchChange(e: Event): void {
    this.searchQuery = (e.target as HTMLInputElement).value;
  }

  render() {
    const filtered = this.filteredContents;

    return html`
      <div class="page-header">
        <span class="page-title">Contents</span>
      </div>

      <div class="tabs">
        ${STATUS_TABS.map(
          (status) => html`
            <button
              class="tab ${this.selectedStatus === status ? "active" : ""}"
              @click="${() => this.handleStatusChange(status)}"
            >
              ${status === "all" ? "All" : STATUS_CONFIG[status].label}
            </button>
          `,
        )}
      </div>

      <div class="filters">
        <div class="filter-group search">
          <span class="filter-label">検索:</span>
          <input
            class="search-input"
            type="text"
            placeholder="コンテンツを検索..."
            .value="${this.searchQuery}"
            @input="${this.handleSearchChange}"
          />
        </div>
        <div class="filter-group">
          <span class="filter-label">プラットフォーム:</span>
          <select
            class="platform-select"
            .value="${this.selectedPlatform}"
            @change="${this.handlePlatformChange}"
          >
            ${PLATFORMS.map(
              (platform) => html`
                <option value="${platform}">
                  ${platform === "all" ? "All" : this.capitalizeFirst(platform)}
                </option>
              `,
            )}
          </select>
        </div>
      </div>

      <div class="table-container">
        ${filtered.length === 0
          ? html`<div class="empty-state">一致するコンテンツがありません</div>`
          : html`
              <table class="table">
                <thead class="table-header">
                  <tr>
                    <th class="table-cell cell-platform">Platform</th>
                    <th class="table-cell cell-account">Account</th>
                    <th class="table-cell cell-content">Content</th>
                    <th class="table-cell cell-status">Status</th>
                    <th class="table-cell cell-date">Date</th>
                  </tr>
                </thead>
                <tbody class="table-body">
                  ${filtered.map((content) => {
                    const statusConfig = STATUS_CONFIG[content.status];
                    return html`
                      <tr class="table-row">
                        <td class="table-cell cell-platform">
                          <indra-platform-badge
                            .platform="${content.platform}"
                            compact
                          ></indra-platform-badge>
                        </td>
                        <td class="table-cell cell-account">
                          ${content.accountId}
                        </td>
                        <td
                          class="table-cell cell-content"
                          title="${content.text}"
                        >
                          ${content.text}
                        </td>
                        <td class="table-cell cell-status">
                          <span
                            class="status-badge"
                            style="background: ${statusConfig.color}20; color: ${statusConfig.color};"
                          >
                            ${statusConfig.icon} ${statusConfig.label}
                          </span>
                        </td>
                        <td class="table-cell cell-date">
                          ${this.formatDate(content.createdAt)}
                        </td>
                      </tr>
                    `;
                  })}
                </tbody>
              </table>
            `}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "indra-contents-page": ContentsPageElement;
  }
}
