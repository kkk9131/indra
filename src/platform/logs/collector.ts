import type {
  LogEntry,
  LogType,
  AgentActionType,
  ExecutionAction,
  ExecutionConfig,
  ExecutionResult,
  ExecutionError,
  OutcomeType,
  OutcomeStage,
  OutcomeContent,
  ApiMethod,
  ApprovalAction,
  LogError,
  ApprovalContent,
  SchedulerAction,
  BrowserAction,
  AuthAction,
  MemoryAction,
  UserAction,
} from "./types.js";

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

  addExecutionLog(
    executionId: string,
    action: ExecutionAction,
    params: {
      config?: ExecutionConfig;
      input?: string;
      result?: ExecutionResult;
      error?: ExecutionError;
    } = {},
  ): LogEntry {
    return this.addEntry({
      type: "execution",
      executionId,
      executionAction: action,
      executionConfig: params.config,
      input: params.input,
      executionResult: params.result,
      executionError: params.error,
    });
  }

  addOutcomeLog(
    outcomeId: string,
    executionId: string,
    outcomeType: OutcomeType,
    stage: OutcomeStage,
    content: OutcomeContent,
    previousOutcomeId?: string,
    metadata?: Record<string, unknown>,
  ): LogEntry {
    return this.addEntry({
      type: "outcome",
      outcomeId,
      executionId,
      outcomeType,
      outcomeStage: stage,
      outcomeContent: content,
      previousOutcomeId,
      metadata,
    });
  }

  addApiLog(params: {
    service: string;
    endpoint: string;
    method: ApiMethod;
    requestData?: unknown;
    responseStatus?: number;
    responseData?: unknown;
    duration?: number;
    error?: LogError;
  }): LogEntry {
    return this.addEntry({
      type: "api",
      apiService: params.service,
      apiEndpoint: params.endpoint,
      apiMethod: params.method,
      apiRequestData: params.requestData,
      apiResponseStatus: params.responseStatus,
      apiResponseData: params.responseData,
      apiDuration: params.duration,
      apiError: params.error,
    });
  }

  addApprovalLog(params: {
    approvalId: string;
    action: ApprovalAction;
    platform?: string;
    content?: ApprovalContent;
    approvedBy?: string;
    reason?: string;
  }): LogEntry {
    return this.addEntry({
      type: "approval",
      approvalId: params.approvalId,
      approvalAction: params.action,
      approvalPlatform: params.platform,
      approvalContent: params.content,
      approvalBy: params.approvedBy,
      approvalReason: params.reason,
    });
  }

  addSchedulerLog(params: {
    taskId: string;
    taskType?: string;
    taskName?: string;
    action: SchedulerAction;
    cronExpression?: string;
    duration?: number;
    nextRunAt?: string;
    error?: LogError;
  }): LogEntry {
    return this.addEntry({
      type: "scheduler",
      schedulerTaskId: params.taskId,
      schedulerTaskType: params.taskType,
      schedulerTaskName: params.taskName,
      schedulerAction: params.action,
      schedulerCronExpression: params.cronExpression,
      schedulerDuration: params.duration,
      schedulerNextRunAt: params.nextRunAt,
      schedulerError: params.error,
    });
  }

  addBrowserLog(params: {
    action: BrowserAction;
    session?: string;
    url?: string;
    selector?: string;
    input?: string;
    duration?: number;
    error?: LogError;
  }): LogEntry {
    return this.addEntry({
      type: "browser",
      browserAction: params.action,
      browserSession: params.session,
      browserUrl: params.url,
      browserSelector: params.selector,
      browserInput: params.input,
      browserDuration: params.duration,
      browserError: params.error,
    });
  }

  addAuthLog(params: {
    action: AuthAction;
    provider?: string;
    userId?: string;
    scopes?: string[];
    expiresAt?: string;
    error?: LogError;
  }): LogEntry {
    return this.addEntry({
      type: "auth",
      authAction: params.action,
      authProvider: params.provider,
      authUserId: params.userId,
      authScopes: params.scopes,
      authExpiresAt: params.expiresAt,
      authError: params.error,
    });
  }

  addMemoryLog(params: {
    action: MemoryAction;
    filePath?: string;
    chunkCount?: number;
    tokenCount?: number;
    query?: string;
    resultCount?: number;
    duration?: number;
  }): LogEntry {
    return this.addEntry({
      type: "memory",
      memoryAction: params.action,
      memoryFilePath: params.filePath,
      memoryChunkCount: params.chunkCount,
      memoryTokenCount: params.tokenCount,
      memoryQuery: params.query,
      memoryResultCount: params.resultCount,
      memoryDuration: params.duration,
    });
  }

  addUserLog(params: {
    action: UserAction;
    channel?: string;
    input?: string;
    command?: string;
    response?: string;
  }): LogEntry {
    return this.addEntry({
      type: "user",
      userAction: params.action,
      userChannel: params.channel,
      userInput: params.input,
      userCommand: params.command,
      userResponse: params.response,
    });
  }

  getLogs(): LogEntry[] {
    return [...this.logs];
  }

  getLogsByType(type: LogType): LogEntry[] {
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
