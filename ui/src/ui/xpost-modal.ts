import { LitElement, css, html, svg } from "lit";
import { customElement, property, state } from "lit/decorators.js";

import {
  wsClient,
  type NewsArticle,
  type XPostProgressEvent,
  type XPostWorkflowResult,
  type GeneratedPost,
} from "../services/ws-client.js";

export interface ContentInput {
  id: string;
  title: string;
  url: string;
  content: string;
  summary?: string;
}

const closeIcon = svg`<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>`;
const checkIcon = svg`<polyline points="20 6 9 17 4 12"/>`;

@customElement("indra-xpost-modal")
export class XPostModalElement extends LitElement {
  static styles = css`
    :host {
      display: block;
      font-family: var(--font-family, "Geist Mono", monospace);
    }

    .overlay {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
    }

    .modal {
      background: white;
      border-radius: 16px;
      width: 90%;
      max-width: 600px;
      max-height: 80vh;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
    }

    .modal-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 20px 24px;
      border-bottom: 1px solid var(--border, #e0e0e0);
    }

    .modal-title {
      font-size: 18px;
      font-weight: 600;
      color: var(--text-primary, #2d3436);
    }

    .close-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      border: none;
      background: transparent;
      border-radius: 8px;
      cursor: pointer;
      color: var(--text-secondary, #636e72);
      transition: background 0.2s;
    }

    .close-btn:hover {
      background: var(--bg-tertiary, #f5f5f5);
    }

    .close-btn svg {
      width: 18px;
      height: 18px;
      stroke: currentColor;
      stroke-width: 2;
      stroke-linecap: round;
      stroke-linejoin: round;
      fill: none;
    }

    .modal-body {
      padding: 24px;
      overflow-y: auto;
      flex: 1;
    }

    .article-info {
      background: var(--bg-secondary, #f8f9fa);
      border-radius: 8px;
      padding: 12px 16px;
      margin-bottom: 20px;
    }

    .article-title {
      font-size: 14px;
      font-weight: 500;
      color: var(--text-primary, #2d3436);
    }

    .progress-section {
      margin-bottom: 24px;
    }

    .progress-label {
      display: flex;
      justify-content: space-between;
      margin-bottom: 8px;
      font-size: 13px;
      color: var(--text-secondary, #636e72);
    }

    .progress-bar {
      height: 8px;
      background: var(--bg-tertiary, #f5f5f5);
      border-radius: 4px;
      overflow: hidden;
    }

    .progress-fill {
      height: 100%;
      background: var(--primary, #2e7d32);
      border-radius: 4px;
      transition: width 0.3s ease;
    }

    .status-message {
      margin-top: 8px;
      font-size: 13px;
      color: var(--text-secondary, #636e72);
    }

    .result-section {
      margin-top: 20px;
    }

    .result-header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 16px;
    }

    .result-title {
      font-size: 14px;
      font-weight: 600;
      color: var(--text-primary, #2d3436);
    }

    .score-badge {
      display: inline-flex;
      align-items: center;
      padding: 4px 10px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 600;
    }

    .score-badge.high {
      background: rgba(46, 125, 50, 0.1);
      color: #2e7d32;
    }

    .score-badge.medium {
      background: rgba(255, 152, 0, 0.1);
      color: #f57c00;
    }

    .score-badge.low {
      background: rgba(211, 47, 47, 0.1);
      color: #d32f2f;
    }

    .post-preview {
      background: var(--bg-secondary, #f8f9fa);
      border-radius: 12px;
      padding: 16px;
      margin-bottom: 16px;
    }

    .post-text {
      font-size: 15px;
      line-height: 1.6;
      color: var(--text-primary, #2d3436);
      white-space: pre-wrap;
    }

    .post-meta {
      display: flex;
      gap: 16px;
      margin-top: 12px;
      font-size: 12px;
      color: var(--text-secondary, #636e72);
    }

    .evaluation-details {
      margin-top: 16px;
      padding: 16px;
      background: white;
      border: 1px solid var(--border, #e0e0e0);
      border-radius: 8px;
    }

    .evaluation-title {
      font-size: 13px;
      font-weight: 600;
      color: var(--text-primary, #2d3436);
      margin-bottom: 12px;
    }

    .evaluation-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 8px;
    }

    .evaluation-item {
      display: flex;
      justify-content: space-between;
      font-size: 12px;
    }

    .evaluation-label {
      color: var(--text-secondary, #636e72);
    }

    .evaluation-value {
      font-weight: 500;
      color: var(--text-primary, #2d3436);
    }

    .feedback {
      margin-top: 12px;
      padding-top: 12px;
      border-top: 1px solid var(--border, #e0e0e0);
      font-size: 12px;
      color: var(--text-secondary, #636e72);
      line-height: 1.5;
    }

    .modal-footer {
      display: flex;
      justify-content: flex-end;
      gap: 12px;
      padding: 16px 24px;
      border-top: 1px solid var(--border, #e0e0e0);
    }

    .btn {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 10px 20px;
      border-radius: 8px;
      font-family: inherit;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: background 0.2s;
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

    .btn-secondary {
      border: 1px solid var(--border, #e0e0e0);
      background: white;
      color: var(--text-primary, #2d3436);
    }

    .btn-secondary:hover {
      background: var(--bg-tertiary, #f5f5f5);
    }

    .btn-primary {
      border: none;
      background: var(--primary, #2e7d32);
      color: white;
    }

    .btn-primary:hover {
      background: #256025;
    }

    .btn-primary:disabled {
      background: #ccc;
      cursor: not-allowed;
    }

    .error-state {
      text-align: center;
      padding: 24px;
      color: #d32f2f;
    }

    .error-icon {
      font-size: 48px;
      margin-bottom: 16px;
    }

    .error-message {
      font-size: 14px;
    }

    .spinner {
      width: 20px;
      height: 20px;
      border: 2px solid var(--bg-tertiary, #f5f5f5);
      border-top-color: var(--primary, #2e7d32);
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    @keyframes spin {
      to {
        transform: rotate(360deg);
      }
    }

    .progress-indicator {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 12px;
    }

    .all-posts-section {
      margin-top: 24px;
    }

    .all-posts-title {
      font-size: 13px;
      font-weight: 600;
      color: var(--text-secondary, #636e72);
      margin-bottom: 12px;
    }

    .post-option {
      padding: 12px;
      border: 1px solid var(--border, #e0e0e0);
      border-radius: 8px;
      margin-bottom: 8px;
      cursor: pointer;
      transition: border-color 0.2s;
    }

    .post-option:hover {
      border-color: var(--primary, #2e7d32);
    }

    .post-option.selected {
      border-color: var(--primary, #2e7d32);
      background: rgba(46, 125, 50, 0.05);
    }

    .post-option-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
    }

    .post-option-text {
      font-size: 13px;
      color: var(--text-primary, #2d3436);
      line-height: 1.5;
    }
  `;

