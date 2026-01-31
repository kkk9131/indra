import type { WebSocket } from "ws";

import { getMemoryContextForSession } from "../../../platform/memory/index.js";
import type {
  AgentChatOptions,
  AgentEvent,
  AgentOptions,
  ContentBlock,
  LLMProvider,
  Message,
  MultimodalMessage,
} from "../../../orchestrator/llm/index.js";
import { createEvent, type RequestFrame } from "../protocol/index.js";
import type { ChatService } from "../services/chat.js";
import type { MemoryService } from "../services/memory.js";

export interface ChatHandlerContext {
  chat: ChatService;
  memory?: MemoryService;
  sendSuccess: (ws: WebSocket, id: string, payload?: unknown) => void;
  sendError: (ws: WebSocket, id: string, code: string, message: string) => void;
  getErrorMessage: (error: unknown) => string;
}

interface ImageParam {
  data: string;
  mediaType: "image/png" | "image/jpeg" | "image/gif" | "image/webp";
}

interface ChatSendParams {
  message: string;
  history?: Message[];
  agentMode?: boolean;
  agentOptions?: AgentOptions;
  images?: ImageParam[];
}

const DEFAULT_AGENT_TOOLS = [
  "Read",
  "Glob",
  "Grep",
  "Bash",
  "WebSearch",
  "Skill",
  "memory_search",
  "memory_get",
  "memory_write",
];

function buildMultimodalMessages(
  history: Message[],
  message: string,
  images: ImageParam[],
): MultimodalMessage[] {
  const contentBlocks: ContentBlock[] = images.map((img) => ({
    type: "image" as const,
    source: {
      type: "base64" as const,
      media_type: img.mediaType,
      data: img.data,
    },
  }));

  contentBlocks.push({
    type: "text",
    text: message,
  });

  return [
    ...history.map((m) => ({ role: m.role, content: m.content })),
    { role: "user" as const, content: contentBlocks },
  ];
}

export async function handleChatSend(
  ctx: ChatHandlerContext,
  ws: WebSocket,
  frame: RequestFrame,
): Promise<void> {
  const requestId = frame.id;
  const params = frame.params as ChatSendParams;
  const abortController = ctx.chat.createAbortController(requestId);

  try {
    const config = ctx.chat.getConfig();
    const provider = ctx.chat.createProvider();
    const systemPrompt = await buildSystemPrompt(config.llm.systemPrompt);
    const baseMessages = buildBaseMessages(
      params.history ?? [],
      params.message,
    );
    const hasImages = params.images && params.images.length > 0;
    const useAgentMode = params.agentMode && provider.chatStreamWithAgent;

    if (useAgentMode) {
      const messages = hasImages
        ? buildMultimodalMessages(
            params.history ?? [],
            params.message,
            params.images!,
          )
        : baseMessages;

      await handleAgentChat(
        ctx,
        ws,
        requestId,
        provider,
        messages,
        systemPrompt,
        params.agentOptions,
        abortController.signal,
      );
    } else {
      await handleSimpleChat(ws, provider, baseMessages, systemPrompt);
    }

    ws.send(JSON.stringify(createEvent("chat.done", {})));
    ctx.sendSuccess(ws, frame.id, { requestId });
  } catch (error) {
    handleChatError(ctx, ws, frame.id, requestId, error);
  } finally {
    ctx.chat.clearAbortController(requestId);
  }
}

async function buildSystemPrompt(basePrompt?: string): Promise<string> {
  const memoryContext = await getMemoryContextForSession();
  if (!memoryContext) {
    return basePrompt ?? "";
  }
  return `${memoryContext}\n\n${basePrompt ?? ""}`;
}

function buildBaseMessages(history: Message[], message: string): Message[] {
  return [...history, { role: "user", content: message }];
}

function handleChatError(
  ctx: ChatHandlerContext,
  ws: WebSocket,
  frameId: string,
  requestId: string,
  error: unknown,
): void {
  if ((error as Error).name === "AbortError") {
    ws.send(
      JSON.stringify(
        createEvent("chat.cancelled", { requestId, reason: "User cancelled" }),
      ),
    );
    ctx.sendSuccess(ws, frameId, { cancelled: true, requestId });
    return;
  }
  console.error("LLM Error:", error);
  ctx.sendError(ws, frameId, "LLM_ERROR", ctx.getErrorMessage(error));
}

