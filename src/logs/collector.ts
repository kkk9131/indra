import type { LogEntry, AgentActionType } from "./types.js";

export interface LogCollectorOptions {
  sessionId: string;
  maxLength?: number;
}

export class LogCollector {
  private logs: LogEntry[] = [];
  private options: Required<LogCollectorOptions>;
  private currentSessionId: string;

  constructor(
    options: LogCollectorOptions = { sessionId: "default", maxLength: 1000 },
  ) {
    this.options = {
      sessionId: options.sessionId,
      maxLength: options.maxLength ?? 1000,
    };
    this.currentSessionId = options.sessionId;
  }

  setSessionId(sessionId: string): void {
    this.currentSessionId = sessionId;
  }

  addEntry(entry: Omit<LogEntry, "id" | "timestamp">): LogEntry {
    const logEntry: LogEntry = {
      ...entry,
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      sessionId: entry.sessionId ?? this.currentSessionId,
    };

    this.logs.push(logEntry);

    if (this.logs.length > this.options.maxLength) {
      this.logs = this.logs.slice(-this.options.maxLength);
    }

    return logEntry;
  }

  addAgentLog(
    action: AgentActionType,
    tool?: string,
    toolInput?: unknown,
    toolResult?: string,
    turnNumber?: number,
    text?: string,
  ): LogEntry {
    return this.addEntry({
      type: "agent",
      agentAction: action,
      tool,
      toolInput,
      toolResult,
      turnNumber,
      text,
    });
  }

  addPromptLog(prompt: string, response: string, model?: string): LogEntry {
    return this.addEntry({
      type: "prompt",
      prompt,
      response,
      model,
    });
  }

  addSystemLog(level: "info" | "warn" | "error", message: string): LogEntry {
    return this.addEntry({
      type: "system",
      level,
      message,
    });
  }

  getLogs(): LogEntry[] {
    return [...this.logs];
  }

  getLogsByType(type: "agent" | "prompt" | "system"): LogEntry[] {
    return this.logs.filter((log) => log.type === type);
  }

  getLogsBySessionId(sessionId: string): LogEntry[] {
    return this.logs.filter((log) => log.sessionId === sessionId);
  }

  clear(): void {
    this.logs = [];
  }

  setMaxLength(maxLength: number): void {
    this.options.maxLength = maxLength;
    if (this.logs.length > maxLength) {
      this.logs = this.logs.slice(-maxLength);
    }
  }

  getSessionId(): string {
    return this.currentSessionId;
  }
}
