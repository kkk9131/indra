import type { Config, ConfigManager } from "../../../platform/config/index.js";
import type { LLMProvider } from "../../../orchestrator/llm/index.js";
import type {
  AgentActionType,
  ExecutionAction,
  ExecutionConfig,
  ExecutionError,
  ExecutionResult,
  OutcomeContent,
  OutcomeStage,
  OutcomeType,
} from "../../../platform/logs/index.js";

export interface AgentLogParams {
  tool?: string;
  toolInput?: unknown;
  toolResult?: string;
  turnNumber?: number;
  text?: string;
}

export interface ExecutionLogParams {
  config?: ExecutionConfig;
  input?: string;
  result?: ExecutionResult;
  error?: ExecutionError;
}

export interface ChatService {
  getConfig: () => Config;
  createProvider: () => LLMProvider;
  createAbortController: (requestId: string) => AbortController;
  getAbortController: (requestId: string) => AbortController | undefined;
  clearAbortController: (requestId: string) => void;
  saveAgentLog: (action: AgentActionType, params: AgentLogParams) => void;
  saveExecutionLog: (
    executionId: string,
    action: ExecutionAction,
    params: ExecutionLogParams,
  ) => void;
  saveOutcomeLog: (
    outcomeId: string,
    executionId: string,
    outcomeType: OutcomeType,
    stage: OutcomeStage,
    content: OutcomeContent,
  ) => void;
}

interface ChatServiceDeps {
  configManager: ConfigManager;
  createLLMProvider: (config: Config["llm"]) => LLMProvider;
  saveAgentLog: (action: AgentActionType, params: AgentLogParams) => void;
  saveExecutionLog: (
    executionId: string,
    action: ExecutionAction,
    params: ExecutionLogParams,
  ) => void;
  saveOutcomeLog: (
    outcomeId: string,
    executionId: string,
    outcomeType: OutcomeType,
    stage: OutcomeStage,
    content: OutcomeContent,
  ) => void;
}

export function createChatService(deps: ChatServiceDeps): ChatService {
  const abortControllers = new Map<string, AbortController>();

  return {
    getConfig: () => deps.configManager.get(),
    createProvider: () => deps.createLLMProvider(deps.configManager.get().llm),
    createAbortController: (requestId) => {
      const controller = new AbortController();
      abortControllers.set(requestId, controller);
      return controller;
    },
    getAbortController: (requestId) => abortControllers.get(requestId),
    clearAbortController: (requestId) => {
      abortControllers.delete(requestId);
    },
    saveAgentLog: deps.saveAgentLog,
    saveExecutionLog: deps.saveExecutionLog,
    saveOutcomeLog: deps.saveOutcomeLog,
  };
}