export function handleChatCancel(
  ctx: ChatHandlerContext,
  ws: WebSocket,
  frame: RequestFrame,
): void {
  const { requestId } = frame.params as { requestId: string };
  const controller = ctx.chat.getAbortController(requestId);

  if (controller) {
    controller.abort("User cancelled");
    ctx.chat.clearAbortController(requestId);
    ctx.sendSuccess(ws, frame.id, { cancelled: true });
  } else {
    ctx.sendError(ws, frame.id, "NOT_FOUND", "Request not found");
  }
}

export async function handleLLMTest(
  ctx: ChatHandlerContext,
  ws: WebSocket,
  frame: RequestFrame,
): Promise<void> {
  try {
    const provider = ctx.chat.createProvider();

    const testMessages: Message[] = [
      {
        role: "user",
        content: "Hello, please respond with 'OK' if you can hear me.",
      },
    ];

    const response = await provider.chat(testMessages);
    ctx.sendSuccess(ws, frame.id, { success: true, response });
  } catch (error) {
    ctx.sendError(ws, frame.id, "LLM_TEST_FAILED", ctx.getErrorMessage(error));
  }
}

async function handleSimpleChat(
  ws: WebSocket,
  provider: LLMProvider,
  messages: Message[],
  systemPrompt: string,
): Promise<void> {
  const options = { systemPrompt };

  for await (const chunk of provider.chatStream(messages, options)) {
    ws.send(JSON.stringify(createEvent("chat.chunk", { text: chunk })));
  }
}

interface AgentExecutionState {
  executionId: string;
  startTime: number;
  totalTurns: number;
  finalResponse: string;
}

function extractInputText(messages: Message[] | MultimodalMessage[]): string {
  if (messages.length === 0) {
    return "";
  }
  const lastContent = messages[messages.length - 1].content;
  if (typeof lastContent === "string") {
    return lastContent;
  }
  return "[multimodal input]";
}

function createExecutionResult(
  state: AgentExecutionState,
  success: boolean,
): {
  success: boolean;
  totalTurns: number;
  totalTokens: number;
  duration: number;
} {
  return {
    success,
    totalTurns: state.totalTurns,
    totalTokens: 0, // TODO: track token usage
    duration: Date.now() - state.startTime,
  };
}

async function handleAgentChat(
  ctx: ChatHandlerContext,
  ws: WebSocket,
  requestId: string,
  provider: LLMProvider,
  messages: Message[] | MultimodalMessage[],
  systemPrompt: string,
  agentOptions?: AgentOptions,
  signal?: AbortSignal,
): Promise<void> {
  if (!provider.chatStreamWithAgent) {
    throw new Error("Agent mode not supported by this provider");
  }

  const config = ctx.chat.getConfig();
  const maxTurns = agentOptions?.maxTurns ?? 10;
  const tools = agentOptions?.tools ?? DEFAULT_AGENT_TOOLS;
  const permissionMode = agentOptions?.permissionMode ?? "acceptEdits";

  const state: AgentExecutionState = {
    executionId: crypto.randomUUID(),
    startTime: Date.now(),
    totalTurns: 0,
    finalResponse: "",
  };

  ctx.chat.saveExecutionLog(state.executionId, "start", {
    config: { model: config.llm.model, maxTurns, tools, permissionMode },
    input: extractInputText(messages),
  });

  const options: AgentChatOptions = {
    systemPrompt,
    agent: { maxTurns, tools, permissionMode },
    signal,
  };

  try {
    for await (const event of provider.chatStreamWithAgent(messages, options)) {
      const shouldReturn = processAgentEvent(ctx, ws, requestId, state, event);
      if (shouldReturn) {
        return;
      }
    }

    await finalizeAgentExecution(ctx, state, messages);
  } catch (error) {
    ctx.chat.saveExecutionLog(state.executionId, "error", {
      error: {
        code: (error as Error).name ?? "UNKNOWN_ERROR",
        message: (error as Error).message ?? "Unknown error",
      },
      result: createExecutionResult(state, false),
    });
    throw error;
  }
}