  @property({ type: Object })
  article: NewsArticle | null = null;

  @property({ type: Object })
  contentInput: ContentInput | null = null;

  @state()
  private progress = 0;

  @state()
  private stage: string = "started";

  @state()
  private message = "ワークフロー開始中...";

  @state()
  private result: XPostWorkflowResult | null = null;

  @state()
  private selectedPostId: string | null = null;

  @state()
  private isLoading = true;

  @state()
  private approving = false;

  private boundHandleProgress = this.handleProgress.bind(this);
  private boundHandleCompleted = this.handleCompleted.bind(this);
  private boundHandleFailed = this.handleFailed.bind(this);

  connectedCallback(): void {
    super.connectedCallback();
    wsClient.addEventListener("xpost.progress", this.boundHandleProgress);
    wsClient.addEventListener("xpost.completed", this.boundHandleCompleted);
    wsClient.addEventListener("xpost.failed", this.boundHandleFailed);

    // Start the workflow
    this.startWorkflow();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    wsClient.removeEventListener("xpost.progress", this.boundHandleProgress);
    wsClient.removeEventListener("xpost.completed", this.boundHandleCompleted);
    wsClient.removeEventListener("xpost.failed", this.boundHandleFailed);
  }

  private get sourceId(): string {
    return this.contentInput?.id ?? this.article?.id ?? "";
  }

