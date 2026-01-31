import type { WebSocket } from "ws";

import type { RequestFrame } from "../protocol/index.js";
import type { GatewayServices } from "../services/index.js";

export type RequestHandler = (
  ws: WebSocket,
  frame: RequestFrame,
) => Promise<void> | void;

export interface GatewayContext {
  services: GatewayServices;
  broadcast: (event: string, payload: unknown) => void;
  sendSuccess: (ws: WebSocket, id: string, payload?: unknown) => void;
  sendError: (ws: WebSocket, id: string, code: string, message: string) => void;
  getErrorMessage: (error: unknown) => string;
}
