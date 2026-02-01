/**
 * Browser WebSocket Client Service
 * Provides connection management and method wrappers for UI components.
 */

export type { LogEntry } from "../ui/types.js";
import type { LogEntry } from "../ui/types.js";
import { buildWsUrl } from "./ws-url.js";

export interface ApprovalItem {
  id: string;
  platform: string;
  content: { text: string };
  status: "pending" | "approved" | "rejected" | "posted" | "scheduled";
  createdAt: string;
  updatedAt: string;
  prompt?: string;
  postId?: string;
  postUrl?: string;
  error?: string;
  scheduledAt?: string;
}

export interface WSClientOptions {
  url?: string;
  reconnect?: boolean;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  timeout?: number;
}

interface ResponseFrame {
  type: "res";
  id: string;
  ok: boolean;
  payload?: unknown;
  error?: { code: string; message: string };
}

interface EventFrame {
  type: "event";
  event: string;
  payload?: unknown;
}

type EventHandler = (payload: unknown, frame: EventFrame) => void;

export interface NewsArticle {
  id: string;
  source:
    | "claude-code"
    | "blog"
    | "log-analysis"
    | "x-account"
    | "github-changelog"
    | "indra-log"
    | "news-report";
  title: string;
  summary: string | null;
  url: string;
  publishedAt: string | null;
  fetchedAt: string;
  contentHash?: string;
  body?: string | null;
  imageUrl?: string | null;
}

export type WSClientEvent =
  | "connected"
  | "disconnected"
  | "post.created"
  | "post.updated"
  | "news.updated"
  | "xpost.progress"
  | "xpost.completed"
  | "xpost.failed"
  | "chat.cancelled";

// Image attachment type for chat
export interface ChatImage {
  data: string; // Base64 encoded
  mediaType: "image/png" | "image/jpeg" | "image/gif" | "image/webp";
}

// XPost Types
export type XPostWorkflowStage =
  | "started"
  | "content_fetching"
  | "template_selecting"
  | "composing"
  | "evaluating"
  | "refining"
  | "completed"
  | "failed";

export interface PostEvaluation {
  overallScore: number;
  replyPotential: number;
  engagementPotential: number;
  dwellTimePotential: number;
  contentQuality: number;
  feedback: string;
}

export interface XPostProgressEvent {
  articleId: string;
  stage: XPostWorkflowStage;
  message: string;
  progress: number;
}

export interface GeneratedPost {
  id: string;
  text: string;
  charCount: number;
  score?: number;
  templateUsed: string;
  evaluation?: PostEvaluation;
}

export interface XPostWorkflowResult {
  success: boolean;
  articleId: string;
  bestPost?: GeneratedPost;
  allPosts?: GeneratedPost[];
  error?: string;
  processingTime: number;
}

export class WSClientService extends EventTarget {
  private ws?: WebSocket;
  private _isConnected = false;
  private manualDisconnect = false;
  private reconnectAttempts = 0;
  private reconnectTimer?: ReturnType<typeof setTimeout>;
  private options: Required<WSClientOptions>;

  private pendingRequests = new Map<
    string,
    {
      resolve: (value: ResponseFrame) => void;
      reject: (reason?: unknown) => void;
      timer: ReturnType<typeof setTimeout>;
    }
  >();

  private eventListeners = new Map<string, Set<EventHandler>>();

  constructor(options: WSClientOptions = {}) {
    super();
    this.options = {
      url: options.url ?? buildWsUrl(),
      reconnect: options.reconnect ?? true,
      reconnectInterval: options.reconnectInterval ?? 1000,
      maxReconnectAttempts: options.maxReconnectAttempts ?? 5,
      timeout: options.timeout ?? 30000,
    };
  }

