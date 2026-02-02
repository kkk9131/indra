import { LitElement, css, html, svg } from "lit";
import { customElement, state } from "lit/decorators.js";
import { unsafeHTML } from "lit/directives/unsafe-html.js";
import { marked } from "marked";
import DOMPurify from "dompurify";

import {
  wsClient,
  type ReportSummary,
  type ReportDetail,
} from "../services/ws-client.js";
import "./xpost-modal.js";
import type { ContentInput } from "./xpost-modal.js";

const refreshIcon = svg`<path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 16h5v5"/>`;
const backIcon = svg`<path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>`;
const fileIcon = svg`<path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/>`;
const xIcon = svg`<path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>`;

@customElement("indra-report-page")
export class ReportPageElement extends LitElement {
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

    .header-actions {
      display: flex;
      gap: 8px;
    }

    .btn {
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

    .btn:hover:not(:disabled) {
      background: var(--bg-tertiary, #f5f5f5);
    }

    .btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .btn svg {
      width: 16px;
      height: 16px;
      stroke: currentColor;
      stroke-width: 2;
      stroke-linecap: round;
      stroke-linejoin: round;
      fill: none;
    }

    .btn.loading svg {
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

    .report-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .report-item {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 16px;
      background: white;
      border-radius: 12px;
      cursor: pointer;
      transition:
        box-shadow 0.2s,
        transform 0.1s;
    }

    .report-item:hover {
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
      transform: translateY(-1px);
    }

    .report-icon {
      width: 40px;
      height: 40px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--bg-tertiary, #f5f5f5);
      border-radius: 8px;
    }

    .report-icon svg {
      width: 20px;
      height: 20px;
      stroke: var(--primary, #2e7d32);
      stroke-width: 2;
      stroke-linecap: round;
      stroke-linejoin: round;
      fill: none;
    }

    .report-info {
      flex: 1;
    }

    .report-topic {
      font-weight: 500;
      margin-bottom: 4px;
    }

    .report-meta {
      font-size: 12px;
      color: var(--text-secondary, #636e72);
    }

    .report-size {
      font-size: 12px;
      color: var(--text-secondary, #636e72);
      text-align: right;
    }

    .empty-state {
      text-align: center;
      padding: 60px 24px;
      background: white;
      border-radius: 12px;
      color: var(--text-secondary, #636e72);
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

    /* Report Detail View */
    .report-detail {
      background: white;
      border-radius: 12px;
      padding: 32px;
    }

    .report-header {
      margin-bottom: 24px;
      padding-bottom: 16px;
      border-bottom: 1px solid var(--border, #e0e0e0);
    }

    .report-title {
      font-size: 24px;
      font-weight: 600;
      margin-bottom: 8px;
    }

    .report-detail-meta {
      font-size: 14px;
      color: var(--text-secondary, #636e72);
    }

    .report-content {
      line-height: 1.8;
      font-family: "Inter", system-ui, sans-serif;
    }

    .report-content h1 {
      font-size: 28px;
      font-weight: 600;
      margin: 32px 0 16px;
      border-bottom: 2px solid var(--primary, #2e7d32);
      padding-bottom: 8px;
    }

    .report-content h2 {
      font-size: 22px;
      font-weight: 600;
      margin: 28px 0 14px;
      color: var(--primary, #2e7d32);
    }

    .report-content h3 {
      font-size: 18px;
      font-weight: 600;
      margin: 24px 0 12px;
    }

    .report-content p {
      margin: 12px 0;
    }

    .report-content ul,
    .report-content ol {
      margin: 12px 0;
      padding-left: 24px;
    }

    .report-content li {
      margin: 8px 0;
    }

    .report-content code {
      background: var(--bg-tertiary, #f5f5f5);
      padding: 2px 6px;
      border-radius: 4px;
      font-family: var(--font-family, "Geist Mono", monospace);
      font-size: 0.9em;
    }

    .report-content pre {
      background: var(--bg-tertiary, #f5f5f5);
      padding: 16px;
      border-radius: 8px;
      overflow-x: auto;
    }

    .report-content pre code {
      background: transparent;
      padding: 0;
    }

    .report-content blockquote {
      border-left: 4px solid var(--primary, #2e7d32);
      margin: 16px 0;
      padding: 8px 16px;
      background: var(--bg-tertiary, #f5f5f5);
      border-radius: 0 8px 8px 0;
    }

    .report-content a {
      color: var(--primary, #2e7d32);
      text-decoration: none;
    }

    .report-content a:hover {
      text-decoration: underline;
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

    .report-content table {
      width: 100%;
      border-collapse: collapse;
      margin: 16px 0;
    }

    .report-content th,
    .report-content td {
      border: 1px solid var(--border, #e0e0e0);
      padding: 12px;
      text-align: left;
    }

    .report-content th {
      background: var(--bg-tertiary, #f5f5f5);
      font-weight: 600;
    }
  `;

  @state()
  private reports: ReportSummary[] = [];

  @state()
  private selectedReport: ReportDetail | null = null;

  @state()
  private loading = true;

  @state()
  private refreshing = false;

  @state()
  private error: string | null = null;

  @state()
  private xpostContent: ContentInput | null = null;

  private boundHandleConnected = this.handleConnected.bind(this);

  connectedCallback(): void {
    super.connectedCallback();
    wsClient.addEventListener("connected", this.boundHandleConnected);

    if (wsClient.isConnected) {
      this.loadReports();
    }
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    wsClient.removeEventListener("connected", this.boundHandleConnected);
  }

  private handleConnected(): void {
    this.loadReports();
  }

  private getErrorMessage(err: unknown, fallback: string): string {
    return err instanceof Error ? err.message : fallback;
  }

  private async loadReports(): Promise<void> {
    this.loading = true;
    this.error = null;

    try {
      this.reports = await wsClient.reportsList();
    } catch (err) {
      this.error = this.getErrorMessage(err, "Failed to load reports");
    } finally {
      this.loading = false;
    }
  }

  private async handleRefresh(): Promise<void> {
    if (this.refreshing) return;

    this.refreshing = true;
    this.error = null;

    try {
      this.reports = await wsClient.reportsList();
    } catch (err) {
      this.error = this.getErrorMessage(err, "Failed to refresh reports");
    } finally {
      this.refreshing = false;
    }
  }

  private async handleSelectReport(report: ReportSummary): Promise<void> {
    this.loading = true;
    this.error = null;

    try {
      this.selectedReport = await wsClient.reportsGet(report.id);
    } catch (err) {
      this.error = this.getErrorMessage(err, "Failed to load report");
    } finally {
      this.loading = false;
    }
  }

  private handleBack(): void {
    this.selectedReport = null;
  }

  private handleOpenXpostModal(): void {
    if (!this.selectedReport) return;

    this.xpostContent = {
      id: `report_${this.selectedReport.id}`,
      title: this.selectedReport.topic,
      url: "",
      content: this.selectedReport.content,
      summary: this.selectedReport.content.slice(0, 500),
    };
  }

  private handleCloseXpostModal(): void {
    this.xpostContent = null;
  }

  private formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  private renderMarkdown(content: string): ReturnType<typeof html> {
    const rawHtml = marked(content) as string;
    const sanitizedHtml = DOMPurify.sanitize(rawHtml);
    return html`${unsafeHTML(sanitizedHtml)}`;
  }

  private renderList(): ReturnType<typeof html> {
    if (this.error) {
      return html`<div class="error-state">${this.error}</div>`;
    }

    if (this.loading) {
      return html`<div class="loading-state">Loading reports...</div>`;
    }

    if (this.reports.length === 0) {
      return html`
        <div class="empty-state">
          <div>No reports found.</div>
          <div style="margin-top: 8px; font-size: 14px;">
            Research reports will appear here after running the research-report
            task.
          </div>
        </div>
      `;
    }

    return html`
      <div class="report-list">
        ${this.reports.map(
          (report) => html`
            <div
              class="report-item"
              @click="${() => this.handleSelectReport(report)}"
            >
              <div class="report-icon">
                <svg viewBox="0 0 24 24">${fileIcon}</svg>
              </div>
              <div class="report-info">
                <div class="report-topic">${report.topic}</div>
                <div class="report-meta">${report.date}</div>
              </div>
              <div class="report-size">${this.formatSize(report.size)}</div>
            </div>
          `,
        )}
      </div>
    `;
  }

  private renderDetail(): ReturnType<typeof html> {
    if (!this.selectedReport) {
      return html``;
    }

    if (this.loading) {
      return html`<div class="loading-state">Loading report...</div>`;
    }

    return html`
      <div class="report-detail">
        <div class="report-header">
          <div class="report-title">${this.selectedReport.topic}</div>
          <div class="report-detail-meta">
            ${this.selectedReport.date} |
            ${this.formatSize(this.selectedReport.size)}
          </div>
        </div>
        <div class="report-content">
          ${this.renderMarkdown(this.selectedReport.content)}
        </div>
      </div>
    `;
  }

  render() {
    const isDetailView = this.selectedReport !== null;

    return html`
      <div class="page-header">
        <span class="page-title">Reports</span>
        <div class="header-actions">
          ${isDetailView
            ? html`
                <button class="btn" @click="${this.handleBack}">
                  <svg viewBox="0 0 24 24">${backIcon}</svg>
                  Back
                </button>
                <button
                  class="post-x-btn"
                  @click="${this.handleOpenXpostModal}"
                  title="Generate X Post"
                >
                  <svg viewBox="0 0 24 24">${xIcon}</svg>
                </button>
              `
            : html`
                <button
                  class="btn ${this.refreshing ? "loading" : ""}"
                  @click="${this.handleRefresh}"
                  ?disabled="${this.refreshing}"
                >
                  <svg viewBox="0 0 24 24">${refreshIcon}</svg>
                  ${this.refreshing ? "Refreshing..." : "Refresh"}
                </button>
              `}
        </div>
      </div>

      ${isDetailView ? this.renderDetail() : this.renderList()}
      ${this.xpostContent
        ? html`
            <indra-xpost-modal
              .contentInput="${this.xpostContent}"
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
    "indra-report-page": ReportPageElement;
  }
}
