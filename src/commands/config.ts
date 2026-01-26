import { Command } from "commander";
import * as p from "@clack/prompts";
import chalk from "chalk";
import { ConfigManager, type LLMConfig } from "../config/index.js";

const MODELS = [
  { value: "sonnet", label: "Claude Sonnet (Recommended)" },
  { value: "opus", label: "Claude Opus" },
  { value: "haiku", label: "Claude Haiku" },
];

export function registerConfigCommand(cli: Command): void {
  cli
    .command("config")
    .description("Manage configuration")
    .action(async () => {
      const configManager = new ConfigManager();

      try {
        p.intro(chalk.cyan("Indra Config"));

        const action = await p.select({
          message: "What would you like to do?",
          options: [
            { value: "view", label: "View configuration" },
            { value: "edit", label: "Edit LLM configuration" },
            { value: "reset", label: "Reset to defaults" },
          ],
        });

        if (p.isCancel(action)) {
          p.cancel("Operation cancelled");
          return;
        }

        switch (action) {
          case "view":
            await viewConfig(configManager);
            break;
          case "edit":
            await editLLMConfig(configManager);
            break;
          case "reset":
            await resetConfig(configManager);
            break;
        }

        p.outro("Done!");
      } finally {
        configManager.close();
      }
    });
}

async function viewConfig(configManager: ConfigManager): Promise<void> {
  const config = configManager.get();

  p.note(
    [
      chalk.bold("General:"),
      `  Language: ${config.general.language}`,
      `  Theme: ${config.general.theme}`,
      `  Notifications: ${config.general.notifications}`,
      `  Auto-save: ${config.general.autoSave}`,
      "",
      chalk.bold("LLM (Claude Agent SDK):"),
      `  Model: ${config.llm.model}`,
      `  System Prompt: ${config.llm.systemPrompt ?? "(not set)"}`,
    ].join("\n"),
    "Current Configuration",
  );
}

async function editLLMConfig(configManager: ConfigManager): Promise<void> {
  const current = configManager.get();

  const model = await p.select({
    message: "Select model",
    options: MODELS,
    initialValue: current.llm.model,
  });

  if (p.isCancel(model)) {
    p.cancel("Operation cancelled");
    return;
  }

  const systemPrompt = await p.text({
    message: "System Prompt (optional)",
    placeholder: "You are a helpful assistant...",
    initialValue: current.llm.systemPrompt ?? "",
  });

  if (p.isCancel(systemPrompt)) {
    p.cancel("Operation cancelled");
    return;
  }

  const llmConfig: LLMConfig = {
    model: model as string,
    systemPrompt: systemPrompt || undefined,
  };

  configManager.setKey("llm", llmConfig);

  p.log.success("LLM configuration saved!");
}

async function resetConfig(configManager: ConfigManager): Promise<void> {
  const confirm = await p.confirm({
    message: "Are you sure you want to reset all configuration to defaults?",
    initialValue: false,
  });

  if (p.isCancel(confirm) || !confirm) {
    p.cancel("Operation cancelled");
    return;
  }

  configManager.reset();
  p.log.success("Configuration reset to defaults!");
}