  get isConnected(): boolean {
    return this._isConnected;
  }

  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      return;
    }

    this.ws = new WebSocket(this.options.url);

    this.ws.onopen = () => {
      this._isConnected = true;
      this.reconnectAttempts = 0;
      this.manualDisconnect = false;
      this.dispatchEvent(new CustomEvent("connected"));
    };

    this.ws.onmessage = (event: MessageEvent) => {
      this.handleMessage(event.data);
    };

    this.ws.onclose = () => {
      this._isConnected = false;

      // Reject all pending requests
      this.pendingRequests.forEach((req) => {
        clearTimeout(req.timer);
        req.reject(new Error("Connection closed"));
      });
      this.pendingRequests.clear();

      this.dispatchEvent(new CustomEvent("disconnected"));

      if (!this.manualDisconnect && this.options.reconnect) {
        this.scheduleReconnect();
      }
    };

    this.ws.onerror = () => {
      // Error handling is done in onclose
    };
  }

  disconnect(): void {
    this.manualDisconnect = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = undefined;
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.options.maxReconnectAttempts) {
      return;
    }

    const delay = Math.min(
      this.options.reconnectInterval * Math.pow(2, this.reconnectAttempts),
      30000,
    );

    this.reconnectTimer = setTimeout(() => {
      this.reconnectAttempts++;
      this.connect();
    }, delay);
  }

  private handleMessage(data: string): void {
    try {
      const frame = JSON.parse(data);

      if (frame.type === "res") {
        const resFrame = frame as ResponseFrame;
        const pending = this.pendingRequests.get(resFrame.id);
        if (pending) {
          clearTimeout(pending.timer);
          this.pendingRequests.delete(resFrame.id);
          pending.resolve(resFrame);
        }
      } else if (frame.type === "event") {
        const eventFrame = frame as EventFrame;
        const listeners = this.eventListeners.get(eventFrame.event);
        if (listeners) {
          [...listeners].forEach((handler) => {
            try {
              handler(eventFrame.payload, eventFrame);
            } catch {
              // Error in event handler
            }
          });
        }

        // Also dispatch as DOM event for component listeners
        this.dispatchEvent(
          new CustomEvent(eventFrame.event, { detail: eventFrame.payload }),
        );
      }
    } catch {
      // Failed to parse message
    }
  }

  private generateId(): string {
    return crypto.randomUUID();
  }

  private sendRequest(
    method: string,
    params?: unknown,
  ): Promise<ResponseFrame> {
    return new Promise((resolve, reject) => {
      if (!this._isConnected || !this.ws) {
        reject(new Error("WebSocket is not connected"));
        return;
      }

      const id = this.generateId();
      const timer = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`Request timeout: ${method}`));
      }, this.options.timeout);

      this.pendingRequests.set(id, { resolve, reject, timer });

      this.ws.send(
        JSON.stringify({
          type: "req",
          id,
          method,
          params,
        }),
      );
    });
  }

  /**
   * Subscribe to server events
   */
  on(event: string, handler: EventHandler): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(handler);
  }

  /**
   * Unsubscribe from server events
   */
  off(event: string, handler: EventHandler): void {
    this.eventListeners.get(event)?.delete(handler);
  }

  // ===== Post API Methods =====

  async postCreate(platform: string, prompt: string): Promise<ApprovalItem> {
    const res = await this.sendRequest("post.create", { platform, prompt });
    if (!res.ok) {
      throw new Error(res.error?.message ?? "Failed to create post");
    }
    return (res.payload as { item: ApprovalItem }).item;
  }

  async postList(status?: string): Promise<ApprovalItem[]> {
    const res = await this.sendRequest("post.list", status ? { status } : {});
    if (!res.ok) {
      throw new Error(res.error?.message ?? "Failed to list posts");
    }
    return (res.payload as { items: ApprovalItem[] }).items;
  }

  async postApprove(id: string): Promise<ApprovalItem> {
    const res = await this.sendRequest("post.approve", { id });
    if (!res.ok) {
      throw new Error(res.error?.message ?? "Failed to approve post");
    }
    return (res.payload as { item: ApprovalItem }).item;
  }

  async postReject(id: string): Promise<ApprovalItem> {
    const res = await this.sendRequest("post.reject", { id });
    if (!res.ok) {
      throw new Error(res.error?.message ?? "Failed to reject post");
    }
    return (res.payload as { item: ApprovalItem }).item;
  }

  async postEdit(id: string, content: { text: string }): Promise<ApprovalItem> {
    const res = await this.sendRequest("post.edit", { id, content });
    if (!res.ok) {
      throw new Error(res.error?.message ?? "Failed to edit post");
    }
    return (res.payload as { item: ApprovalItem }).item;
  }

  async postAdd(
    platform: string,
    content: { text: string },
    metadata?: Record<string, unknown>,
  ): Promise<ApprovalItem> {
    const res = await this.sendRequest("post.add", {
      platform,
      content,
      metadata,
    });
    if (!res.ok) {
      throw new Error(res.error?.message ?? "Failed to add post");
    }
    return (res.payload as { item: ApprovalItem }).item;
  }

  async postSchedule(id: string, scheduledAt: string): Promise<ApprovalItem> {
    const res = await this.sendRequest("post.schedule", { id, scheduledAt });
    if (!res.ok) {
      throw new Error(res.error?.message ?? "Failed to schedule post");
    }
    return (res.payload as { item: ApprovalItem }).item;
  }

  // ===== Auth API Methods =====

  async authXStart(): Promise<{ url: string; state: string }> {
    const res = await this.sendRequest("auth.x.start", {});
    if (!res.ok) {
      throw new Error(res.error?.message ?? "Failed to start X auth");
    }
    return res.payload as { url: string; state: string };
  }

  async authXCallback(
    code: string,
    state: string,
  ): Promise<{ success: boolean }> {
    const res = await this.sendRequest("auth.x.callback", { code, state });
    if (!res.ok) {
      throw new Error(res.error?.message ?? "Failed to complete X auth");
    }
    return res.payload as { success: boolean };
  }

  async authXStatus(): Promise<{
    authenticated: boolean;
    username?: string;
  }> {
    const res = await this.sendRequest("auth.x.status", {});
    if (!res.ok) {
      throw new Error(res.error?.message ?? "Failed to get X auth status");
    }
    return res.payload as { authenticated: boolean; username?: string };
  }

  async authXLogout(): Promise<{ success: boolean }> {
    const res = await this.sendRequest("auth.x.logout", {});
    if (!res.ok) {
      throw new Error(res.error?.message ?? "Failed to logout from X");
    }
    return res.payload as { success: boolean };
  }

  async authDiscordStatus(): Promise<{
    connected: boolean;
    configured: boolean;
    botName: string | null;
  }> {
    const res = await this.sendRequest("auth.discord.status", {});
    if (!res.ok) {
      throw new Error(res.error?.message ?? "Failed to get Discord status");
    }
    return res.payload as {
      connected: boolean;
      configured: boolean;
      botName: string | null;
    };
  }

  // ===== News API Methods =====

  async newsList(): Promise<NewsArticle[]> {
    const res = await this.sendRequest("news.list", {});
    if (!res.ok) {
      throw new Error(res.error?.message ?? "Failed to list news");
    }
    return (res.payload as { articles: NewsArticle[] }).articles;
  }

  async newsRefresh(): Promise<{ status: string }> {
    const res = await this.sendRequest("news.refresh", {});
    if (!res.ok) {
      throw new Error(res.error?.message ?? "Failed to refresh news");
    }
    return res.payload as { status: string };
  }

  // ===== Log API Methods =====

  async logsList(): Promise<LogEntry[]> {
    const res = await this.sendRequest("logs.list", {});
    if (!res.ok) {
      throw new Error(res.error?.message ?? "Failed to list logs");
    }
    return (res.payload as { logs: LogEntry[] }).logs;
  }

  async logsRefresh(): Promise<LogEntry[]> {
    const res = await this.sendRequest("logs.refresh", {});
    if (!res.ok) {
      throw new Error(res.error?.message ?? "Failed to refresh logs");
    }
    return (res.payload as { logs: LogEntry[] }).logs;
  }

  // ===== XPost API Methods =====

  async xpostGenerate(params: {
    articleId: string;
    options?: { targetScore?: number; maxRetries?: number };
  }): Promise<{ status: string }> {
    const res = await this.sendRequest("xpost.generate", params);
    if (!res.ok) {
      throw new Error(res.error?.message ?? "Failed to generate X post");
    }
    return res.payload as { status: string };
  }

  // ===== Chat API Methods =====

  async chatSend(params: {
    message: string;
    history?: Array<{ role: string; content: string }>;
    agentMode?: boolean;
    images?: ChatImage[];
  }): Promise<{ requestId: string }> {
    const res = await this.sendRequest("chat.send", params);
    if (!res.ok) {
      throw new Error(res.error?.message ?? "Failed to send chat message");
    }
    return res.payload as { requestId: string };
  }

  async chatCancel(requestId: string): Promise<{ cancelled: boolean }> {
    const res = await this.sendRequest("chat.cancel", { requestId });
    if (!res.ok) {
      throw new Error(res.error?.message ?? "Failed to cancel chat request");
    }
    return res.payload as { cancelled: boolean };
  }

  // ===== Evaluation API Methods =====

  async evalTaskList(params?: {
    type?: string;
    withMetrics?: boolean;
    k?: number;
  }): Promise<EvalTask[]> {
    const res = await this.sendRequest("eval.task.list", params ?? {});
    if (!res.ok) {
      throw new Error(res.error?.message ?? "Failed to list evaluation tasks");
    }
    return (res.payload as { tasks: EvalTask[] }).tasks;
  }

  async evalTaskGet(
    id: string,
    k?: number,
  ): Promise<{
    task: EvalTask;
    metrics: EvalMetrics | null;
    trials: EvalTrial[];
  }> {
    const res = await this.sendRequest("eval.task.get", { id, k });
    if (!res.ok) {
      throw new Error(res.error?.message ?? "Failed to get evaluation task");
    }
    return res.payload as {
      task: EvalTask;
      metrics: EvalMetrics | null;
      trials: EvalTrial[];
    };
  }

  async evalTaskCreate(params: {
    name: string;
    taskType: string;
    input: string;
    successCriteria: string;
    shouldFail?: boolean;
  }): Promise<EvalTask> {
    const res = await this.sendRequest("eval.task.create", params);
    if (!res.ok) {
      throw new Error(res.error?.message ?? "Failed to create evaluation task");
    }
    return (res.payload as { task: EvalTask }).task;
  }

  async evalTaskDelete(id: string): Promise<{ deleted: boolean }> {
    const res = await this.sendRequest("eval.task.delete", { id });
    if (!res.ok) {
      throw new Error(res.error?.message ?? "Failed to delete evaluation task");
    }
    return res.payload as { deleted: boolean };
  }

  async evalRun(params: {
    taskId: string;
    outcome: string;
    executionId?: string;
    sessionId?: string;
    outcomeId?: string;
  }): Promise<{ trial: EvalTrial; graderResult: EvalGraderResult }> {
    const res = await this.sendRequest("eval.run", params);
    if (!res.ok) {
      throw new Error(res.error?.message ?? "Failed to run evaluation");
    }
    return res.payload as { trial: EvalTrial; graderResult: EvalGraderResult };
  }

  async evalMetrics(taskId: string, k?: number): Promise<EvalMetrics> {
    const res = await this.sendRequest("eval.metrics", { taskId, k });
    if (!res.ok) {
      throw new Error(res.error?.message ?? "Failed to get evaluation metrics");
    }
    return (res.payload as { metrics: EvalMetrics }).metrics;
  }

  async evalGraderStatus(): Promise<{ available: boolean }> {
    const res = await this.sendRequest("eval.grader.status", {});
    if (!res.ok) {
      throw new Error(res.error?.message ?? "Failed to get grader status");
    }
    return res.payload as { available: boolean };
  }

  // ===== Reports API Methods =====

  async reportsList(): Promise<ReportSummary[]> {
    const res = await this.sendRequest("reports.list", {});
    if (!res.ok) {
      throw new Error(res.error?.message ?? "Failed to list reports");
    }
    return (res.payload as { reports: ReportSummary[] }).reports;
  }

  async reportsGet(id: string): Promise<ReportDetail> {
    const res = await this.sendRequest("reports.get", { id });
    if (!res.ok) {
      throw new Error(res.error?.message ?? "Failed to get report");
    }
    return (res.payload as { report: ReportDetail }).report;
  }
}