  private get sourceTitle(): string {
    return this.contentInput?.title ?? this.article?.title ?? "";
  }

  private async startWorkflow(): Promise<void> {
    try {
      if (this.contentInput) {
        await wsClient.xpostGenerateFromContent(this.contentInput);
      } else if (this.article) {
        await wsClient.xpostGenerate({ articleId: this.article.id });
      }
    } catch (error) {
      this.result = {
        success: false,
        articleId: this.sourceId,
        error: error instanceof Error ? error.message : "Unknown error",
        processingTime: 0,
      };
      this.isLoading = false;
    }
  }

  private handleProgress(e: Event): void {
    const event = e as CustomEvent<XPostProgressEvent>;
    if (event.detail?.articleId === this.sourceId) {
      this.progress = event.detail.progress;
      this.stage = event.detail.stage;
      this.message = event.detail.message;
    }
  }

  private handleCompleted(e: Event): void {
    const event = e as CustomEvent<XPostWorkflowResult>;
    // runId でマッチするか、articleId でマッチする場合に処理
    const detail = event.detail;
    if (detail?.articleId === this.sourceId || detail?.runId) {
      this.result = event.detail;
      this.isLoading = false;
      if (this.result.bestPost) {
        this.selectedPostId = this.result.bestPost.id;
      }
    }
  }

  private handleFailed(e: Event): void {
    const event = e as CustomEvent<{
      articleId?: string;
      id?: string;
      error: string;
    }>;
    const failedId = event.detail?.articleId ?? event.detail?.id;
    if (failedId === this.sourceId) {
      this.result = {
        success: false,
        articleId: this.sourceId,
        error: event.detail.error,
        processingTime: 0,
      };
      this.isLoading = false;
    }
  }

  private handleClose(): void {
    this.dispatchEvent(
      new CustomEvent("close", { bubbles: true, composed: true }),
    );
  }

  private handleSelectPost(postId: string): void {
    this.selectedPostId = postId;
  }

  private async handleApprove(): Promise<void> {
    if (!this.selectedPostId || !this.result?.allPosts) return;

    const selectedPost = this.result.allPosts.find(
      (p) => p.id === this.selectedPostId,
    );
    if (!selectedPost) return;

    this.approving = true;

    try {
      // Add post directly to approval queue (without LLM regeneration)
      await wsClient.postAdd(
        "x",
        { text: selectedPost.text },
        {
          evaluation: selectedPost.evaluation,
          templateUsed: selectedPost.templateUsed,
        },
      );
      this.dispatchEvent(
        new CustomEvent("approved", {
          detail: { post: selectedPost },
          bubbles: true,
          composed: true,
        }),
      );
      this.handleClose();
    } catch (error) {
      console.error("Failed to add to approval queue:", error);
      this.approving = false;
    }
  }

  private getScoreClass(score: number | undefined): "high" | "medium" | "low" {
    if (score === undefined || (score >= 50 && score < 70)) {
      return "medium";
    }
    if (score >= 70) {
      return "high";
    }
    return "low";
  }

  private getSelectedPost(): GeneratedPost | undefined {
    if (!this.selectedPostId || !this.result?.allPosts) return undefined;
    return this.result.allPosts.find((p) => p.id === this.selectedPostId);
  }

  private renderProgress(): ReturnType<typeof html> {
    return html`
      <div class="progress-section">
        <div class="progress-indicator">
          <div class="spinner"></div>
          <span>${this.message}</span>
        </div>
      </div>
    `;
  }

  private renderError(): ReturnType<typeof html> {
    return html`
      <div class="error-state">
        <div class="error-icon">!</div>
        <div class="error-message">${this.result?.error}</div>
      </div>
    `;
  }

  private renderBodyContent(): ReturnType<typeof html> {
    if (this.isLoading) {
      return this.renderProgress();
    }
    if (this.result?.success) {
      return this.renderResult();
    }
    return this.renderError();
  }

