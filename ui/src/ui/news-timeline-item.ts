import { LitElement, css, html, svg } from "lit";
import { customElement, property } from "lit/decorators.js";

import type { NewsArticle } from "../services/ws-client.js";

const chevronDownIcon = svg`<polyline points="6 9 12 15 18 9"/>`;
const chevronUpIcon = svg`<polyline points="18 15 12 9 6 15"/>`;
const externalLinkIcon = svg`<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>`;
// X (Twitter) logo
const xIcon = svg`<path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>`;

@customElement("indra-news-timeline-item")
export class NewsTimelineItemElement extends LitElement {
  static styles = css`
    :host {
      display: block;
      font-family: var(--font-family, "Geist Mono", monospace);
    }

    .item {
      background: white;
      border-radius: 12px;
      padding: 16px 20px;
      cursor: pointer;
      transition:
        box-shadow 0.2s,
        transform 0.2s;
    }

    .item:hover {
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    }

    .item.expanded {
      cursor: default;
    }

    .header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 12px;
    }

    .header-left {
      display: flex;
      flex-direction: column;
      gap: 8px;
      flex: 1;
      min-width: 0;
    }

    .title-row {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .badge {
      display: inline-flex;
      align-items: center;
      padding: 4px 10px;
      border-radius: 12px;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      white-space: nowrap;
    }

    .badge.claude-code {
      background: rgba(46, 125, 50, 0.1);
      color: #2e7d32;
    }

    .badge.blog {
      background: rgba(46, 125, 50, 0.1);
      color: #2e7d32;
    }

    .badge.log-analysis {
      background: rgba(52, 152, 219, 0.1);
      color: #2980b9;
    }

    .badge.github-changelog {
      background: rgba(100, 100, 100, 0.1);
      color: #555;
    }

    .title {
      font-size: 16px;
      font-weight: 600;
      color: var(--text-primary, #2d3436);
      line-height: 1.4;
    }

    .summary {
      font-size: 14px;
      color: var(--text-secondary, #636e72);
      line-height: 1.5;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    .meta {
      font-size: 12px;
      color: var(--text-secondary, #636e72);
      margin-top: 4px;
    }

    .toggle-icon {
      width: 24px;
      height: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      color: var(--text-secondary, #636e72);
    }

    .toggle-icon svg {
      width: 18px;
      height: 18px;
      stroke: currentColor;
      stroke-width: 2;
      stroke-linecap: round;
      stroke-linejoin: round;
      fill: none;
    }

    .content {
      margin-top: 16px;
      padding-top: 16px;
      border-top: 1px solid var(--border, #e0e0e0);
    }

    .content-text {
      font-size: 14px;
      color: var(--text-primary, #2d3436);
      line-height: 1.7;
      white-space: pre-wrap;
    }

    .actions {
      margin-top: 16px;
      display: flex;
      gap: 12px;
    }

    .view-original {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 8px 16px;
      border-radius: 8px;
      border: 1px solid var(--primary, #2e7d32);
      background: transparent;
      color: var(--primary, #2e7d32);
      font-family: inherit;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      text-decoration: none;
      transition: background 0.2s;
    }

    .view-original:hover {
      background: rgba(46, 125, 50, 0.08);
    }

    .view-original svg {
      width: 14px;
      height: 14px;
      stroke: currentColor;
      stroke-width: 2;
      stroke-linecap: round;
      stroke-linejoin: round;
      fill: none;
    }

    .footer {
      display: flex;
      justify-content: flex-end;
      margin-top: 12px;
    }

    .post-x-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      border-radius: 8px;
      border: none;
      background: #000;
      cursor: pointer;
      transition: background 0.2s;
    }

    .post-x-btn:hover {
      background: #333;
    }

    .post-x-btn svg {
      width: 16px;
      height: 16px;
      fill: #fff;
    }
  `;

  @property({ type: Object })
  article!: NewsArticle;

  @property({ type: Boolean })
  expanded = false;

  private handleClick(e: Event): void {
    const target = e.target as HTMLElement;
    if (target.closest("a") || target.closest(".post-x-btn")) {
      return;
    }
    this.dispatchEvent(
      new CustomEvent("toggle", {
        detail: { id: this.article.id },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private handlePostToX(e: Event): void {
    e.stopPropagation();
    this.dispatchEvent(
      new CustomEvent("post-to-x", {
        detail: { article: this.article },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private formatDate(dateStr: string | null): string {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    return date.toLocaleDateString("ja-JP", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  private getBadgeClass(): string {
    switch (this.article.source) {
      case "claude-code":
        return "claude-code";
      case "log-analysis":
        return "log-analysis";
      case "github-changelog":
        return "github-changelog";
      default:
        return "blog";
    }
  }

  private getBadgeLabel(): string {
    switch (this.article.source) {
      case "claude-code":
        return "Claude Code";
      case "log-analysis":
        return "Report";
      case "github-changelog":
        return "Changelog";
      default:
        return "Blog";
    }
  }

  render() {
    const badgeClass = this.getBadgeClass();
    const badgeLabel = this.getBadgeLabel();

    return html`
      <article
        class="item ${this.expanded ? "expanded" : ""}"
        @click="${this.handleClick}"
      >
        <div class="header">
          <div class="header-left">
            <div class="title-row">
              <span class="badge ${badgeClass}">${badgeLabel}</span>
              <span class="title">${this.article.title}</span>
            </div>
            ${!this.expanded && this.article.summary
              ? html`<div class="summary">${this.article.summary}</div>`
              : null}
            ${this.article.publishedAt
              ? html`<div class="meta">
                  ${this.formatDate(this.article.publishedAt)}
                </div>`
              : null}
          </div>
          <div class="toggle-icon">
            <svg viewBox="0 0 24 24">
              ${this.expanded ? chevronUpIcon : chevronDownIcon}
            </svg>
          </div>
        </div>

        ${this.expanded
          ? html`
              <div class="content">
                <div class="content-text">
                  ${this.article.body || this.article.summary || ""}
                </div>
                <div class="actions">
                  <a
                    class="view-original"
                    href="${this.article.url}"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    View Original
                    <svg viewBox="0 0 24 24">${externalLinkIcon}</svg>
                  </a>
                </div>
              </div>
            `
          : null}

        <div class="footer">
          <button
            class="post-x-btn"
            @click="${this.handlePostToX}"
            title="Post to X"
          >
            <svg viewBox="0 0 24 24">${xIcon}</svg>
          </button>
        </div>
      </article>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "indra-news-timeline-item": NewsTimelineItemElement;
  }
}
