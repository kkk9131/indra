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
      height: 100%;
      font-family: system-ui, sans-serif;
    }

    .messages {
      flex: 1;
      overflow-y: auto;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      background: #f9fafb;
    }

    .message {
      max-width: 70%;
      padding: 12px 16px;
      border-radius: 12px;
      line-height: 1.5;
    }

    .message.user {
      align-self: flex-end;
      background: #3b82f6;
      color: white;
    }

    .message.assistant {
      align-self: flex-start;
      background: #e5e7eb;
      color: #1f2937;
    }

    .input-area {
      display: flex;
      gap: 8px;
      padding: 16px;
      background: white;
      border-top: 1px solid #e5e7eb;
    }

    textarea {
      flex: 1;
      min-height: 40px;
      max-height: 120px;
      padding: 10px;
      border: 1px solid #d1d5db;
      border-radius: 8px;
      resize: vertical;
      font-family: inherit;
      font-size: 14px;
    }

    textarea:focus {
      outline: none;
      border-color: #3b82f6;
      box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
    }

    button {
      padding: 10px 20px;
      background: #3b82f6;
      color: white;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 500;
    }

    button:hover:not(:disabled) {
      background: #2563eb;
    }

    button:disabled {
      background: #9ca3af;
      cursor: not-allowed;
    }
  `;

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

    this.ws.onopen = () => {
      this.isConnected = true;
    };

    this.ws.onmessage = (event) => {
      try {
        const frame = JSON.parse(event.data);

        if (frame.type === "res" && frame.ok && frame.payload?.sessionId) {
          this.sessionId = frame.payload.sessionId;
        } else if (frame.type === "event" && frame.event === "chat.message") {
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
      } catch {
        // Ignore malformed messages
      }
    };

    this.ws.onclose = () => {
      this.isConnected = false;
    };

    this.ws.onerror = () => {
      this.isConnected = false;
    };
  }

  private disconnect(): void {
    this.ws?.close();
    this.ws = undefined;
    this.isConnected = false;
  }

  private sendMessage(): void {
    if (!this.inputText.trim() || !this.isConnected || this.isSending) {
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
      <div class="messages">
        ${this.messages.map(
          (msg) => html`
            <div class="message ${msg.role}">${msg.content}</div>
          `,
        )}
      </div>

      <div class="input-area">
        <textarea
          .value="${this.inputText}"
          @input="${(e: Event) => {
            const target = e.target as HTMLTextAreaElement;
            this.inputText = target.value;
          }}"
          @keydown="${(e: KeyboardEvent) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              this.sendMessage();
            }
          }}"
          placeholder="Type a message... (Enter to send, Shift+Enter for new line)"
        ></textarea>
        <button
          ?disabled="${!this.inputText.trim() ||
          !this.isConnected ||
          this.isSending}"
          @click="${this.sendMessage}"
        >
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
