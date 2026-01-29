import { LitElement, css, html, svg } from "lit";
import { customElement, state } from "lit/decorators.js";
import type { Content, Platform } from "./types.js";
import { approvalItemToContent } from "./types.js";
import { wsClient } from "../services/ws-client.js";
import "./common/content-card.js";
import "./common/modal.js";
import "./common/schedule-modal.js";

// Lucide icon - Check Circle
const checkCircleIcon = svg`<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>`;

// Loading spinner icon
const loadingIcon = svg`<path d="M21 12a9 9 0 1 1-6.219-8.56"/>`;

type FilterOption = Platform | "all";
type SortOption = "date-desc" | "date-asc";

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

    .loading-state {
      text-align: center;
      padding: 60px 24px;
      background: white;
      border-radius: 12px;
      color: var(--text-secondary, #636e72);
    }

    .loading-icon {
      width: 32px;
      height: 32px;
      margin: 0 auto 16px;
      animation: spin 1s linear infinite;
    }

    .loading-icon svg {
      width: 100%;
      height: 100%;
      fill: none;
      stroke: var(--primary, #2e7d32);
      stroke-width: 2;
      stroke-linecap: round;
      stroke-linejoin: round;
    }

    @keyframes spin {
      from {
        transform: rotate(0deg);
      }
      to {
        transform: rotate(360deg);
      }
    }

    .error-state {
      text-align: center;
      padding: 60px 24px;
      background: #ffebee;
      border-radius: 12px;
      color: #c62828;
    }

    .error-state-text {
      font-size: 14px;
      margin-bottom: 16px;
    }

    .retry-btn {
      padding: 8px 16px;
      border: 1px solid #c62828;
      border-radius: 8px;
      background: transparent;
      color: #c62828;
      cursor: pointer;
      font-family: inherit;
    }

    .retry-btn:hover {
      background: #ffcdd2;
    }

    .connection-status {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 12px;
      color: var(--text-secondary, #636e72);
    }

    .status-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
    }

    .status-dot.connected {
      background: #2e7d32;
    }

    .status-dot.disconnected {
      background: #c62828;
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
  private contents: Content[] = [];

  @state()
  private isLoading = true;

  @state()
  private error: string | null = null;

  @state()
  private wsConnected = false;

  @state()
  private filterPlatform: FilterOption = "all";

  @state()
  private sortOrder: SortOption = "date-desc";

  @state()
  private previewContent: Content | null = null;

  @state()
  private scheduleTarget: Content | null = null;

  private handleConnected = () => {
    this.wsConnected = true;
    this.loadContents();
  };

  private handleDisconnected = () => {
    this.wsConnected = false;
  };

  private handlePostCreated = (e: Event) => {
    const detail = (e as CustomEvent).detail;
    if (detail?.item) {
      const content = approvalItemToContent(detail.item);
      this.contents = [content, ...this.contents];
    }
  };

  private handlePostUpdated = (e: Event) => {
    const detail = (e as CustomEvent).detail;
    if (detail?.item) {
      const updatedContent = approvalItemToContent(detail.item);
      this.contents = this.contents.map((c) =>
        c.id === updatedContent.id ? updatedContent : c,
      );
    }
  };

  connectedCallback() {
    super.connectedCallback();

    wsClient.addEventListener("connected", this.handleConnected);
    wsClient.addEventListener("disconnected", this.handleDisconnected);
    wsClient.addEventListener("post.created", this.handlePostCreated);
    wsClient.addEventListener("post.updated", this.handlePostUpdated);

    // Connect if not already connected
    if (!wsClient.isConnected) {
      wsClient.connect();
    } else {
      this.wsConnected = true;
      this.loadContents();
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();

    wsClient.removeEventListener("connected", this.handleConnected);
    wsClient.removeEventListener("disconnected", this.handleDisconnected);
    wsClient.removeEventListener("post.created", this.handlePostCreated);
    wsClient.removeEventListener("post.updated", this.handlePostUpdated);
  }

  private async loadContents(): Promise<void> {
    this.isLoading = true;
    this.error = null;

    try {
      const items = await wsClient.postList();
      this.contents = items.map(approvalItemToContent);
    } catch (err) {
      this.error = err instanceof Error ? err.message : "Failed to load posts";
    } finally {
      this.isLoading = false;
    }
  }

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

  private async handleAction(e: CustomEvent): Promise<void> {
    const { action, content } = e.detail as {
      action: string;
      content: Content;
    };

    switch (action) {
      case "approve":
        await this.approveContent(content.id);
        break;
      case "reject":
        await this.rejectContent(content.id);
        break;
      case "schedule":
        this.scheduleTarget = content;
        break;
      case "preview":
      case "edit":
        this.previewContent = content;
        break;
    }
  }

  private async approveContent(id: string): Promise<void> {
    try {
      const item = await wsClient.postApprove(id);
      const updatedContent = approvalItemToContent(item);
      this.contents = this.contents.map((c) =>
        c.id === id ? updatedContent : c,
      );
    } catch (err) {
      console.error("Failed to approve:", err);
      // Show error to user (could use a toast notification)
    }
  }

  private async rejectContent(id: string): Promise<void> {
    try {
      const item = await wsClient.postReject(id);
      const updatedContent = approvalItemToContent(item);
      this.contents = this.contents.map((c) =>
        c.id === id ? updatedContent : c,
      );
    } catch (err) {
      console.error("Failed to reject:", err);
    }
  }

  private closeModal(): void {
    this.previewContent = null;
  }

  private closeScheduleModal(): void {
    this.scheduleTarget = null;
  }

  private async handleScheduleConfirm(e: CustomEvent): Promise<void> {
    if (!this.scheduleTarget) return;

    const { scheduledAt } = e.detail as { scheduledAt: string };

    try {
      const item = await wsClient.postSchedule(
        this.scheduleTarget.id,
        scheduledAt,
      );
      const updatedContent = approvalItemToContent(item);
      this.contents = this.contents.map((c) =>
        c.id === this.scheduleTarget!.id ? updatedContent : c,
      );
      this.scheduleTarget = null;
    } catch (err) {
      console.error("Failed to schedule:", err);
    }
  }

  private handleRetry(): void {
    if (!wsClient.isConnected) {
      wsClient.connect();
    } else {
      this.loadContents();
    }
  }

  render() {
    return html`
      <div class="page-header">
        <span class="page-title">Approval</span>
        <div class="controls">
          <div class="connection-status">
            <span
              class="status-dot ${this.wsConnected
                ? "connected"
                : "disconnected"}"
            ></span>
            ${this.wsConnected ? "Connected" : "Disconnected"}
          </div>

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

      <div class="content-list">${this.renderContentList()}</div>

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
                  <span> Status: ${this.previewContent.status} </span>
                </div>
                <div class="preview-text">${this.previewContent.text}</div>
              </div>
            `
          : null}
        <div slot="footer">
          <button class="close-btn" @click="${this.closeModal}">Close</button>
        </div>
      </indra-modal>

      <indra-schedule-modal
        ?open="${this.scheduleTarget !== null}"
        @schedule="${this.handleScheduleConfirm}"
        @close="${this.closeScheduleModal}"
      ></indra-schedule-modal>
    `;
  }

  private renderContentList() {
    if (this.isLoading) {
      return html`
        <div class="loading-state">
          <div class="loading-icon">
            <svg viewBox="0 0 24 24">${loadingIcon}</svg>
          </div>
          <div>Loading posts...</div>
        </div>
      `;
    }

    if (this.error) {
      return html`
        <div class="error-state">
          <div class="error-state-text">${this.error}</div>
          <button class="retry-btn" @click="${this.handleRetry}">Retry</button>
        </div>
      `;
    }

    if (this.displayContents.length === 0) {
      return html`
        <div class="empty-state">
          <div class="empty-state-icon">
            <svg viewBox="0 0 24 24">${checkCircleIcon}</svg>
          </div>
          <div class="empty-state-text">No pending contents</div>
        </div>
      `;
    }

    return this.displayContents.map(
      (content) => html`
        <indra-content-card
          .content="${content}"
          .accountName="${content.accountId}"
          @action="${this.handleAction}"
        ></indra-content-card>
      `,
    );
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "indra-approval-page": ApprovalPageElement;
  }
}
