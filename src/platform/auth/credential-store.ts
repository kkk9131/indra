/**
 * Credential Store
 *
 * Manages OAuth2 tokens and other credentials.
 * Stores credentials in ~/.indra/credentials/credentials.json
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import type { XOAuth2Tokens } from "./x-oauth2.js";

export interface StoredCredentials {
  x?: XOAuth2Credentials;
  discord?: DiscordCredentials;
}

export interface DiscordCredentials {
  botToken: string;
  clientId: string;
  guildIds?: string[];
}

export interface XOAuth2Credentials {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  tokenType: string;
  scope: string;
  username?: string;
}

export class CredentialStore {
  private credentialsPath: string;
  private credentials: StoredCredentials;

  constructor(basePath?: string) {
    const baseDir = basePath ?? join(homedir(), ".indra", "credentials");
    this.credentialsPath = join(baseDir, "credentials.json");

    if (!existsSync(baseDir)) {
      mkdirSync(baseDir, { recursive: true });
    }

    this.credentials = this.load();
  }

  private load(): StoredCredentials {
    if (!existsSync(this.credentialsPath)) {
      return {};
    }

    try {
      const data = readFileSync(this.credentialsPath, "utf-8");
      return JSON.parse(data) as StoredCredentials;
    } catch {
      return {};
    }
  }

  private save(): void {
    writeFileSync(
      this.credentialsPath,
      JSON.stringify(this.credentials, null, 2),
      "utf-8",
    );
  }

  // ===== X (Twitter) Credentials =====

  getXCredentials(): XOAuth2Credentials | undefined {
    return this.credentials.x;
  }

  setXCredentials(
    tokens: XOAuth2Tokens,
    username?: string,
  ): XOAuth2Credentials {
    const creds: XOAuth2Credentials = {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt: tokens.expiresAt,
      tokenType: tokens.tokenType,
      scope: tokens.scope,
      username,
    };
    this.credentials.x = creds;
    this.save();
    return creds;
  }

  updateXAccessToken(accessToken: string, expiresAt: number): void {
    if (this.credentials.x) {
      this.credentials.x.accessToken = accessToken;
      this.credentials.x.expiresAt = expiresAt;
      this.save();
    }
  }

  clearXCredentials(): void {
    delete this.credentials.x;
    this.save();
  }

  isXAuthenticated(): boolean {
    return !!this.credentials.x;
  }

  isXTokenExpired(): boolean {
    const creds = this.credentials.x;
    if (!creds) return true;

    // Consider token expired 5 minutes before actual expiry
    const buffer = 5 * 60 * 1000;
    return Date.now() > creds.expiresAt - buffer;
  }

  // ===== Discord Credentials =====

  getDiscordCredentials(): DiscordCredentials | undefined {
    return this.credentials.discord;
  }

  setDiscordCredentials(creds: DiscordCredentials): void {
    this.credentials.discord = creds;
    this.save();
  }

  clearDiscordCredentials(): void {
    delete this.credentials.discord;
    this.save();
  }

  isDiscordAuthenticated(): boolean {
    return !!this.credentials.discord?.botToken;
  }

  // ===== General Methods =====

  clearAll(): void {
    this.credentials = {};
    this.save();
  }
}

// Singleton instance
let instance: CredentialStore | null = null;

export function getCredentialStore(): CredentialStore {
  if (!instance) {
    instance = new CredentialStore();
  }
  return instance;
}
