import { LitElement, css, html, svg } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { buildWsUrl } from "../services/ws-url.js";

// Lucide icons
const userIcon = svg`<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>`;
const botIcon = svg`<path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/>`;
const toolIcon = svg`<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>`;
const imageIcon = svg`<rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>`;
const xIcon = svg`<path d="M18 6 6 18"/><path d="m6 6 12 12"/>`;

interface AttachedImage {
  id: string;
  data: string;
  mediaType: "image/png" | "image/jpeg" | "image/gif" | "image/webp";
  preview: string;
}

interface ToolUse {
  toolUseId: string;
  tool: string;
  input: unknown;
  result?: string;
  isRunning: boolean;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  isStreaming?: boolean;
  toolUses?: ToolUse[];
}

@customElement("indra-chat-ui")
export class ChatUIElement extends LitElement {
  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      position: fixed;
      right: 0;
      top: 0;
      height: 100%;
      width: 400px;
      font-family: "Geist Mono", "Inter", system-ui, monospace;
      background: var(--bg-primary, #e8f5e9);
      border-left: 1px solid var(--border, #e0e0e0);
      transform: translateX(100%);
      transition: transform 0.3s ease;
      z-index: 1000;
    }

    :host([open]) {
      transform: translateX(0);
    }

    .close-btn {
      position: absolute;
      top: 12px;
      right: 12px;
      background: var(--bg-tertiary, #f5f5f5);
      border: none;
      color: var(--text-secondary, #636e72);
      font-size: 18px;
      cursor: pointer;
      padding: 0;
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
      z-index: 10;
    }

    .close-btn:hover {
      background: var(--border, #e0e0e0);
      color: var(--text-primary, #2d3436);
    }

    .messages {
      flex: 1;
      overflow-y: auto;
      padding: 48px 16px 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      background: var(--bg-primary, #e8f5e9);
    }

    .message {
      max-width: 80%;
      padding: 12px 16px;
      border-radius: 12px;
      line-height: 1.5;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .message.user {
      align-self: flex-end;
      align-items: flex-end;
    }

    .message.assistant {
      align-self: flex-start;
      align-items: flex-start;
    }

    .message-content {
      background: white;
      padding: 12px 16px;
      border-radius: 12px;
      color: var(--text-primary, #2d3436);
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
      white-space: pre-wrap;
      word-break: break-word;
    }

    .message.user .message-content {
      background: #81c784;
      color: white;
    }

    .message.streaming .message-content::after {
      content: "▌";
      animation: blink 1s infinite;
    }

    @keyframes blink {
      0%,
      50% {
        opacity: 1;
      }
      51%,
      100% {
        opacity: 0;
      }
    }

    .avatar {
      width: 24px;
      height: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .avatar svg {
      width: 20px;
      height: 20px;
      stroke: #9e9e9e;
      stroke-width: 2;
      stroke-linecap: round;
      stroke-linejoin: round;
      fill: none;
    }

    .input-area {
      display: flex;
      gap: 8px;
      padding: 16px;
      background: var(--bg-primary, #e8f5e9);
      border-top: 1px solid var(--border, #e0e0e0);
    }

    textarea {
      flex: 1;
      min-height: 40px;
      max-height: 120px;
      padding: 10px;
      border: 1px solid var(--border, #e0e0e0);
      border-radius: 8px;
      resize: vertical;
      font-family: "Geist Mono", "Inter", system-ui, monospace;
      font-size: 14px;
    }

    textarea:focus {
      outline: none;
      border-color: var(--primary, #2e7d32);
      box-shadow: 0 0 0 3px rgba(46, 125, 50, 0.1);
    }

    button {
      padding: 10px 20px;
      background: var(--primary, #2e7d32);
      color: white;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 500;
      font-family: "Geist Mono", "Inter", system-ui, monospace;
    }

    button:hover:not(:disabled) {
      background: #1b5e20;
    }

    button:disabled {
      background: var(--border, #e0e0e0);
      cursor: not-allowed;
    }

    .status {
      padding: 8px 16px;
      font-size: 12px;
      color: var(--text-secondary, #636e72);
      background: rgba(0, 0, 0, 0.03);
      border-top: 1px solid var(--border, #e0e0e0);
    }

    .status.connected {
      color: var(--primary, #2e7d32);
    }

    .status.disconnected {
      color: #d32f2f;
    }

    .tool-uses {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-top: 8px;
    }

    .tool-use {
      background: #f5f5f5;
      border-radius: 8px;
      padding: 8px 12px;
      font-size: 12px;
    }

    .tool-use.running {
      border-left: 3px solid #2e7d32;
      animation: pulse 1.5s infinite;
    }

    .tool-use.completed {
      border-left: 3px solid #9e9e9e;
    }

    @keyframes pulse {
      0%,
      100% {
        opacity: 1;
      }
      50% {
        opacity: 0.7;
      }
    }

    .tool-header {
      display: flex;
      align-items: center;
      gap: 6px;
      font-weight: 500;
      color: #2d3436;
    }

    .tool-header svg {
      width: 14px;
      height: 14px;
      stroke: #2e7d32;
      stroke-width: 2;
      stroke-linecap: round;
      stroke-linejoin: round;
      fill: none;
    }

    .tool-result {
      margin-top: 6px;
      padding: 6px 8px;
      background: white;
      border-radius: 4px;
      font-family: monospace;
      font-size: 11px;
      max-height: 100px;
      overflow-y: auto;
      white-space: pre-wrap;
      word-break: break-all;
      color: #636e72;
    }

    .tool-result-toggle {
      margin-top: 4px;
      background: none;
      border: none;
      color: #2e7d32;
      cursor: pointer;
      font-size: 11px;
      padding: 0;
    }

    .tool-result-toggle:hover {
      text-decoration: underline;
    }

    .input-row {
      display: flex;
      gap: 8px;
      align-items: flex-end;
    }

    .image-attach-btn {
      background: var(--bg-tertiary, #f5f5f5);
      border: 1px solid var(--border, #e0e0e0);
      color: var(--text-secondary, #636e72);
      padding: 10px;
      border-radius: 8px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .image-attach-btn:hover {
      background: var(--border, #e0e0e0);
      color: var(--text-primary, #2d3436);
    }

    .image-attach-btn svg {
      width: 20px;
      height: 20px;
      stroke: currentColor;
      stroke-width: 2;
      stroke-linecap: round;
      stroke-linejoin: round;
      fill: none;
    }

    .image-previews {
      display: flex;
      gap: 8px;
      padding: 8px 16px 0;
      flex-wrap: wrap;
    }

    .image-preview {
      position: relative;
      width: 60px;
      height: 60px;
      border-radius: 8px;
      overflow: hidden;
      border: 1px solid var(--border, #e0e0e0);
    }

    .image-preview img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .image-preview-remove {
      position: absolute;
      top: 2px;
      right: 2px;
      width: 20px;
      height: 20px;
      background: rgba(0, 0, 0, 0.6);
      border: none;
      border-radius: 50%;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0;
    }

    .image-preview-remove svg {
      width: 12px;
      height: 12px;
      stroke: white;
      stroke-width: 2;
      stroke-linecap: round;
      stroke-linejoin: round;
      fill: none;
    }

    .image-preview-remove:hover {
      background: rgba(211, 47, 47, 0.8);
    }

    .cancel-btn {
      background: #d32f2f;
      padding: 10px 16px;
    }

    .cancel-btn:hover:not(:disabled) {
      background: #b71c1c;
    }

    .hidden-input {
      display: none;
    }
  `;

  @property({ type: Boolean })
  open = false;

  @property()
  wsUrl = buildWsUrl();

  @state()
  messages: Message[] = [];

  @state()
  isConnected = false;

  @state()
  inputText = "";

  @state()
  isSending = false;

  @state()
  private sessionId?: string;

  @state()
  private attachedImages: AttachedImage[] = [];

  @state()
  private currentRequestId?: string;

  private readonly agentMode = true;
  private readonly MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB

  private ws?: WebSocket;
  private currentStreamingId?: string;
  private pendingRequests = new Map<
    string,
    { resolve: () => void; reject: (err: Error) => void }
  >();

  connectedCallback() {
    super.connectedCallback();
    this.connect();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.disconnect();
  }

  private connect(): void {
    this.ws = new WebSocket(this.wsUrl);
    this.ws.onopen = this.handleOpen.bind(this);
    this.ws.onmessage = this.handleMessage.bind(this);
    this.ws.onclose = this.handleConnectionClose.bind(this);
    this.ws.onerror = this.handleConnectionClose.bind(this);
  }

  private handleOpen(): void {
    this.isConnected = true;
  }

  private handleMessage(event: MessageEvent): void {
    try {
      const frame = JSON.parse(event.data);
      this.processFrame(frame);
    } catch {
      // Ignore malformed messages
    }
  }

  private processFrame(frame: {
    type: string;
    id?: string;
    ok?: boolean;
    event?: string;
    payload?: {
      sessionId?: string;
      text?: string;
      tool?: string;
      input?: unknown;
      result?: string;
      toolUseId?: string;
      turnNumber?: number;
    };
    error?: { code: string; message: string };
  }): void {
    // Handle initial session response
    if (frame.type === "res" && frame.ok && frame.payload?.sessionId) {
      this.sessionId = frame.payload.sessionId;
      return;
    }

    // Handle request response
    if (frame.type === "res" && frame.id) {
      const pending = this.pendingRequests.get(frame.id);
      if (pending) {
        this.pendingRequests.delete(frame.id);
        if (frame.ok) {
          pending.resolve();
        } else {
          pending.reject(new Error(frame.error?.message ?? "Request failed"));
        }
      }
      return;
    }

    // Handle streaming events
    if (frame.type === "event") {
      if (frame.event === "chat.chunk" && this.currentStreamingId) {
        this.appendChunk(frame.payload?.text ?? "");
      } else if (frame.event === "chat.done" && this.currentStreamingId) {
        this.finishStreaming();
      } else if (frame.event === "chat.cancelled" && this.currentStreamingId) {
        this.handleCancelled(
          (frame.payload as { reason?: string })?.reason ?? "Cancelled",
        );
      } else if (
        frame.event === "agent.tool_start" &&
        this.currentStreamingId
      ) {
        this.handleToolStart(
          frame.payload?.tool ?? "",
          frame.payload?.input,
          frame.payload?.toolUseId ?? "",
        );
      } else if (
        frame.event === "agent.tool_result" &&
        this.currentStreamingId
      ) {
        this.handleToolResult(
          frame.payload?.toolUseId ?? "",
          frame.payload?.result ?? "",
        );
      }
    }
  }

  private handleCancelled(reason: string): void {
    if (!this.currentStreamingId) return;

    this.messages = this.messages.map((msg) => {
      if (msg.id !== this.currentStreamingId) return msg;
      const toolUses = msg.toolUses?.map((t) => ({ ...t, isRunning: false }));
      return {
        ...msg,
        content: msg.content + `\n\n[キャンセルされました: ${reason}]`,
        isStreaming: false,
        toolUses,
      };
    });
    this.currentStreamingId = undefined;
    this.currentRequestId = undefined;
    this.isSending = false;
  }

  private appendChunk(text: string): void {
    if (!this.currentStreamingId) return;

    this.messages = this.messages.map((msg) =>
      msg.id === this.currentStreamingId
        ? { ...msg, content: msg.content + text }
        : msg,
    );

    this.scrollToBottom();
  }

  private finishStreaming(): void {
    if (!this.currentStreamingId) return;

    this.messages = this.messages.map((msg) => {
      if (msg.id !== this.currentStreamingId) return msg;
      // Mark all tools as completed
      const toolUses = msg.toolUses?.map((t) => ({ ...t, isRunning: false }));
      return { ...msg, isStreaming: false, toolUses };
    });
    this.currentStreamingId = undefined;
    this.currentRequestId = undefined;
    this.isSending = false;
  }

  private handleToolStart(
    tool: string,
    input: unknown,
    toolUseId: string,
  ): void {
    if (!this.currentStreamingId) return;

    this.messages = this.messages.map((msg) => {
      if (msg.id !== this.currentStreamingId) return msg;
      const toolUses = msg.toolUses ?? [];
      return {
        ...msg,
        toolUses: [...toolUses, { toolUseId, tool, input, isRunning: true }],
      };
    });

    this.scrollToBottom();
  }

  private handleToolResult(toolUseId: string, result: string): void {
    if (!this.currentStreamingId) return;

    this.messages = this.messages.map((msg) => {
      if (msg.id !== this.currentStreamingId) return msg;
      const toolUses = msg.toolUses?.map((t) =>
        t.toolUseId === toolUseId ? { ...t, result, isRunning: false } : t,
      );
      return { ...msg, toolUses };
    });

    this.scrollToBottom();
  }

  private scrollToBottom(): void {
    this.updateComplete.then(() => {
      const messagesEl = this.shadowRoot?.querySelector(".messages");
      if (messagesEl) {
        messagesEl.scrollTop = messagesEl.scrollHeight;
      }
    });
  }

  private handleConnectionClose(): void {
    this.isConnected = false;
    // Reject all pending requests
    for (const pending of this.pendingRequests.values()) {
      pending.reject(new Error("Connection closed"));
    }
    this.pendingRequests.clear();

    // Finish any streaming message
    if (this.currentStreamingId) {
      this.finishStreaming();
    }
  }

  private disconnect(): void {
    this.ws?.close();
    this.ws = undefined;
    this.isConnected = false;
  }

  private get isSendDisabled(): boolean {
    return !this.inputText.trim() || !this.isConnected || this.isSending;
  }

  private handleInput(e: Event): void {
    const target = e.target as HTMLTextAreaElement;
    this.inputText = target.value;
  }

  private handleKeydown(e: KeyboardEvent): void {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      this.sendMessage();
    }
  }

  private getHistory(): Array<{ role: string; content: string }> {
    return this.messages
      .filter((m) => !m.isStreaming)
      .map((m) => ({ role: m.role, content: m.content }));
  }

  private handleImageSelect(e: Event): void {
    const input = e.target as HTMLInputElement;
    const files = input.files;
    if (!files) return;

    for (const file of Array.from(files)) {
      if (file.size > this.MAX_IMAGE_SIZE) {
        console.warn(`Image ${file.name} exceeds 5MB limit`);
        continue;
      }

      const validTypes = ["image/png", "image/jpeg", "image/gif", "image/webp"];
      if (!validTypes.includes(file.type)) {
        console.warn(`Invalid image type: ${file.type}`);
        continue;
      }

      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        const base64Data = dataUrl.split(",")[1];
        const preview = dataUrl;

        this.attachedImages = [
          ...this.attachedImages,
          {
            id: crypto.randomUUID(),
            data: base64Data,
            mediaType: file.type as AttachedImage["mediaType"],
            preview,
          },
        ];
      };
      reader.readAsDataURL(file);
    }

    // Reset input
    input.value = "";
  }

  private removeImage(id: string): void {
    this.attachedImages = this.attachedImages.filter((img) => img.id !== id);
  }

  private triggerImageInput(): void {
    const input = this.shadowRoot?.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    input?.click();
  }

  private cancelRequest(): void {
    if (!this.currentRequestId || !this.ws) return;

    this.ws.send(
      JSON.stringify({
        type: "req",
        id: crypto.randomUUID(),
        method: "chat.cancel",
        params: { requestId: this.currentRequestId },
      }),
    );
  }

  private sendMessage(): void {
    if (this.isSendDisabled) {
      return;
    }

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: this.inputText,
      timestamp: Date.now(),
    };

    // Create streaming assistant message
    const assistantMessage: Message = {
      id: crypto.randomUUID(),
      role: "assistant",
      content: "",
      timestamp: Date.now(),
      isStreaming: true,
    };

    this.messages = [...this.messages, userMessage, assistantMessage];
    this.currentStreamingId = assistantMessage.id;
    this.isSending = true;

    const requestId = crypto.randomUUID();
    this.currentRequestId = requestId;
    const history = this.getHistory().slice(0, -1); // Exclude the empty streaming message

    // Create promise for response tracking
    new Promise<void>((resolve, reject) => {
      this.pendingRequests.set(requestId, { resolve, reject });
    }).catch((err) => {
      console.error("Chat error:", err);
      this.finishStreaming();
    });

    // Build params with optional images
    const params: {
      message: string;
      history: Array<{ role: string; content: string }>;
      agentMode: boolean;
      images?: Array<{ data: string; mediaType: string }>;
    } = {
      message: this.inputText,
      history,
      agentMode: this.agentMode,
    };

    if (this.attachedImages.length > 0) {
      params.images = this.attachedImages.map((img) => ({
        data: img.data,
        mediaType: img.mediaType,
      }));
    }

    this.ws?.send(
      JSON.stringify({
        type: "req",
        id: requestId,
        method: "chat.send",
        params,
      }),
    );

    this.inputText = "";
    this.attachedImages = [];
    this.scrollToBottom();
  }

  private handleUIClose(): void {
    this.dispatchEvent(
      new CustomEvent("close", { bubbles: true, composed: true }),
    );
  }

  private truncateResult(result: string, maxLen = 200): string {
    if (result.length <= maxLen) return result;
    return result.slice(0, maxLen) + "...";
  }

  private renderToolUses(toolUses: ToolUse[] | undefined) {
    if (!toolUses || toolUses.length === 0) return null;

    return html`
      <div class="tool-uses">
        ${toolUses.map(
          (t) => html`
            <div class="tool-use ${t.isRunning ? "running" : "completed"}">
              <div class="tool-header">
                <svg viewBox="0 0 24 24">${toolIcon}</svg>
                <span>${t.tool}</span>
                ${t.isRunning ? html`<span>実行中...</span>` : null}
              </div>
              ${t.result
                ? html`<div class="tool-result">
                    ${this.truncateResult(t.result)}
                  </div>`
                : null}
            </div>
          `,
        )}
      </div>
    `;
  }

  render() {
    return html`
      <button class="close-btn" @click="${this.handleUIClose}" title="Close">
        ×
      </button>

      <div class="messages">
        ${this.messages.map(
          (msg) => html`
            <div
              class="message ${msg.role} ${msg.isStreaming ? "streaming" : ""}"
            >
              <div class="avatar">
                <svg viewBox="0 0 24 24">
                  ${msg.role === "user" ? userIcon : botIcon}
                </svg>
              </div>
              <div class="message-content">${msg.content}</div>
              ${msg.role === "assistant"
                ? this.renderToolUses(msg.toolUses)
                : null}
            </div>
          `,
        )}
      </div>

      ${this.attachedImages.length > 0
        ? html`
            <div class="image-previews">
              ${this.attachedImages.map(
                (img) => html`
                  <div class="image-preview">
                    <img src="${img.preview}" alt="Attached" />
                    <button
                      class="image-preview-remove"
                      @click="${() => this.removeImage(img.id)}"
                      title="Remove"
                    >
                      <svg viewBox="0 0 24 24">${xIcon}</svg>
                    </button>
                  </div>
                `,
              )}
            </div>
          `
        : null}

      <div class="input-area">
        <input
          type="file"
          class="hidden-input"
          accept="image/png,image/jpeg,image/gif,image/webp"
          multiple
          @change="${this.handleImageSelect}"
        />
        <button
          class="image-attach-btn"
          @click="${this.triggerImageInput}"
          ?disabled="${this.isSending}"
          title="画像を添付"
        >
          <svg viewBox="0 0 24 24">${imageIcon}</svg>
        </button>
        <div class="input-row" style="flex: 1; display: flex; gap: 8px;">
          <textarea
            .value="${this.inputText}"
            @input="${this.handleInput}"
            @keydown="${this.handleKeydown}"
            placeholder="Type a message... (Enter to send, Shift+Enter for new line)"
            ?disabled="${this.isSending}"
            style="flex: 1;"
          ></textarea>
          ${this.isSending
            ? html`
                <button class="cancel-btn" @click="${this.cancelRequest}">
                  Cancel
                </button>
              `
            : html`
                <button
                  ?disabled="${this.isSendDisabled}"
                  @click="${this.sendMessage}"
                >
                  Send
                </button>
              `}
        </div>
      </div>

      <div class="status ${this.isConnected ? "connected" : "disconnected"}">
        ${this.isConnected ? "● Connected" : "○ Disconnected"}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "indra-chat-ui": ChatUIElement;
  }
}
