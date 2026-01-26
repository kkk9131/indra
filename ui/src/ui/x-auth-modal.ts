import { LitElement, css, html, svg } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { wsClient } from "../services/ws-client.js";
import "./common/modal.js";

// X (Twitter) logo
const xLogo = svg`<path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>`;

// Loading spinner
const loadingIcon = svg`<path d="M21 12a9 9 0 1 1-6.219-8.56"/>`;

type AuthState = "idle" | "loading" | "authenticating" | "success" | "error";

@customElement("indra-x-auth-modal")
export class XAuthModalElement extends LitElement {
  static styles = css`
    :host {
      font-family: var(--font-family, "Geist Mono", monospace);
    }

    .auth-content {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 24px;
      padding: 24px;
      text-align: center;
    }

    .x-logo {
      width: 48px;
      height: 48px;
    }

    .x-logo svg {
      width: 100%;
      height: 100%;
      fill: currentColor;
    }

    .auth-title {
      font-size: 18px;
      font-weight: 600;
      color: var(--text-primary, #2d3436);
    }

    .auth-description {
      font-size: 14px;
      color: var(--text-secondary, #636e72);
      line-height: 1.6;
      max-width: 320px;
    }

    .btn {
      padding: 12px 24px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      font-family: inherit;
      transition: all 0.15s ease;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .btn-x {
      background: #000;
      color: #fff;
      border: none;
    }

    .btn-x:hover:not(:disabled) {
      background: #333;
    }

    .btn-x:disabled {
      background: #999;
      cursor: not-allowed;
    }

    .btn-secondary {
      background: var(--bg-tertiary, #f5f5f5);
      color: var(--text-primary, #2d3436);
      border: 1px solid var(--border, #e0e0e0);
    }

    .btn-secondary:hover {
      background: var(--border, #e0e0e0);
    }

    .btn-icon {
      width: 16px;
      height: 16px;
    }

    .btn-icon svg {
      width: 100%;
      height: 100%;
      fill: currentColor;
    }

    .loading-icon {
      width: 16px;
      height: 16px;
      animation: spin 1s linear infinite;
    }

    .loading-icon svg {
      width: 100%;
      height: 100%;
      fill: none;
      stroke: currentColor;
      stroke-width: 2;
      stroke-linecap: round;
    }

    @keyframes spin {
      from {
        transform: rotate(0deg);
      }
      to {
        transform: rotate(360deg);
      }
    }

    .success-message {
      color: #2e7d32;
      font-size: 14px;
    }

    .error-message {
      color: #c62828;
      font-size: 14px;
      max-width: 320px;
    }

    .footer-buttons {
      display: flex;
      gap: 12px;
      justify-content: center;
    }
  `;

  @property({ type: Boolean })
  open = false;

  @state()
  private authState: AuthState = "idle";

  @state()
  private errorMessage = "";

  @state()
  private username = "";

  private authWindow: Window | null = null;
  private pendingState: string | null = null;

  connectedCallback() {
    super.connectedCallback();
    window.addEventListener("message", this.handleAuthCallback);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    window.removeEventListener("message", this.handleAuthCallback);
    this.closeAuthWindow();
  }

  private handleAuthCallback = async (event: MessageEvent) => {
    // Verify origin (should be same origin for callback.html)
    if (event.origin !== window.location.origin) return;

    const { type, code, state, error } = event.data;

    if (type !== "x-auth-callback") return;

    this.closeAuthWindow();

    if (error) {
      this.authState = "error";
      this.errorMessage = error;
      return;
    }

    if (!code || !state) {
      this.authState = "error";
      this.errorMessage = "Invalid callback: missing code or state";
      return;
    }

    // Verify state matches
    if (state !== this.pendingState) {
      this.authState = "error";
      this.errorMessage = "State mismatch. Please try again.";
      return;
    }

    try {
      const result = await wsClient.authXCallback(code, state);
      if (result.success) {
        this.authState = "success";
        // Fetch status to get username
        const status = await wsClient.authXStatus();
        this.username = status.username ?? "";
      }
    } catch (err) {
      this.authState = "error";
      this.errorMessage =
        err instanceof Error ? err.message : "Authentication failed";
    }
  };

