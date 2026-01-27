/**
 * Browser WebSocket Client Service
 * Provides connection management and method wrappers for UI components.
 */

export type { LogEntry } from "../ui/types.js";
import type { LogEntry } from "../ui/types.js";

export interface ApprovalItem {
  id: string;
  platform: string;
  content: { text: string };
  status: "pending" | "approved" | "rejected" | "posted";
  createdAt: string;
  updatedAt: string;
  prompt?: string;
  postId?: string;
  postUrl?: string;
  error?: string;
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

/** News article type matching backend schema */
export interface NewsArticle {
  id: string;
  source: "claude-code" | "blog";
  title: string;
  summary: string | null;
  url: string;
  publishedAt: string | null;
  fetchedAt: string;
  contentHash?: string;
}

export type WSClientEvent =
  | "connected"
  | "disconnected"
  | "post.created"
  | "post.updated"
  | "news.updated";

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
      url: options.url ?? "ws://localhost:3001",
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
}

// Singleton instance
export const wsClient = new WSClientService();
