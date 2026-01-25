import WebSocket from "ws";
import {
  createRequest,
  type ResponseFrame,
  type EventFrame,
} from "../gateway/protocol/frame.js";
import type { Message } from "../llm/types.js";

export interface WSClientOptions {
  url?: string;
  reconnect?: boolean;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  timeout?: number;
}

export interface ChatChunk {
  text: string;
}

export class WSClient {
  private ws?: WebSocket;
  private options: Required<WSClientOptions>;

  private manualDisconnect = false;
  private reconnectAttempts = 0;
  private reconnectTimer?: NodeJS.Timeout;

  private pendingRequests = new Map<
    string,
    {
      resolve: (value: ResponseFrame) => void;
      reject: (reason?: unknown) => void;
      timer: NodeJS.Timeout;
    }
  >();

  private eventListeners = new Map<
    string,
    Set<(payload: unknown, frame: EventFrame) => void>
  >();

  constructor(options: WSClientOptions = {}) {
    this.options = {
      url: options.url ?? "ws://localhost:3001",
      reconnect: options.reconnect ?? true,
      reconnectInterval: options.reconnectInterval ?? 1000,
      maxReconnectAttempts: options.maxReconnectAttempts ?? 5,
      timeout: options.timeout ?? 30000,
    };
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        resolve();
        return;
      }

      this.ws = new WebSocket(this.options.url);

      this.ws.on("open", () => {
        this.reconnectAttempts = 0;
        this.manualDisconnect = false;
        resolve();
      });

      this.ws.on("message", (data: Buffer) => {
        this.handleMessage(data.toString("utf-8"));
      });

      this.ws.on("close", () => {
        this.pendingRequests.forEach((req) => {
          clearTimeout(req.timer);
          req.reject(new Error("Connection closed"));
        });
        this.pendingRequests.clear();

        if (!this.manualDisconnect && this.options.reconnect) {
          this.scheduleReconnect();
        }
      });

      this.ws.on("error", (error) => {
        reject(error);
      });
    });
  }

  disconnect(): void {
    this.manualDisconnect = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }
    if (this.ws) {
      this.ws.close();
    }
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.options.maxReconnectAttempts) {
      return;
    }

    const delay = Math.min(
      this.options.reconnectInterval * Math.pow(2, this.reconnectAttempts),
      30000,
    );

    this.reconnectTimer = setTimeout(async () => {
      this.reconnectAttempts++;
      try {
        await this.connect();
      } catch {
        // Reconnection failed, will retry
      }
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
      }
    } catch {
      // Failed to parse message
    }
  }

  private sendRequest(
    method: string,
    params?: unknown,
  ): Promise<ResponseFrame> {
    return new Promise((resolve, reject) => {
      if (!this.isConnected()) {
        reject(new Error("WebSocket is not connected"));
        return;
      }

      const requestFrame = createRequest(method, params);
      const timer = setTimeout(() => {
        this.pendingRequests.delete(requestFrame.id);
        reject(new Error(`Request timeout: ${method}`));
      }, this.options.timeout);

      this.pendingRequests.set(requestFrame.id, { resolve, reject, timer });

      this.ws?.send(JSON.stringify(requestFrame));
    });
  }

  private on(
    event: string,
    handler: (payload: unknown, frame: EventFrame) => void,
  ): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(handler);
  }

  private off(
    event: string,
    handler: (payload: unknown, frame: EventFrame) => void,
  ): void {
    this.eventListeners.get(event)?.delete(handler);
  }

  async *sendChat(message: string, history?: Message[]): AsyncIterable<string> {
    // Send request and wait for initial response
    const res = await this.sendRequest("chat.send", { message, history });
    if (!res.ok) {
      throw new Error(res.error?.message || "Chat request failed");
    }

    // Done event controller
    let doneResolver: () => void;
    const donePromise = new Promise<void>((resolve) => {
      doneResolver = resolve;
    });

    const doneHandler = () => {
      doneResolver();
    };
    this.on("chat.done", doneHandler);

    // Chunk queue for processing
    const chunkQueue: string[] = [];
    let chunkResolver: (() => void) | null = null;

    const chunkHandler = (payload: unknown) => {
      const chunk = payload as ChatChunk;
      chunkQueue.push(chunk.text);
      if (chunkResolver) {
        chunkResolver();
        chunkResolver = null;
      }
    };
    this.on("chat.chunk", chunkHandler);

    try {
      let done = false;
      donePromise.then(() => {
        done = true;
        if (chunkResolver) {
          chunkResolver();
          chunkResolver = null;
        }
      });

      while (!done || chunkQueue.length > 0) {
        if (chunkQueue.length > 0) {
          yield chunkQueue.shift()!;
        } else if (!done) {
          await new Promise<void>((resolve) => {
            chunkResolver = resolve;
          });
        }
      }
    } finally {
      this.off("chat.done", doneHandler);
      this.off("chat.chunk", chunkHandler);
    }
  }
}
