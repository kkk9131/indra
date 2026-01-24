import { describe, it, expect, vi } from "vitest";
import { Command } from "commander";
import { createCli } from "./index.js";
import { registerChatCommand } from "../commands/chat.js";
import { registerConfigCommand } from "../commands/config.js";

describe("CLI", () => {
  describe("createCli", () => {
    it("creates CLI instance with correct configuration", () => {
      const cli = createCli();

      expect(cli.name()).toBe("indra");
      expect(cli.description()).toBe("Local multi-agent AI assistant");
    });
  });

  describe("registerChatCommand", () => {
    it("registers chat command", () => {
      const cli = new Command();
      registerChatCommand(cli);

      const chatCmd = cli.commands.find((c) => c.name() === "chat");
      expect(chatCmd).toBeDefined();
    });
  });

  describe("registerConfigCommand", () => {
    it("registers config command", () => {
      const cli = new Command();
      registerConfigCommand(cli);

      const configCmd = cli.commands.find((c) => c.name() === "config");
      expect(configCmd).toBeDefined();
    });
  });
});
