import { LitElement, css, html, svg } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { DevlogEntry, CommitInfo } from "./types.js";

const gitCommitIcon = svg`<circle cx="12" cy="12" r="3"/><line x1="3" y1="12" x2="9" y2="12"/><line x1="15" y1="12" x2="21" y2="12"/>`;
const chevronDownIcon = svg`<polyline points="6 9 12 15 18 9"/>`;
const chevronUpIcon = svg`<polyline points="18 15 12 9 6 15"/>`;

@customElement("indra-devlog-timeline-item")
export class DevlogTimelineItemElement extends LitElement {
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

    .date-badge {
      display: inline-flex;
      align-items: center;
      padding: 4px 10px;
      border-radius: 12px;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      white-space: nowrap;
      background: rgba(46, 125, 50, 0.1);
      color: #2e7d32;
    }

    .commit-count {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 2px 8px;
      border-radius: 8px;
      font-size: 10px;
      font-weight: 500;
      background: rgba(0, 0, 0, 0.05);
      color: var(--text-secondary, #636e72);
    }

    .commit-count svg {
      width: 12px;
      height: 12px;
      stroke: currentColor;
      stroke-width: 2;
      stroke-linecap: round;
      stroke-linejoin: round;
      fill: none;
    }

    .title {
      font-size: 14px;
      font-weight: 500;
      color: var(--text-primary, #2d3436);
      line-height: 1.4;
    }

    .stats {
      display: flex;
      gap: 16px;
      font-size: 12px;
      color: var(--text-secondary, #636e72);
    }

    .stat {
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .stat.insertions {
      color: #2e7d32;
    }

    .stat.deletions {
      color: #d32f2f;
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

    .commits-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .commit-item {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 8px 12px;
      background: var(--bg-tertiary, #f5f5f5);
      border-radius: 8px;
    }

    .commit-icon {
      width: 20px;
      height: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      margin-top: 2px;
    }

    .commit-icon svg {
      width: 14px;
      height: 14px;
      stroke: currentColor;
      stroke-width: 2;
      stroke-linecap: round;
      stroke-linejoin: round;
      fill: none;
    }

    .commit-details {
      flex: 1;
      min-width: 0;
    }

    .commit-message {
      font-size: 13px;
      color: var(--text-primary, #2d3436);
      line-height: 1.4;
      word-break: break-word;
    }

    .commit-meta {
      display: flex;
      gap: 12px;
      margin-top: 4px;
      font-size: 11px;
      color: var(--text-secondary, #636e72);
    }

    .commit-type {
      display: inline-flex;
      align-items: center;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 10px;
      font-weight: 600;
      text-transform: uppercase;
    }

    .commit-type.feat {
      background: rgba(46, 125, 50, 0.1);
      color: #2e7d32;
    }

    .commit-type.fix {
      background: rgba(211, 47, 47, 0.1);
      color: #d32f2f;
    }

    .commit-type.refactor {
      background: rgba(33, 150, 243, 0.1);
      color: #1976d2;
    }

    .commit-type.docs {
      background: rgba(156, 39, 176, 0.1);
      color: #7b1fa2;
    }

    .commit-type.style {
      background: rgba(255, 152, 0, 0.1);
      color: #f57c00;
    }

    .commit-type.test {
      background: rgba(0, 188, 212, 0.1);
      color: #00838f;
    }

    .commit-type.chore {
      background: rgba(117, 117, 117, 0.1);
      color: #616161;
    }

    .commit-type.perf {
      background: rgba(255, 193, 7, 0.1);
      color: #f9a825;
    }

    .commit-type.build {
      background: rgba(121, 85, 72, 0.1);
      color: #5d4037;
    }

    .commit-type.ci {
      background: rgba(63, 81, 181, 0.1);
      color: #303f9f;
    }

    .commit-hash {
      font-family: "Geist Mono", monospace;
      font-size: 11px;
      color: var(--text-secondary, #636e72);
    }

    .commit-files {
      margin-top: 6px;
      font-size: 11px;
      color: var(--text-secondary, #636e72);
    }
  `;

  @property({ type: Object })
  devlog!: DevlogEntry;

  @property({ type: Boolean })
  expanded = false;

  @state()
  private showFiles: Set<string> = new Set();

  private handleClick(): void {
    this.dispatchEvent(
      new CustomEvent("toggle", {
        detail: { id: this.devlog.id },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private toggleFiles(hash: string, e: Event): void {
    e.stopPropagation();
    const newSet = new Set(this.showFiles);
    if (newSet.has(hash)) {
      newSet.delete(hash);
    } else {
      newSet.add(hash);
    }
    this.showFiles = newSet;
  }

  private getCommitTypeClass(type: string): string {
    const validTypes = new Set([
      "feat",
      "fix",
      "refactor",
      "docs",
      "style",
      "test",
      "chore",
      "perf",
      "build",
      "ci",
    ]);
    const normalized = type.toLowerCase();
    return validTypes.has(normalized) ? normalized : "chore";
  }

  private renderCommit(commit: CommitInfo): ReturnType<typeof html> {
    const typeClass = this.getCommitTypeClass(commit.type);

    return html`
      <div class="commit-item">
        <div class="commit-icon">
          <svg viewBox="0 0 24 24">${gitCommitIcon}</svg>
        </div>
        <div class="commit-details">
          <div class="commit-message">
            <span class="commit-type ${typeClass}">${commit.type}</span>
            ${commit.scope ? html`(${commit.scope})` : null} ${commit.message}
          </div>
          <div class="commit-meta">
            <span class="commit-hash">${commit.hash.slice(0, 7)}</span>
            <span>${commit.author}</span>
            <span
              >${new Date(commit.timestamp).toLocaleTimeString("ja-JP")}</span
            >
            ${commit.files.length > 0
              ? html`
                  <span
                    style="cursor: pointer; text-decoration: underline;"
                    @click="${(e: Event) => this.toggleFiles(commit.hash, e)}"
                  >
                    ${commit.files.length} files
                  </span>
                `
              : null}
          </div>
          ${this.showFiles.has(commit.hash) && commit.files.length > 0
            ? html`
                <div class="commit-files">
                  ${commit.files.map((file) => html`<div>${file}</div>`)}
                </div>
              `
            : null}
        </div>
      </div>
    `;
  }

  render() {
    const { devlog } = this;

    return html`
      <article
        class="item ${this.expanded ? "expanded" : ""}"
        @click="${this.handleClick}"
      >
        <div class="header">
          <div class="header-left">
            <div class="title-row">
              <span class="date-badge">${devlog.date}</span>
              <span class="commit-count">
                <svg viewBox="0 0 24 24">${gitCommitIcon}</svg>
                ${devlog.stats.totalCommits} commits
              </span>
            </div>
            <div class="stats">
              <span class="stat">${devlog.stats.filesChanged} files</span>
              <span class="stat insertions">+${devlog.stats.insertions}</span>
              <span class="stat deletions">-${devlog.stats.deletions}</span>
            </div>
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
                <div class="commits-list">
                  ${devlog.commits.map((commit) => this.renderCommit(commit))}
                </div>
              </div>
            `
          : null}
      </article>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "indra-devlog-timeline-item": DevlogTimelineItemElement;
  }
}