function processAgentEvent(
  ctx: ChatHandlerContext,
  ws: WebSocket,
  requestId: string,
  state: AgentExecutionState,
  event: AgentEvent,
): boolean {
  switch (event.type) {
    case "text":
      ws.send(JSON.stringify(createEvent("chat.chunk", { text: event.text })));
      ctx.chat.saveAgentLog("text", { text: event.text });
      return false;

    case "tool_start":
      ws.send(
        JSON.stringify(
          createEvent("agent.tool_start", {
            tool: event.tool,
            input: event.input,
            toolUseId: event.toolUseId,
          }),
        ),
      );
      ctx.chat.saveAgentLog("tool_start", {
        tool: event.tool,
        toolInput: event.input,
      });
      return false;

    case "tool_result":
      ws.send(
        JSON.stringify(
          createEvent("agent.tool_result", {
            tool: event.tool,
            result: event.result,
            toolUseId: event.toolUseId,
          }),
        ),
      );
      ctx.chat.saveAgentLog("tool_result", {
        tool: event.tool,
        toolResult: event.result,
      });
      return false;

    case "turn_complete":
      state.totalTurns = event.turnNumber;
      ws.send(
        JSON.stringify(
          createEvent("agent.turn_complete", { turnNumber: event.turnNumber }),
        ),
      );
      ctx.chat.saveAgentLog("turn_complete", { turnNumber: event.turnNumber });
      return false;

    case "cancelled":
      ws.send(
        JSON.stringify(
          createEvent("chat.cancelled", { requestId, reason: event.reason }),
        ),
      );
      ctx.chat.saveExecutionLog(state.executionId, "end", {
        result: createExecutionResult(state, false),
      });
      return true;

    case "done":
      state.finalResponse = event.result ?? "";
      return false;
  }
}

async function finalizeAgentExecution(
  ctx: ChatHandlerContext,
  state: AgentExecutionState,
  messages: Message[] | MultimodalMessage[],
): Promise<void> {
  if (state.finalResponse) {
    const outcomeId = crypto.randomUUID();
    ctx.chat.saveOutcomeLog(outcomeId, state.executionId, "chat", "final", {
      finalResponse: state.finalResponse,
    });
  }

  ctx.chat.saveExecutionLog(state.executionId, "end", {
    result: createExecutionResult(state, true),
  });

  if (state.finalResponse && ctx.memory) {
    await extractAndSaveMemory(messages, state.finalResponse, ctx);
  }
}

/**
 * Extract important information from conversation and save to memory
 */
async function extractAndSaveMemory(
  messages: Message[] | MultimodalMessage[],
  finalResponse: string,
  ctx: ChatHandlerContext,
): Promise<void> {
  if (!ctx.memory) {
    return;
  }

  try {
    const conversationText = formatConversation(messages);
    const extractionPrompt = buildExtractionPrompt(
      conversationText,
      finalResponse,
    );

    const provider = ctx.chat.createProvider();
    const extracted = await provider.chat(
      [{ role: "user", content: extractionPrompt }],
      { model: "haiku" },
    );

    await saveExtractedMemory(ctx, extracted);
  } catch (error) {
    // Memory save errors are non-fatal
    console.error("[Memory] Failed to extract and save memory:", error);
  }
}

function formatConversation(messages: Message[] | MultimodalMessage[]): string {
  return messages
    .map((m) => {
      const content =
        typeof m.content === "string"
          ? m.content
          : m.content.map((c) => ("text" in c ? c.text : "[image]")).join(" ");
      return `${m.role}: ${content}`;
    })
    .join("\n");
}

function buildExtractionPrompt(
  conversationText: string,
  finalResponse: string,
): string {
  return `以下の会話から、長期記憶として保存すべき重要な情報を抽出してください。
保存すべき情報の例：
- ユーザーの名前、好み、設定
- 重要な決定事項やルール
- 学習した知識やコンテキスト

会話:
${conversationText}

アシスタントの最終回答:
${finalResponse}

抽出結果を以下の形式で出力してください。保存すべき情報がない場合は「なし」と出力してください。

## 抽出した情報
`;
}

async function saveExtractedMemory(
  ctx: ChatHandlerContext,
  extracted: string,
): Promise<void> {
  const trimmed = extracted.trim();
  const hasValidContent =
    trimmed && !trimmed.includes("なし") && trimmed.length > 10;

  if (!hasValidContent || !ctx.memory) {
    return;
  }

  const timestamp = new Date().toISOString().split("T")[0];
  const memoryEntry = `\n\n## ${timestamp} - 自動抽出\n${trimmed}`;
  await ctx.memory.write(memoryEntry, { append: true });
  console.log("[Memory] Extracted and saved memory:", trimmed.slice(0, 100));
}
