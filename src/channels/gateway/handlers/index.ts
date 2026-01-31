import type { Config } from "../../../platform/config/index.js";

import { handleNewsList, handleNewsRefresh } from "./news.js";
import { handleChatCancel, handleChatSend, handleLLMTest } from "./chat.js";
import {
  handleScheduleList,
  handleScheduleGet,
  handleScheduleCreate,
  handleScheduleUpdate,
  handleScheduleDelete,
  handleScheduleToggle,
  handleScheduleRunNow,
  handleScheduleTaskTypes,
} from "./schedule.js";
import {
  handlePostCreate,
  handlePostList,
  handlePostApprove,
  handlePostReject,
  handlePostEdit,
  handlePostAdd,
  handlePostSchedule,
} from "./post.js";
import {
  handleAuthXStart,
  handleAuthXCallback,
  handleAuthXStatus,
  handleAuthXLogout,
  handleAuthDiscordStatus,
} from "./auth.js";
import { handleLogsList, handleLogsRefresh } from "./logs.js";
import { handleAnalyticsRunNow } from "./analytics.js";
import {
  handleNewsSourceList,
  handleNewsSourceGet,
  handleNewsSourceCreate,
  handleNewsSourceUpdate,
  handleNewsSourceDelete,
  handleNewsSourceToggle,
  handleNewsSourceFetchNow,
} from "./news-source.js";
import { handleXpostGenerate } from "./xpost.js";
import {
  handleSessionsList,
  handleSessionsGet,
  handleSessionsCreate,
  handleSessionsDelete,
  handleSessionsUpdateTitle,
  handleChatHistory,
} from "./session.js";
import {
  handleMemorySearch,
  handleMemoryGet,
  handleMemoryWrite,
  handleMemoryStats,
  handleMemoryIndex,
  handleMemoryDelete,
} from "./memory.js";
import {
  handleEvalTaskList,
  handleEvalTaskGet,
  handleEvalTaskCreate,
  handleEvalTaskUpdate,
  handleEvalTaskDelete,
  handleEvalTrialList,
  handleEvalTrialGet,
  handleEvalRun,
  handleEvalMetrics,
  handleEvalGraderStatus,
} from "./evaluation.js";
import type { GatewayContext, RequestHandler } from "./context.js";

export type { GatewayContext, RequestHandler } from "./context.js";

