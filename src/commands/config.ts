import { Command } from "commander";
import * as p from "@clack/prompts";
import chalk from "chalk";
import { ConfigManager, type LLMConfig } from "../config/index.js";
import type { ProviderId } from "../llm/index.js";

const PROVIDERS: { value: ProviderId; label: string }[] = [
  { value: "anthropic", label: "Anthropic Claude" },
  { value: "openai", label: "OpenAI" },
  { value: "google", label: "Google Gemini" },
  { value: "ollama", label: "Ollama (Local)" },
];

const DEFAULT_MODELS: Record<ProviderId, string> = {
  anthropic: "claude-sonnet-4-20250514",
  openai: "gpt-4o",
  google: "gemini-2.0-flash",
  ollama: "llama3.2",
};

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
      chalk.bold("LLM:"),
      `  Provider: ${config.llm.provider}`,
      `  Model: ${config.llm.model}`,
      `  Temperature: ${config.llm.temperature}`,
      `  Max Tokens: ${config.llm.maxTokens}`,
      `  API Key: ${config.llm.apiKey ? "****" + config.llm.apiKey.slice(-4) : "(not set)"}`,
      `  System Prompt: ${config.llm.systemPrompt ?? "(not set)"}`,
    ].join("\n"),
    "Current Configuration",
  );
}

async function editLLMConfig(configManager: ConfigManager): Promise<void> {
  const current = configManager.get();

  const provider = await p.select({
    message: "Select LLM provider",
    options: PROVIDERS,
    initialValue: current.llm.provider,
  });

  if (p.isCancel(provider)) {
    p.cancel("Operation cancelled");
    return;
  }

  const providerId = provider as ProviderId;

  const apiKey = await p.text({
    message: "API Key (leave empty to keep current)",
    placeholder: current.llm.apiKey
      ? "****" + current.llm.apiKey.slice(-4)
      : "sk-...",
    validate: () => undefined,
  });

  if (p.isCancel(apiKey)) {
    p.cancel("Operation cancelled");
    return;
  }

  const model = await p.text({
    message: "Model name",
    placeholder: DEFAULT_MODELS[providerId],
    initialValue:
      providerId === current.llm.provider
        ? current.llm.model
        : DEFAULT_MODELS[providerId],
  });

  if (p.isCancel(model)) {
    p.cancel("Operation cancelled");
    return;
  }

  const temperature = await p.text({
    message: "Temperature (0.0 - 2.0)",
    initialValue: String(current.llm.temperature),
    validate: (value) => {
      const num = parseFloat(value);
      if (isNaN(num) || num < 0 || num > 2) {
        return "Temperature must be between 0.0 and 2.0";
      }
      return undefined;
    },
  });

  if (p.isCancel(temperature)) {
    p.cancel("Operation cancelled");
    return;
  }

  const maxTokens = await p.text({
    message: "Max Tokens",
    initialValue: String(current.llm.maxTokens),
    validate: (value) => {
      const num = parseInt(value, 10);
      if (isNaN(num) || num < 1) {
        return "Max tokens must be a positive number";
      }
      return undefined;
    },
  });

  if (p.isCancel(maxTokens)) {
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
    provider: providerId,
    apiKey: apiKey || current.llm.apiKey,
    model: model || DEFAULT_MODELS[providerId],
    temperature: parseFloat(temperature as string),
    maxTokens: parseInt(maxTokens as string, 10),
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
