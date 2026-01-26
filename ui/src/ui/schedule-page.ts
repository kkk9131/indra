import { LitElement, css, html } from "lit";
import { customElement, state } from "lit/decorators.js";
import type { Content, Platform } from "./types.js";
import "./common/platform-badge.js";
import "./common/modal.js";

interface ScheduledContent extends Content {
  scheduledAt: number;
}

type ViewMode = "today" | "week" | "month";

const WEEKDAY_NAMES = ["日", "月", "火", "水", "木", "金", "土"];

@customElement("indra-schedule-page")
export class SchedulePageElement extends LitElement {
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

    .view-toggles {
      display: flex;
      gap: 8px;
    }

    .toggle-btn {
      background: transparent;
      border: 1px solid var(--border, #e0e0e0);
      padding: 8px 16px;
      border-radius: 8px;
      cursor: pointer;
      font-family: var(--font-family, "Geist Mono", monospace);
      font-size: 14px;
      color: var(--text-secondary, #636e72);
      transition: all 0.15s ease;
    }

    .toggle-btn:hover {
      background-color: var(--bg-tertiary, #f5f5f5);
    }

    .toggle-btn.active {
      background-color: var(--primary, #2e7d32);
      color: white;
      border-color: var(--primary, #2e7d32);
    }

    .schedule-container {
      background: white;
      border-radius: 12px;
      padding: 24px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
    }

    .date-group {
      margin-bottom: 32px;
    }

    .date-group:last-child {
      margin-bottom: 0;
    }

    .date-header {
      font-size: 16px;
      font-weight: 600;
      margin-bottom: 16px;
      padding-left: 12px;
      border-left: 4px solid var(--primary, #2e7d32);
      color: var(--text-primary, #2d3436);
    }

    .schedule-item {
      display: flex;
      margin-bottom: 16px;
    }

    .schedule-item:last-child {
      margin-bottom: 0;
    }

    .time-col {
      width: 60px;
      text-align: right;
      padding-right: 16px;
      font-size: 14px;
      font-weight: 600;
      color: var(--text-primary, #2d3436);
      flex-shrink: 0;
      padding-top: 12px;
    }

    .content-col {
      flex-grow: 1;
      padding-left: 16px;
      border-left: 2px solid var(--border, #e0e0e0);
    }

    .item-card {
      background-color: var(--bg-tertiary, #f5f5f5);
      border: 1px solid var(--border, #e0e0e0);
      border-radius: 8px;
      padding: 16px;
      transition:
        transform 0.15s ease,
        box-shadow 0.15s ease;
    }

    .item-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    }

    .item-header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 8px;
    }

    .account-name {
      font-weight: 500;
      font-size: 14px;
    }

    .preview-text {
      color: var(--text-secondary, #636e72);
      font-size: 14px;
      margin-bottom: 12px;
      white-space: pre-wrap;
      line-height: 1.5;
    }

    .actions {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
    }

    .action-btn {
      background: white;
      border: 1px solid var(--border, #e0e0e0);
      padding: 6px 12px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 12px;
      font-family: var(--font-family, "Geist Mono", monospace);
      color: var(--text-primary, #2d3436);
      transition: all 0.15s ease;
    }

    .action-btn:hover {
      background-color: var(--bg-tertiary, #f5f5f5);
    }

    .action-btn.cancel {
      color: #dc3545;
      border-color: #ffcdd2;
    }

    .action-btn.cancel:hover {
      background-color: #ffebee;
    }

    .empty-state {
      text-align: center;
      padding: 60px 24px;
      color: var(--text-secondary, #636e72);
    }

    .empty-state-icon {
      font-size: 48px;
      margin-bottom: 16px;
    }

    .form-group {
      margin-bottom: 16px;
    }

    .form-group label {
      display: block;
      margin-bottom: 8px;
      font-size: 14px;
      font-weight: 500;
    }

    .form-group input {
      width: 100%;
      padding: 10px 12px;
      border: 1px solid var(--border, #e0e0e0);
      border-radius: 8px;
      font-family: var(--font-family, "Geist Mono", monospace);
      font-size: 14px;
      box-sizing: border-box;
    }

    .form-group input:focus {
      outline: none;
      border-color: var(--primary, #2e7d32);
    }

    .modal-actions {
      display: flex;
      justify-content: flex-end;
      gap: 12px;
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
  `;

  @state()
  private viewMode: ViewMode = "today";

  @state()
  private contents: ScheduledContent[] = [];

  @state()
  private isModalOpen = false;

  @state()
  private editingContent: ScheduledContent | null = null;

  @state()
  private editedTimeInput = "";

  connectedCallback(): void {
    super.connectedCallback();
    this.generateMockData();
  }

  private generateMockData(): void {
    const now = new Date();
    const startOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    ).getTime();

    const mockData: ScheduledContent[] = [
      {
        id: "1",
        platform: "x",
        accountId: "tech_kazuto",
        text: "週末イベントの告知\n皆さんご来場お待ちしています！",
        status: "scheduled",
        createdAt: Date.now(),
        updatedAt: Date.now(),
        scheduledAt: startOfToday + 18 * 60 * 60 * 1000,
      },
      {
        id: "2",
        platform: "x",
        accountId: "tech_kazuto",
        text: "今日の振り返り\n良い一日でした。",
        status: "scheduled",
        createdAt: Date.now(),
        updatedAt: Date.now(),
        scheduledAt: startOfToday + 21 * 60 * 60 * 1000,
      },
      {
        id: "3",
        platform: "note",
        accountId: "kazuto",
        text: "AI時代の働き方についての記事を公開しました。",
        status: "scheduled",
        createdAt: Date.now(),
        updatedAt: Date.now(),
        scheduledAt: startOfToday + 24 * 60 * 60 * 1000 + 10 * 60 * 60 * 1000,
      },
      {
        id: "4",
        platform: "youtube",
        accountId: "kazuto_dev",
        text: "新規動画アップロード: 【入門】LitでWebコンポーネントを作ろう",
        status: "scheduled",
        createdAt: Date.now(),
        updatedAt: Date.now(),
        scheduledAt:
          startOfToday + 2 * 24 * 60 * 60 * 1000 + 14 * 60 * 60 * 1000,
      },
    ];

    this.contents = mockData.sort((a, b) => a.scheduledAt - b.scheduledAt);
  }

  private getStartOfToday(): number {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  }

  private getFilteredContents(): ScheduledContent[] {
    const now = new Date();
    const startOfToday = this.getStartOfToday();

    return this.contents.filter((item) => {
      const itemDate = new Date(item.scheduledAt);

      switch (this.viewMode) {
        case "today": {
          const itemStartOfDay = new Date(
            itemDate.getFullYear(),
            itemDate.getMonth(),
            itemDate.getDate(),
          ).getTime();
          return itemStartOfDay === startOfToday;
        }
        case "week": {
          const startOfWeek = new Date(now);
          startOfWeek.setDate(now.getDate() - now.getDay());
          startOfWeek.setHours(0, 0, 0, 0);
          const endOfWeek = new Date(startOfWeek);
          endOfWeek.setDate(endOfWeek.getDate() + 6);
          endOfWeek.setHours(23, 59, 59, 999);
          return (
            item.scheduledAt >= startOfWeek.getTime() &&
            item.scheduledAt <= endOfWeek.getTime()
          );
        }
        case "month": {
          return (
            itemDate.getMonth() === now.getMonth() &&
            itemDate.getFullYear() === now.getFullYear()
          );
        }
        default:
          return true;
      }
    });
  }

  private formatDateString(timestamp: number): string {
    const date = new Date(timestamp);
    const weekDay = WEEKDAY_NAMES[date.getDay()];
    return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日（${weekDay}）`;
  }

  private formatTime(timestamp: number): string {
    const date = new Date(timestamp);
    return `${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}`;
  }

  private formatDateForInput(timestamp: number): string {
    const date = new Date(timestamp);
    const offset = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() - offset).toISOString().slice(0, 16);
  }

  private handleEditClick(item: ScheduledContent): void {
    this.editingContent = item;
    this.editedTimeInput = this.formatDateForInput(item.scheduledAt);
    this.isModalOpen = true;
  }

  private handleCancelClick(id: string): void {
    if (confirm("このスケジュールをキャンセルしますか？")) {
      this.contents = this.contents.filter((c) => c.id !== id);
    }
  }

  private handleModalClose(): void {
    this.isModalOpen = false;
    this.editingContent = null;
    this.editedTimeInput = "";
  }

  private handleTimeInputChange(e: Event): void {
    this.editedTimeInput = (e.target as HTMLInputElement).value;
  }

  private handleSaveEdit(): void {
    if (!this.editingContent) return;

    const newDate = new Date(this.editedTimeInput).getTime();
    if (Number.isNaN(newDate)) {
      alert("無効な日時です");
      return;
    }

    this.contents = this.contents.map((c) =>
      c.id === this.editingContent!.id
        ? { ...c, scheduledAt: newDate, updatedAt: Date.now() }
        : c,
    );

    this.handleModalClose();
  }

  private groupContentsByDate(
    contents: ScheduledContent[],
  ): Map<string, ScheduledContent[]> {
    const groups = new Map<string, ScheduledContent[]>();

    for (const item of contents) {
      const dateStr = this.formatDateString(item.scheduledAt);
      const group = groups.get(dateStr) ?? [];
      group.push(item);
      groups.set(dateStr, group);
    }

    return groups;
  }

  private setViewMode(mode: ViewMode): void {
    this.viewMode = mode;
  }

  render() {
    const filtered = this.getFilteredContents();
    const grouped = this.groupContentsByDate(filtered);

    return html`
      <div class="page-header">
        <span class="page-title">Schedule</span>
        <div class="view-toggles">
          <button
            class="toggle-btn ${this.viewMode === "today" ? "active" : ""}"
            @click="${() => this.setViewMode("today")}"
          >
            Today
          </button>
          <button
            class="toggle-btn ${this.viewMode === "week" ? "active" : ""}"
            @click="${() => this.setViewMode("week")}"
          >
            Week
          </button>
          <button
            class="toggle-btn ${this.viewMode === "month" ? "active" : ""}"
            @click="${() => this.setViewMode("month")}"
          >
            Month
          </button>
        </div>
      </div>

      <div class="schedule-container">
        ${filtered.length === 0
          ? html`
              <div class="empty-state">
                <div class="empty-state-icon">&#x1F4C5;</div>
                <div>予定された投稿はありません</div>
              </div>
            `
          : Array.from(grouped.entries()).map(
              ([dateStr, items]) => html`
                <div class="date-group">
                  <div class="date-header">${dateStr}</div>
                  ${items.map(
                    (item) => html`
                      <div class="schedule-item">
                        <div class="time-col">
                          ${this.formatTime(item.scheduledAt)}
                        </div>
                        <div class="content-col">
                          <div class="item-card">
                            <div class="item-header">
                              <indra-platform-badge
                                .platform="${item.platform as Platform}"
                              ></indra-platform-badge>
                              <span class="account-name"
                                >@${item.accountId}</span
                              >
                            </div>
                            <div class="preview-text">${item.text}</div>
                            <div class="actions">
                              <button
                                class="action-btn"
                                @click="${() => this.handleEditClick(item)}"
                              >
                                編集
                              </button>
                              <button
                                class="action-btn cancel"
                                @click="${() =>
                                  this.handleCancelClick(item.id)}"
                              >
                                キャンセル
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    `,
                  )}
                </div>
              `,
            )}
      </div>

      <indra-modal
        ?open="${this.isModalOpen}"
        title="投稿時刻の編集"
        @close="${this.handleModalClose}"
      >
        <div class="form-group">
          <label>新しい日時</label>
          <input
            type="datetime-local"
            .value="${this.editedTimeInput}"
            @input="${this.handleTimeInputChange}"
          />
        </div>
        <div slot="footer" class="modal-actions">
          <button class="btn btn-secondary" @click="${this.handleModalClose}">
            閉じる
          </button>
          <button class="btn btn-primary" @click="${this.handleSaveEdit}">
            保存
          </button>
        </div>
      </indra-modal>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "indra-schedule-page": SchedulePageElement;
  }
}
