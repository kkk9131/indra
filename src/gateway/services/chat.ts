import type { Config, ConfigManager } from "../../config/index.js";
import type { LLMProvider } from "../../llm/index.js";
import type { AgentActionType } from "../../logs/index.js";

export interface AgentLogParams {
  tool?: string;
  toolInput?: unknown;
  toolResult?: string;
  turnNumber?: number;
  text?: string;
}

export interface ChatService {
  getConfig: () => Config;
  createProvider: () => LLMProvider;
  createAbortController: (requestId: string) => AbortController;
  getAbortController: (requestId: string) => AbortController | undefined;
  clearAbortController: (requestId: string) => void;
  saveAgentLog: (action: AgentActionType, params: AgentLogParams) => void;
}

interface ChatServiceDeps {
  configManager: ConfigManager;
  createLLMProvider: (config: Config["llm"]) => LLMProvider;
  saveAgentLog: (action: AgentActionType, params: AgentLogParams) => void;
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
  };
}
