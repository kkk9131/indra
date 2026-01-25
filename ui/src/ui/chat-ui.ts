import { LitElement, css, html } from "lit";
import { customElement, property, state } from "lit/decorators.js";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
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

    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px 20px;
      background: var(--primary, #2e7d32);
      color: white;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    }

    .header h2 {
      margin: 0;
      font-size: 18px;
      font-weight: 600;
    }

    .close-btn {
      background: none;
      border: none;
      color: white;
      font-size: 24px;
      cursor: pointer;
      padding: 0;
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 4px;
    }

    .close-btn:hover {
      background: rgba(255, 255, 255, 0.1);
    }

    .messages {
      flex: 1;
      overflow-y: auto;
      padding: 16px;
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
    }

    .message.user .message-content {
      background: var(--primary, #2e7d32);
      color: white;
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
  private requestId = 0;

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
    ok?: boolean;
    event?: string;
    payload?: { sessionId?: string; text?: string };
  }): void {
    if (frame.type === "res" && frame.ok && frame.payload?.sessionId) {
      this.sessionId = frame.payload.sessionId;
      return;
    }

    if (frame.type === "event" && frame.event === "chat.message") {
      this.messages = [
        ...this.messages,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: String(frame.payload?.text ?? ""),
          timestamp: Date.now(),
        },
      ];
    }
  }

  private handleClose(): void {
    this.isConnected = false;
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

    this.messages = [...this.messages, userMessage];
    this.isSending = true;

    const requestId = `req_${this.requestId++}`;

    this.ws?.send(
      JSON.stringify({
        type: "req",
        id: requestId,
        method: "chat.send",
        params: { text: this.inputText },
      }),
    );

    this.inputText = "";
    this.isSending = false;
  }

  render() {
    return html`
      <div class="header">
        <h2>AI Chat</h2>
        <button class="close-btn" @click="${() => (this.open = false)}">
          ×
        </button>
      </div>

      <div class="messages">
        ${this.messages.map(
          (msg) => html`
            <div class="message ${msg.role}">
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
        ></textarea>
        <button ?disabled="${this.isSendDisabled}" @click="${this.sendMessage}">
          Send
        </button>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "indra-chat-ui": ChatUIElement;
  }
}
