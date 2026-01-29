import type { WebSocket } from "ws";

import { createEvent, type RequestFrame } from "../protocol/index.js";
import type {
  AgentChatOptions,
  AgentOptions,
  ContentBlock,
  LLMProvider,
  Message,
  MultimodalMessage,
} from "../../llm/index.js";
import type { ChatService } from "../services/chat.js";
import { getMemoryContextForSession } from "../../memory/index.js";

export interface ChatHandlerContext {
  chat: ChatService;
  sendSuccess: (ws: WebSocket, id: string, payload?: unknown) => void;
  sendError: (ws: WebSocket, id: string, code: string, message: string) => void;
  getErrorMessage: (error: unknown) => string;
}

const DEFAULT_AGENT_TOOLS = [
  "Read",
  "Glob",
  "Grep",
  "Bash",
  "WebSearch",
  "Skill",
];

type ImageParam = {
  data: string;
  mediaType: "image/png" | "image/jpeg" | "image/gif" | "image/webp";
};

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

  try {
    const params = frame.params as {
      message: string;
      history?: Message[];
      agentMode?: boolean;
      agentOptions?: AgentOptions;
      images?: ImageParam[];
    };

    const config = ctx.chat.getConfig();
    const provider = ctx.chat.createProvider();

    // Create AbortController for this request
    const abortController = ctx.chat.createAbortController(requestId);

    // Get memory context and build system prompt
    const memoryContext = await getMemoryContextForSession();
    const systemPrompt = memoryContext
      ? `${memoryContext}\n\n${config.llm.systemPrompt ?? ""}`
      : (config.llm.systemPrompt ?? "");

    // Build messages with optional images
    const hasImages = params.images && params.images.length > 0;
    const baseMessages: Message[] = [
      ...(params.history ?? []),
      { role: "user", content: params.message },
    ];

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
    if ((error as Error).name === "AbortError") {
      ws.send(
        JSON.stringify(
          createEvent("chat.cancelled", {
            requestId,
            reason: "User cancelled",
          }),
        ),
      );
      ctx.sendSuccess(ws, frame.id, { cancelled: true, requestId });
    } else {
      console.error("LLM Error:", error);
      ctx.sendError(ws, frame.id, "LLM_ERROR", ctx.getErrorMessage(error));
    }
  } finally {
    ctx.chat.clearAbortController(requestId);
  }
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

  const executionId = crypto.randomUUID();
  const startTime = Date.now();
  let totalTurns = 0;
  let wasCancelled = false;
  let finalResponse = "";

  const config = ctx.chat.getConfig();
  const maxTurns = agentOptions?.maxTurns ?? 10;
  const tools = agentOptions?.tools ?? DEFAULT_AGENT_TOOLS;
  const permissionMode = agentOptions?.permissionMode ?? "acceptEdits";

  // Extract input text from messages
  const inputText =
    messages.length > 0
      ? typeof messages[messages.length - 1].content === "string"
        ? (messages[messages.length - 1].content as string)
        : "[multimodal input]"
      : "";

  // Log execution start
  ctx.chat.saveExecutionLog(executionId, "start", {
    config: {
      model: config.llm.model,
      maxTurns,
      tools,
      permissionMode,
    },
    input: inputText,
  });

  const options: AgentChatOptions = {
    systemPrompt,
    agent: {
      maxTurns,
      tools,
      permissionMode,
    },
    signal,
  };

  try {
    for await (const event of provider.chatStreamWithAgent(messages, options)) {
      switch (event.type) {
        case "text":
          ws.send(
            JSON.stringify(createEvent("chat.chunk", { text: event.text })),
          );
          ctx.chat.saveAgentLog("text", { text: event.text });
          break;
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
          break;
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
          break;
        case "turn_complete":
          totalTurns = event.turnNumber;
          ws.send(
            JSON.stringify(
              createEvent("agent.turn_complete", {
                turnNumber: event.turnNumber,
              }),
            ),
          );
          ctx.chat.saveAgentLog("turn_complete", {
            turnNumber: event.turnNumber,
          });
          break;
        case "cancelled":
          wasCancelled = true;
          ws.send(
            JSON.stringify(
              createEvent("chat.cancelled", {
                requestId,
                reason: event.reason,
              }),
            ),
          );
          // Log execution end (cancelled)
          ctx.chat.saveExecutionLog(executionId, "end", {
            result: {
              success: false,
              totalTurns,
              totalTokens: 0, // TODO: track token usage
              duration: Date.now() - startTime,
            },
          });
          return;
        case "done":
          finalResponse = event.result ?? "";
          break;
      }
    }

    // Log execution end (success)
    if (!wasCancelled) {
      // Save chat outcome log before execution end
      if (finalResponse) {
        const outcomeId = crypto.randomUUID();
        ctx.chat.saveOutcomeLog(outcomeId, executionId, "chat", "final", {
          finalResponse,
        });
      }

      ctx.chat.saveExecutionLog(executionId, "end", {
        result: {
          success: true,
          totalTurns,
          totalTokens: 0, // TODO: track token usage
          duration: Date.now() - startTime,
        },
      });
    }
  } catch (error) {
    // Log execution error
    ctx.chat.saveExecutionLog(executionId, "error", {
      error: {
        code: (error as Error).name ?? "UNKNOWN_ERROR",
        message: (error as Error).message ?? "Unknown error",
      },
      result: {
        success: false,
        totalTurns,
        totalTokens: 0,
        duration: Date.now() - startTime,
      },
    });
    throw error;
  }
}