  private renderResult(): ReturnType<typeof html> {
    if (!this.result?.bestPost) return html``;

    const selectedPost = this.getSelectedPost() || this.result.bestPost;
    const evaluation = selectedPost.evaluation;

    return html`
      <div class="result-section">
        <div class="result-header">
          <span class="result-title">生成された投稿</span>
          <span class="score-badge ${this.getScoreClass(selectedPost.score)}">
            スコア: ${selectedPost.score ?? "N/A"}点
          </span>
        </div>

        <div class="post-preview">
          <div class="post-text">${selectedPost.text}</div>
          <div class="post-meta">
            <span>${selectedPost.charCount}文字</span>
            <span>テンプレート: ${selectedPost.templateUsed}</span>
          </div>
        </div>

        ${evaluation
          ? html`
              <div class="evaluation-details">
                <div class="evaluation-title">評価詳細</div>
                <div class="evaluation-grid">
                  <div class="evaluation-item">
                    <span class="evaluation-label">リプライ可能性</span>
                    <span class="evaluation-value"
                      >${evaluation.replyPotential}点</span
                    >
                  </div>
                  <div class="evaluation-item">
                    <span class="evaluation-label">エンゲージメント</span>
                    <span class="evaluation-value"
                      >${evaluation.engagementPotential}点</span
                    >
                  </div>
                  <div class="evaluation-item">
                    <span class="evaluation-label">滞在時間</span>
                    <span class="evaluation-value"
                      >${evaluation.dwellTimePotential}点</span
                    >
                  </div>
                  <div class="evaluation-item">
                    <span class="evaluation-label">コンテンツ品質</span>
                    <span class="evaluation-value"
                      >${evaluation.contentQuality}点</span
                    >
                  </div>
                </div>
                ${evaluation.feedback
                  ? html`<div class="feedback">${evaluation.feedback}</div>`
                  : null}
              </div>
            `
          : null}
        ${this.result.allPosts && this.result.allPosts.length > 1
          ? html`
              <div class="all-posts-section">
                <div class="all-posts-title">
                  他の候補 (${this.result.allPosts.length}件)
                </div>
                ${this.result.allPosts.map(
                  (post) => html`
                    <div
                      class="post-option ${post.id === this.selectedPostId
                        ? "selected"
                        : ""}"
                      @click="${() => this.handleSelectPost(post.id)}"
                    >
                      <div class="post-option-header">
                        <span
                          class="score-badge ${this.getScoreClass(post.score)}"
                        >
                          ${post.score ?? "N/A"}点
                        </span>
                        <span style="font-size: 12px; color: #636e72;">
                          ${post.templateUsed}
                        </span>
                      </div>
                      <div class="post-option-text">${post.text}</div>
                    </div>
                  `,
                )}
              </div>
            `
          : null}
      </div>
    `;
  }

  render() {
    return html`
      <div class="overlay" @click="${this.handleClose}">
        <div class="modal" @click="${(e: Event) => e.stopPropagation()}">
          <div class="modal-header">
            <span class="modal-title">X投稿を生成</span>
            <button class="close-btn" @click="${this.handleClose}">
              <svg viewBox="0 0 24 24">${closeIcon}</svg>
            </button>
          </div>

          <div class="modal-body">
            <div class="article-info">
              <div class="article-title">${this.sourceTitle}</div>
            </div>

            ${this.renderBodyContent()}
          </div>

          <div class="modal-footer">
            <button class="btn btn-secondary" @click="${this.handleClose}">
              キャンセル
            </button>
            ${this.result?.success
              ? html`
                  <button
                    class="btn btn-primary"
                    @click="${this.handleApprove}"
                    ?disabled="${this.approving || !this.selectedPostId}"
                  >
                    <svg viewBox="0 0 24 24">${checkIcon}</svg>
                    ${this.approving ? "追加中..." : "承認キューに追加"}
                  </button>
                `
              : null}
          </div>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "indra-xpost-modal": XPostModalElement;
  }
}
