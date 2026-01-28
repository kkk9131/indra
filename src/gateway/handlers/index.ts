import type { Config } from "../../config/index.js";

import {
  handleNewsList,
  handleNewsRefresh,
} from "./news.js";
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
import type { GatewayContext, RequestHandler } from "./context.js";

export type { GatewayContext, RequestHandler } from "./context.js";

export function createHandlerRegistry(
  ctx: GatewayContext,
): Map<string, RequestHandler> {
  const newsCtx = {
    newsStore: ctx.newsStore,
    newsScheduler: ctx.newsScheduler,
    sendSuccess: ctx.sendSuccess,
  };

  const scheduleCtx = {
    schedulerManager: ctx.schedulerManager,
    sendSuccess: ctx.sendSuccess,
    sendError: ctx.sendError,
    getErrorMessage: ctx.getErrorMessage,
  };

  const postCtx = {
    configManager: ctx.configManager,
    approvalQueue: ctx.approvalQueue,
    credentialStore: ctx.credentialStore,
    xConnector: ctx.xConnector,
    createLLMProvider: ctx.createLLMProvider,
    broadcast: ctx.broadcast,
    sendSuccess: ctx.sendSuccess,
    sendError: ctx.sendError,
    getErrorMessage: ctx.getErrorMessage,
  };

  const authCtx = {
    credentialStore: ctx.credentialStore,
    xOAuth2Handler: ctx.xOAuth2Handler,
    xConnector: ctx.xConnector,
    discordBot: ctx.discordBot,
    isDiscordBotReady: ctx.isDiscordBotReady,
    sendSuccess: ctx.sendSuccess,
    sendError: ctx.sendError,
    getErrorMessage: ctx.getErrorMessage,
  };

  const logsCtx = {
    logStore: ctx.logStore,
    sendSuccess: ctx.sendSuccess,
    sendError: ctx.sendError,
    getErrorMessage: ctx.getErrorMessage,
  };

  const analyticsCtx = {
    analyticsScheduler: ctx.analyticsScheduler,
    sendSuccess: ctx.sendSuccess,
    sendError: ctx.sendError,
    getErrorMessage: ctx.getErrorMessage,
  };

  return new Map<string, RequestHandler>([
    [
      "ping",
      (ws, frame) => ctx.sendSuccess(ws, frame.id, { pong: Date.now() }),
    ],
    ["chat.send", ctx.handlers.handleChatSend],
    [
      "config.get",
      (ws, frame) =>
        ctx.sendSuccess(ws, frame.id, { config: ctx.configManager.get() }),
    ],
    [
      "config.set",
      (ws, frame) => {
        try {
          const configUpdate = frame.params as Partial<Config>;
          ctx.configManager.set(configUpdate);
          ctx.sendSuccess(ws, frame.id, { config: ctx.configManager.get() });
        } catch (error) {
          ctx.sendError(ws, frame.id, "CONFIG_ERROR", ctx.getErrorMessage(error));
        }
      },
    ],
    ["llm.test", ctx.handlers.handleLLMTest],
    ["post.create", (ws, frame) => handlePostCreate(postCtx, ws, frame)],
    ["post.list", (ws, frame) => handlePostList(postCtx, ws, frame)],
    ["post.approve", (ws, frame) => handlePostApprove(postCtx, ws, frame)],
    ["post.reject", (ws, frame) => handlePostReject(postCtx, ws, frame)],
    ["post.edit", (ws, frame) => handlePostEdit(postCtx, ws, frame)],
    ["auth.x.start", (ws, frame) => handleAuthXStart(authCtx, ws, frame)],
    [
      "auth.x.callback",
      (ws, frame) => handleAuthXCallback(authCtx, ws, frame),
    ],
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
    [
      "schedule.get",
      (ws, frame) => handleScheduleGet(scheduleCtx, ws, frame),
    ],
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
    ["newsSource.list", ctx.handlers.handleNewsSourceList],
    ["newsSource.get", ctx.handlers.handleNewsSourceGet],
    ["newsSource.create", ctx.handlers.handleNewsSourceCreate],
    ["newsSource.update", ctx.handlers.handleNewsSourceUpdate],
    ["newsSource.delete", ctx.handlers.handleNewsSourceDelete],
    ["newsSource.toggle", ctx.handlers.handleNewsSourceToggle],
    ["newsSource.fetchNow", ctx.handlers.handleNewsSourceFetchNow],
    ["xpost.generate", ctx.handlers.handleXpostGenerate],
  ]);
}
