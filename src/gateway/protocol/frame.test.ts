import { describe, it, expect } from "vitest";
import {
  FrameSchema,
  createResponse,
  createEvent,
  createRequest,
} from "./frame.js";

describe("frame", () => {
  describe("FrameSchema", () => {
    it("validates request frames", () => {
      const frame = {
        type: "req" as const,
        id: crypto.randomUUID(),
        method: "chat.send",
        params: { text: "hello" },
      };

      const result = FrameSchema.safeParse(frame);
      expect(result.success).toBe(true);
    });

    it("validates response frames", () => {
      const frame = {
        type: "res" as const,
        id: crypto.randomUUID(),
        ok: true,
        payload: { message: "success" },
      };

      const result = FrameSchema.safeParse(frame);
      expect(result.success).toBe(true);
    });

    it("validates event frames", () => {
      const frame = {
        type: "event" as const,
        event: "chat.message",
        payload: { text: "hello" },
        seq: 1,
      };

      const result = FrameSchema.safeParse(frame);
      expect(result.success).toBe(true);
    });

    it("rejects invalid frames", () => {
      const frame = {
        type: "invalid",
        id: crypto.randomUUID(),
      };

      const result = FrameSchema.safeParse(frame);
      expect(result.success).toBe(false);
    });
  });

  describe("createResponse", () => {
    it("creates successful response", () => {
      const id = crypto.randomUUID();
      const response = createResponse(id, true, { data: "test" });

      expect(response).toEqual({
        type: "res",
        id,
        ok: true,
        payload: { data: "test" },
      });
    });

    it("creates error response", () => {
      const id = crypto.randomUUID();
      const response = createResponse(id, false, undefined, {
        code: "ERROR",
        message: "test error",
      });

      expect(response).toEqual({
        type: "res",
        id,
        ok: false,
        error: { code: "ERROR", message: "test error" },
      });
    });
  });

  describe("createEvent", () => {
    it("creates event frame", () => {
      const event = createEvent("chat.message", { text: "hello" }, 1);

      expect(event).toEqual({
        type: "event",
        event: "chat.message",
        payload: { text: "hello" },
        seq: 1,
      });
    });
  });

  describe("createRequest", () => {
    it("creates request frame", () => {
      const request = createRequest("config.get", { key: "value" });

      expect(request.type).toBe("req");
      expect(request.method).toBe("config.get");
      expect(request.params).toEqual({ key: "value" });
      expect(request.id).toMatch(/^[0-9a-f-]{36}$/);
    });
  });
});
