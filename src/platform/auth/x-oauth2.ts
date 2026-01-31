/**
 * X (Twitter) OAuth 2.0 PKCE Handler
 *
 * Implements OAuth 2.0 Authorization Code Flow with PKCE for X API v2.
 * @see https://developer.twitter.com/en/docs/authentication/oauth-2-0/authorization-code
 */

import crypto from "crypto";

export interface XOAuth2Tokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // Unix timestamp in milliseconds
  tokenType: string;
  scope: string;
}

export interface XOAuth2Config {
  clientId: string;
  clientSecret?: string; // Required for Confidential Clients (Web Apps)
  redirectUri: string;
  scopes?: string[];
}

interface AuthSession {
  codeVerifier: string;
  state: string;
  createdAt: number;
}

const DEFAULT_SCOPES = [
  "tweet.read",
  "tweet.write",
  "users.read",
  "offline.access",
];

const X_AUTH_URL = "https://twitter.com/i/oauth2/authorize";
const X_TOKEN_URL = "https://api.twitter.com/2/oauth2/token";

export class XOAuth2Handler {
  private config: XOAuth2Config & { scopes: string[] };
  private pendingSessions = new Map<string, AuthSession>();

  constructor(config: XOAuth2Config) {
    this.config = {
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      redirectUri: config.redirectUri,
      scopes: config.scopes ?? DEFAULT_SCOPES,
    };
  }

  /**
   * Create Basic Auth header for Confidential Clients
   */
  private getAuthHeader(): Record<string, string> {
    if (this.config.clientSecret) {
      const credentials = Buffer.from(
        `${this.config.clientId}:${this.config.clientSecret}`,
      ).toString("base64");
      return { Authorization: `Basic ${credentials}` };
    }
    return {};
  }

  /**
   * Generate a random base64url-encoded string
   */
  private generateRandomString(length: number): string {
    const bytes = crypto.randomBytes(length);
    return bytes
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=/g, "");
  }

  /**
   * Generate code challenge from code verifier (S256 method)
   */
  private generateCodeChallenge(verifier: string): string {
    const hash = crypto.createHash("sha256").update(verifier).digest();
    return hash
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=/g, "");
  }

  /**
   * Generate the authorization URL for OAuth 2.0 PKCE flow
   */
  generateAuthUrl(): { url: string; state: string } {
    const codeVerifier = this.generateRandomString(64);
    const codeChallenge = this.generateCodeChallenge(codeVerifier);
    const state = this.generateRandomString(32);

    // Store session for callback verification
    this.pendingSessions.set(state, {
      codeVerifier,
      state,
      createdAt: Date.now(),
    });

    // Clean up old sessions (older than 10 minutes)
    this.cleanupSessions();

    const params = new URLSearchParams({
      response_type: "code",
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      scope: this.config.scopes.join(" "),
      state,
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
    });

    return {
      url: `${X_AUTH_URL}?${params.toString()}`,
      state,
    };
  }

  /**
   * Exchange authorization code for tokens
   */
  async handleCallback(code: string, state: string): Promise<XOAuth2Tokens> {
    const session = this.pendingSessions.get(state);
    if (!session) {
      throw new Error("Invalid or expired state parameter");
    }

    // Remove used session
    this.pendingSessions.delete(state);

    const params = new URLSearchParams({
      code,
      grant_type: "authorization_code",
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      code_verifier: session.codeVerifier,
    });

    const response = await fetch(X_TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        ...this.getAuthHeader(),
      },
      body: params.toString(),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Token exchange failed: ${error}`);
    }

    const data = (await response.json()) as {
      access_token: string;
      refresh_token: string;
      expires_in: number;
      token_type: string;
      scope: string;
    };

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: Date.now() + data.expires_in * 1000,
      tokenType: data.token_type,
      scope: data.scope,
    };
  }

  /**
   * Refresh expired tokens
   */
  async refreshTokens(refreshToken: string): Promise<XOAuth2Tokens> {
    const params = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: this.config.clientId,
    });

    const response = await fetch(X_TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        ...this.getAuthHeader(),
      },
      body: params.toString(),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Token refresh failed: ${error}`);
    }

    const data = (await response.json()) as {
      access_token: string;
      refresh_token: string;
      expires_in: number;
      token_type: string;
      scope: string;
    };

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: Date.now() + data.expires_in * 1000,
      tokenType: data.token_type,
      scope: data.scope,
    };
  }

  /**
   * Check if a state is valid (pending session exists)
   */
  hasValidState(state: string): boolean {
    return this.pendingSessions.has(state);
  }

  /**
   * Clean up expired sessions (older than 10 minutes)
   */
  private cleanupSessions(): void {
    const now = Date.now();
    const maxAge = 10 * 60 * 1000; // 10 minutes

    for (const [state, session] of this.pendingSessions.entries()) {
      if (now - session.createdAt > maxAge) {
        this.pendingSessions.delete(state);
      }
    }
  }
}
