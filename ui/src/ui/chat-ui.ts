import { LitElement, css, html } from "lit";
import { customElement, property, state } from "lit/decorators.js";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  isStreaming?: boolean;
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
      background: var(--primary, #2e7d32);
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
      width: 32px;
      height: 32px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 16px;
      flex-shrink: 0;
    }

    .message.user .avatar {
      background: var(--primary, #2e7d32);
      color: white;
    }

    .message.assistant .avatar {
      background: var(--text-secondary, #636e72);
      color: white;
    }

    .input-area {
      display: flex;
      gap: 8px;
      padding: 16px;
      background: white;
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
  `;

  @property({ type: Boolean })
  open = false;

  @property()
  wsUrl = "ws://localhost:3001";

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
    this.ws.onclose = this.handleClose.bind(this);
    this.ws.onerror = this.handleClose.bind(this);
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
    payload?: { sessionId?: string; text?: string };
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
      }
    }
  }

  private appendChunk(text: string): void {
    if (!this.currentStreamingId) return;

    this.messages = this.messages.map((msg) =>
      msg.id === this.currentStreamingId
        ? { ...msg, content: msg.content + text }
        : msg,
    );

    // Auto-scroll to bottom
    this.updateComplete.then(() => {
      const messagesEl = this.shadowRoot?.querySelector(".messages");
      if (messagesEl) {
        messagesEl.scrollTop = messagesEl.scrollHeight;
      }
    });
  }

  private finishStreaming(): void {
    if (!this.currentStreamingId) return;

    this.messages = this.messages.map((msg) =>
      msg.id === this.currentStreamingId ? { ...msg, isStreaming: false } : msg,
    );
    this.currentStreamingId = undefined;
    this.isSending = false;
  }

  private handleClose(): void {
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
    const history = this.getHistory().slice(0, -1); // Exclude the empty streaming message

    // Create promise for response tracking
    new Promise<void>((resolve, reject) => {
      this.pendingRequests.set(requestId, { resolve, reject });
    }).catch((err) => {
      console.error("Chat error:", err);
      this.finishStreaming();
    });

    this.ws?.send(
      JSON.stringify({
        type: "req",
        id: requestId,
        method: "chat.send",
        params: { message: this.inputText, history },
      }),
    );

    this.inputText = "";

    // Auto-scroll
    this.updateComplete.then(() => {
      const messagesEl = this.shadowRoot?.querySelector(".messages");
      if (messagesEl) {
        messagesEl.scrollTop = messagesEl.scrollHeight;
      }
    });
  }

  private handleClose(): void {
    this.dispatchEvent(
      new CustomEvent("close", { bubbles: true, composed: true }),
    );
  }

  render() {
    return html`
      <button class="close-btn" @click="${this.handleClose}" title="Close">
        ×
      </button>

      <div class="messages">
        ${this.messages.map(
          (msg) => html`
            <div
              class="message ${msg.role} ${msg.isStreaming ? "streaming" : ""}"
            >
              <div class="avatar">${msg.role === "user" ? "👤" : "🤖"}</div>
              <div class="message-content">${msg.content}</div>
            </div>
          `,
        )}
      </div>

      <div class="input-area">
        <textarea
          .value="${this.inputText}"
          @input="${this.handleInput}"
          @keydown="${this.handleKeydown}"
          placeholder="Type a message... (Enter to send, Shift+Enter for new line)"
          ?disabled="${this.isSending}"
        ></textarea>
        <button ?disabled="${this.isSendDisabled}" @click="${this.sendMessage}">
          ${this.isSending ? "..." : "Send"}
        </button>
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
