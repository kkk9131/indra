import { LitElement, css, html, svg } from "lit";
import { customElement, state } from "lit/decorators.js";

import { wsClient, type NewsArticle } from "../services/ws-client.js";
import type { NewsSource } from "./types.js";
import "./news-timeline-item.js";
import "./xpost-modal.js";

const refreshIcon = svg`<path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 16h5v5"/>`;

type FilterOption = "all" | NewsSource;

@customElement("indra-news-page")
export class NewsPageElement extends LitElement {
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

    .refresh-btn {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 8px 16px;
      border-radius: 8px;
      border: 1px solid var(--border, #e0e0e0);
      background: white;
      color: var(--text-primary, #2d3436);
      font-family: inherit;
      font-size: 14px;
      cursor: pointer;
      transition: background 0.2s;
    }

    .refresh-btn:hover:not(:disabled) {
      background: var(--bg-tertiary, #f5f5f5);
    }

    .refresh-btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .refresh-btn svg {
      width: 16px;
      height: 16px;
      stroke: currentColor;
      stroke-width: 2;
      stroke-linecap: round;
      stroke-linejoin: round;
      fill: none;
    }

    .refresh-btn.loading svg {
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      from {
        transform: rotate(0deg);
      }
      to {
        transform: rotate(360deg);
      }
    }

    .tabs {
      display: flex;
      gap: 4px;
      padding: 4px;
      background: white;
      border-radius: 12px;
      width: fit-content;
    }

    .tab {
      padding: 8px 20px;
      border-radius: 8px;
      border: none;
      background: transparent;
      color: var(--text-secondary, #636e72);
      font-family: inherit;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition:
        background 0.2s,
        color 0.2s;
    }

    .tab:hover {
      background: var(--bg-tertiary, #f5f5f5);
    }

    .tab.active {
      background: var(--primary, #2e7d32);
      color: white;
    }

    .timeline {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .empty-state {
      text-align: center;
      padding: 60px 24px;
      background: white;
      border-radius: 12px;
      color: var(--text-secondary, #636e72);
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

    .error-state {
      text-align: center;
      padding: 24px;
      background: #ffebee;
      border-radius: 12px;
      color: #c62828;
      font-size: 14px;
    }
  `;

  @state()
  private filter: FilterOption = "all";

  @state()
  private articles: NewsArticle[] = [];

  @state()
  private expandedId: string | null = null;

  @state()
  private loading = true;

  @state()
  private refreshing = false;

  @state()
  private error: string | null = null;

  @state()
  private xpostArticle: NewsArticle | null = null;

  private boundHandleNewsUpdated = this.handleNewsUpdated.bind(this);
  private boundHandleConnected = this.handleConnected.bind(this);

  connectedCallback(): void {
    super.connectedCallback();
    wsClient.addEventListener("news.updated", this.boundHandleNewsUpdated);
    wsClient.addEventListener("connected", this.boundHandleConnected);

    if (wsClient.isConnected) {
      this.loadArticles();
    }
    // If not connected, loadArticles will be called when "connected" event fires
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    wsClient.removeEventListener("news.updated", this.boundHandleNewsUpdated);
    wsClient.removeEventListener("connected", this.boundHandleConnected);
  }

  private handleConnected(): void {
    this.loadArticles();
  }

  private handleNewsUpdated(e: Event): void {
    const event = e as CustomEvent<{ articles: NewsArticle[] }>;
    if (event.detail?.articles) {
      this.articles = event.detail.articles;
      this.refreshing = false;
    }
  }

  private async loadArticles(): Promise<void> {
    this.loading = true;
    this.error = null;

    try {
      this.articles = await wsClient.newsList();
    } catch (err) {
      this.error = err instanceof Error ? err.message : "Failed to load news";
    } finally {
      this.loading = false;
    }
  }

  private get displayArticles(): NewsArticle[] {
    const filtered =
      this.filter === "all"
        ? this.articles
        : this.articles.filter((a) => a.source === this.filter);

    return [...filtered].sort((a, b) => {
      const dateA = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
      const dateB = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
      return dateB - dateA;
    });
  }

  private handleTabClick(filter: FilterOption): void {
    this.filter = filter;
  }

  private async handleRefresh(): Promise<void> {
    if (this.refreshing) return;

    this.refreshing = true;
    this.error = null;

    try {
      await wsClient.newsRefresh();
    } catch (err) {
      this.error =
        err instanceof Error ? err.message : "Failed to refresh news";
      this.refreshing = false;
    }
  }

  private handleToggle(e: CustomEvent): void {
    const { id } = e.detail;
    this.expandedId = this.expandedId === id ? null : id;
  }

  private handlePostToX(e: CustomEvent): void {
    const { article } = e.detail as { article: NewsArticle };
    this.xpostArticle = article;
  }

  private handleCloseXpostModal(): void {
    this.xpostArticle = null;
  }

  private renderContent(): ReturnType<typeof html> {
    if (this.error) {
      return html`<div class="error-state">${this.error}</div>`;
    }

    if (this.loading) {
      return html`<div class="loading-state">Loading news...</div>`;
    }

    if (this.displayArticles.length === 0) {
      return html`
        <div class="empty-state">
          <div class="empty-state-text">
            No articles found. Click Refresh to fetch the latest news.
          </div>
        </div>
      `;
    }

    return html`
      <div class="timeline">
        ${this.displayArticles.map(
          (article) => html`
            <indra-news-timeline-item
              .article="${article}"
              .expanded="${this.expandedId === article.id}"
              @toggle="${this.handleToggle}"
              @post-to-x="${this.handlePostToX}"
            ></indra-news-timeline-item>
          `,
        )}
      </div>
    `;
  }

  render() {
    return html`
      <div class="page-header">
        <span class="page-title">News</span>
        <button
          class="refresh-btn ${this.refreshing ? "loading" : ""}"
          @click="${this.handleRefresh}"
          ?disabled="${this.refreshing}"
        >
          <svg viewBox="0 0 24 24">${refreshIcon}</svg>
          ${this.refreshing ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      <div class="tabs">
        <button
          class="tab ${this.filter === "all" ? "active" : ""}"
          @click="${() => this.handleTabClick("all")}"
        >
          All
        </button>
        <button
          class="tab ${this.filter === "claude-code" ? "active" : ""}"
          @click="${() => this.handleTabClick("claude-code")}"
        >
          Claude Code
        </button>
        <button
          class="tab ${this.filter === "blog" ? "active" : ""}"
          @click="${() => this.handleTabClick("blog")}"
        >
          Blog
        </button>
        <button
          class="tab ${this.filter === "news-report" ? "active" : ""}"
          @click="${() => this.handleTabClick("news-report")}"
        >
          News Report
        </button>
        <button
          class="tab ${this.filter === "indra-log" ? "active" : ""}"
          @click="${() => this.handleTabClick("indra-log")}"
        >
          Indra Log
        </button>
        <button
          class="tab ${this.filter === "github-changelog" ? "active" : ""}"
          @click="${() => this.handleTabClick("github-changelog")}"
        >
          Changelog
        </button>
      </div>

      ${this.renderContent()}
      ${this.xpostArticle
        ? html`
            <indra-xpost-modal
              .article="${this.xpostArticle}"
              @close="${this.handleCloseXpostModal}"
              @approved="${this.handleCloseXpostModal}"
            ></indra-xpost-modal>
          `
        : null}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "indra-news-page": NewsPageElement;
  }
}