export function createHandlerRegistry(
  ctx: GatewayContext,
): Map<string, RequestHandler> {
  const newsCtx = {
    news: ctx.services.news,
    sendSuccess: ctx.sendSuccess,
  };

  const scheduleCtx = {
    schedule: ctx.services.schedule,
    sendSuccess: ctx.sendSuccess,
    sendError: ctx.sendError,
    getErrorMessage: ctx.getErrorMessage,
  };

  const postCtx = {
    post: ctx.services.post,
    broadcast: ctx.broadcast,
    sendSuccess: ctx.sendSuccess,
    sendError: ctx.sendError,
  };

  const authCtx = {
    auth: ctx.services.auth,
    sendSuccess: ctx.sendSuccess,
    sendError: ctx.sendError,
  };

  const logsCtx = {
    logs: ctx.services.logs,
    sendSuccess: ctx.sendSuccess,
    sendError: ctx.sendError,
    getErrorMessage: ctx.getErrorMessage,
  };

  const analyticsCtx = {
    analytics: ctx.services.analytics,
    sendSuccess: ctx.sendSuccess,
    sendError: ctx.sendError,
    getErrorMessage: ctx.getErrorMessage,
  };

  const newsSourceCtx = {
    newsSource: ctx.services.newsSource,
    broadcast: ctx.broadcast,
    sendSuccess: ctx.sendSuccess,
    sendError: ctx.sendError,
    getErrorMessage: ctx.getErrorMessage,
  };

  const xpostCtx = {
    xpost: ctx.services.xpost,
    broadcast: ctx.broadcast,
    sendSuccess: ctx.sendSuccess,
    sendError: ctx.sendError,
  };

  const chatCtx = {
    chat: ctx.services.chat,
    memory: ctx.services.memory,
    sendSuccess: ctx.sendSuccess,
    sendError: ctx.sendError,
    getErrorMessage: ctx.getErrorMessage,
  };

  const sessionCtx = {
    session: ctx.services.session,
    sendSuccess: ctx.sendSuccess,
    sendError: ctx.sendError,
    getErrorMessage: ctx.getErrorMessage,
  };

  const memoryCtx = ctx.services.memory
    ? {
        memory: ctx.services.memory,
        sendSuccess: ctx.sendSuccess,
        sendError: ctx.sendError,
        getErrorMessage: ctx.getErrorMessage,
      }
    : null;

  const evaluationCtx = {
    evaluation: ctx.services.evaluation,
    sendSuccess: ctx.sendSuccess,
    sendError: ctx.sendError,
    getErrorMessage: ctx.getErrorMessage,
  };

  return new Map<string, RequestHandler>([
    [
      "ping",
      (ws, frame) => ctx.sendSuccess(ws, frame.id, { pong: Date.now() }),
    ],
    ["chat.send", (ws, frame) => handleChatSend(chatCtx, ws, frame)],
    ["chat.cancel", (ws, frame) => handleChatCancel(chatCtx, ws, frame)],
    [
      "config.get",
      (ws, frame) =>
        ctx.sendSuccess(ws, frame.id, { config: ctx.services.config.get() }),
    ],
    [
      "config.set",
      (ws, frame) => {
        try {
          const configUpdate = frame.params as Partial<Config>;
          ctx.services.config.set(configUpdate);
          ctx.sendSuccess(ws, frame.id, { config: ctx.services.config.get() });
        } catch (error) {
          ctx.sendError(
            ws,
            frame.id,
            "CONFIG_ERROR",
            ctx.getErrorMessage(error),
          );
        }
      },
    ],
    ["llm.test", (ws, frame) => handleLLMTest(chatCtx, ws, frame)],
    ["post.create", (ws, frame) => handlePostCreate(postCtx, ws, frame)],
    ["post.list", (ws, frame) => handlePostList(postCtx, ws, frame)],
    ["post.approve", (ws, frame) => handlePostApprove(postCtx, ws, frame)],
    ["post.reject", (ws, frame) => handlePostReject(postCtx, ws, frame)],
    ["post.edit", (ws, frame) => handlePostEdit(postCtx, ws, frame)],
    ["post.add", (ws, frame) => handlePostAdd(postCtx, ws, frame)],
    ["post.schedule", (ws, frame) => handlePostSchedule(postCtx, ws, frame)],
    ["auth.x.start", (ws, frame) => handleAuthXStart(authCtx, ws, frame)],
    ["auth.x.callback", (ws, frame) => handleAuthXCallback(authCtx, ws, frame)],
    ["auth.x.status", (ws, frame) => handleAuthXStatus(authCtx, ws, frame)],
    ["auth.x.logout", (ws, frame) => handleAuthXLogout(authCtx, ws, frame)],
    [
      "auth.discord.status",
      (ws, frame) => handleAuthDiscordStatus(authCtx, ws, frame),
    ],
    ["news.list", (ws, frame) => handleNewsList(newsCtx, ws, frame)],
    ["news.refresh", (ws, frame) => handleNewsRefresh(newsCtx, ws, frame)],
    ["logs.list", (ws, frame) => handleLogsList(logsCtx, ws, frame)],
    ["logs.refresh", (ws, frame) => handleLogsRefresh(logsCtx, ws, frame)],
    [
      "analytics.runNow",
      (ws, frame) => handleAnalyticsRunNow(analyticsCtx, ws, frame),
    ],
    [
      "schedule.list",
      (ws, frame) => handleScheduleList(scheduleCtx, ws, frame),
    ],
    ["schedule.get", (ws, frame) => handleScheduleGet(scheduleCtx, ws, frame)],
    [
      "schedule.create",
      (ws, frame) => handleScheduleCreate(scheduleCtx, ws, frame),
    ],
    [
      "schedule.update",
      (ws, frame) => handleScheduleUpdate(scheduleCtx, ws, frame),
    ],
    [
      "schedule.delete",
      (ws, frame) => handleScheduleDelete(scheduleCtx, ws, frame),
    ],
    [
      "schedule.toggle",
      (ws, frame) => handleScheduleToggle(scheduleCtx, ws, frame),
    ],
    [
      "schedule.runNow",
      (ws, frame) => handleScheduleRunNow(scheduleCtx, ws, frame),
    ],
    [
      "schedule.taskTypes",
      (ws, frame) => handleScheduleTaskTypes(scheduleCtx, ws, frame),
    ],
    [
      "newsSource.list",
      (ws, frame) => handleNewsSourceList(newsSourceCtx, ws, frame),
    ],
    [
      "newsSource.get",
      (ws, frame) => handleNewsSourceGet(newsSourceCtx, ws, frame),
    ],
    [
      "newsSource.create",
      (ws, frame) => handleNewsSourceCreate(newsSourceCtx, ws, frame),
    ],
    [
      "newsSource.update",
      (ws, frame) => handleNewsSourceUpdate(newsSourceCtx, ws, frame),
    ],
    [
      "newsSource.delete",
      (ws, frame) => handleNewsSourceDelete(newsSourceCtx, ws, frame),
    ],
    [
      "newsSource.toggle",
      (ws, frame) => handleNewsSourceToggle(newsSourceCtx, ws, frame),
    ],
    [
      "newsSource.fetchNow",
      (ws, frame) => handleNewsSourceFetchNow(newsSourceCtx, ws, frame),
    ],
    ["xpost.generate", (ws, frame) => handleXpostGenerate(xpostCtx, ws, frame)],
    ["sessions.list", (ws, frame) => handleSessionsList(sessionCtx, ws, frame)],
    ["sessions.get", (ws, frame) => handleSessionsGet(sessionCtx, ws, frame)],
    [
      "sessions.create",
      (ws, frame) => handleSessionsCreate(sessionCtx, ws, frame),
    ],
    [
      "sessions.delete",
      (ws, frame) => handleSessionsDelete(sessionCtx, ws, frame),
    ],
    [
      "sessions.updateTitle",
      (ws, frame) => handleSessionsUpdateTitle(sessionCtx, ws, frame),
    ],
    ["chat.history", (ws, frame) => handleChatHistory(sessionCtx, ws, frame)],
    // Memory handlers (if available)
    ...(memoryCtx
      ? ([
          [
            "memory.search",
            (ws, frame) => handleMemorySearch(memoryCtx, ws, frame),
          ],
          ["memory.get", (ws, frame) => handleMemoryGet(memoryCtx, ws, frame)],
          [
            "memory.write",
            (ws, frame) => handleMemoryWrite(memoryCtx, ws, frame),
          ],
          [
            "memory.stats",
            (ws, frame) => handleMemoryStats(memoryCtx, ws, frame),
          ],
          [
            "memory.index",
            (ws, frame) => handleMemoryIndex(memoryCtx, ws, frame),
          ],
          [
            "memory.delete",
            (ws, frame) => handleMemoryDelete(memoryCtx, ws, frame),
          ],
        ] as [string, RequestHandler][])
      : []),
    // Evaluation handlers
    [
      "eval.task.list",
      (ws, frame) => handleEvalTaskList(evaluationCtx, ws, frame),
    ],
    [
      "eval.task.get",
      (ws, frame) => handleEvalTaskGet(evaluationCtx, ws, frame),
    ],
    [
      "eval.task.create",
      (ws, frame) => handleEvalTaskCreate(evaluationCtx, ws, frame),
    ],
    [
      "eval.task.update",
      (ws, frame) => handleEvalTaskUpdate(evaluationCtx, ws, frame),
    ],
    [
      "eval.task.delete",
      (ws, frame) => handleEvalTaskDelete(evaluationCtx, ws, frame),
    ],
    [
      "eval.trial.list",
      (ws, frame) => handleEvalTrialList(evaluationCtx, ws, frame),
    ],
    [
      "eval.trial.get",
      (ws, frame) => handleEvalTrialGet(evaluationCtx, ws, frame),
    ],
    ["eval.run", (ws, frame) => handleEvalRun(evaluationCtx, ws, frame)],
    [
      "eval.metrics",
      (ws, frame) => handleEvalMetrics(evaluationCtx, ws, frame),
    ],
    [
      "eval.grader.status",
      (ws, frame) => handleEvalGraderStatus(evaluationCtx, ws, frame),
    ],
  ]);
}