  private async startAuth(): Promise<void> {
    this.authState = "loading";
    this.errorMessage = "";

    try {
      const { url, state } = await wsClient.authXStart();
      this.pendingState = state;
      this.authState = "authenticating";

      // Open auth window
      const width = 600;
      const height = 700;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;

      this.authWindow = window.open(
        url,
        "x-auth",
        `width=${width},height=${height},left=${left},top=${top}`,
      );

      // Poll for window close
      const pollTimer = setInterval(() => {
        if (this.authWindow?.closed) {
          clearInterval(pollTimer);
          if (this.authState === "authenticating") {
            this.authState = "idle";
          }
        }
      }, 500);
    } catch (err) {
      this.authState = "error";
      this.errorMessage =
        err instanceof Error ? err.message : "Failed to start authentication";
    }
  }

  private closeAuthWindow(): void {
    if (this.authWindow && !this.authWindow.closed) {
      this.authWindow.close();
    }
    this.authWindow = null;
  }

  private handleClose(): void {
    this.closeAuthWindow();
    this.authState = "idle";
    this.errorMessage = "";
    this.dispatchEvent(new CustomEvent("close", { bubbles: true }));
  }

  private handleDone(): void {
    this.handleClose();
    this.dispatchEvent(
      new CustomEvent("authenticated", {
        bubbles: true,
        detail: { username: this.username },
      }),
    );
  }

  render() {
    return html`
      <indra-modal
        ?open="${this.open}"
        title="Connect X Account"
        @close="${this.handleClose}"
      >
        <div class="auth-content">${this.renderContent()}</div>
        <div slot="footer" class="footer-buttons">
          ${this.renderFooterButtons()}
        </div>
      </indra-modal>
    `;
  }

  private renderContent() {
    switch (this.authState) {
      case "idle":
        return html`
          <div class="x-logo">
            <svg viewBox="0 0 24 24">${xLogo}</svg>
          </div>
          <div class="auth-title">Connect your X account</div>
          <div class="auth-description">
            Authorize indra to post on your behalf. You'll be redirected to X to
            complete the authentication.
          </div>
        `;

      case "loading":
        return html`
          <div class="loading-icon">
            <svg viewBox="0 0 24 24">${loadingIcon}</svg>
          </div>
          <div class="auth-description">Preparing authentication...</div>
        `;

      case "authenticating":
        return html`
          <div class="x-logo">
            <svg viewBox="0 0 24 24">${xLogo}</svg>
          </div>
          <div class="auth-title">Waiting for authorization</div>
          <div class="auth-description">
            Complete the authentication in the popup window. If the popup was
            blocked, please allow popups for this site.
          </div>
        `;

      case "success":
        return html`
          <div class="x-logo">
            <svg viewBox="0 0 24 24">${xLogo}</svg>
          </div>
          <div class="auth-title">Connected!</div>
          <div class="success-message">
            Successfully connected as
            ${this.username ? `@${this.username}` : "your account"}
          </div>
        `;

      case "error":
        return html`
          <div class="x-logo">
            <svg viewBox="0 0 24 24">${xLogo}</svg>
          </div>
          <div class="auth-title">Authentication Failed</div>
          <div class="error-message">${this.errorMessage}</div>
        `;
    }
  }

  private renderFooterButtons() {
    switch (this.authState) {
      case "idle":
        return html`
          <button class="btn btn-secondary" @click="${this.handleClose}">
            Cancel
          </button>
          <button class="btn btn-x" @click="${this.startAuth}">
            <span class="btn-icon">
              <svg viewBox="0 0 24 24">${xLogo}</svg>
            </span>
            Connect with X
          </button>
        `;

      case "loading":
      case "authenticating":
        return html`
          <button class="btn btn-secondary" @click="${this.handleClose}">
            Cancel
          </button>
          <button class="btn btn-x" disabled>
            <span class="loading-icon">
              <svg viewBox="0 0 24 24">${loadingIcon}</svg>
            </span>
            Connecting...
          </button>
        `;

      case "success":
        return html`
          <button class="btn btn-x" @click="${this.handleDone}">Done</button>
        `;

      case "error":
        return html`
          <button class="btn btn-secondary" @click="${this.handleClose}">
            Cancel
          </button>
          <button class="btn btn-x" @click="${this.startAuth}">
            <span class="btn-icon">
              <svg viewBox="0 0 24 24">${xLogo}</svg>
            </span>
            Try Again
          </button>
        `;
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "indra-x-auth-modal": XAuthModalElement;
  }
}