// ===== Evaluation Types =====

export interface EvalTask {
  id: string;
  name: string;
  taskType: string;
  input: string;
  successCriteria: string;
  shouldFail?: boolean;
  createdAt: string;
  updatedAt: string;
  metrics?: EvalMetrics | null;
}

export interface EvalTrial {
  id: string;
  taskId: string;
  trialNumber: number;
  executionId?: string | null;
  sessionId?: string | null;
  outcomeId?: string | null;
  passed: boolean;
  duration?: number | null;
  createdAt: string;
  graderResults?: EvalGraderResult[];
}

export interface EvalGraderResult {
  id: string;
  trialId: string;
  graderType: string;
  graderName: string;
  passed: boolean;
  score: number;
  reason: string;
  details?: Record<string, unknown> | null;
  createdAt: string;
}

export interface EvalMetrics {
  taskId: string;
  totalTrials: number;
  passedTrials: number;
  passAtK: number;
  passK: number;
  k: number;
  averageScore: number;
  averageDuration?: number | null;
  calculatedAt: string;
}

// ===== Reports Types =====

export interface ReportSummary {
  id: string;
  topic: string;
  date: string;
  path: string;
  size: number;
}

export interface ReportDetail extends ReportSummary {
  content: string;
}

// Singleton instance
export const wsClient = new WSClientService();
