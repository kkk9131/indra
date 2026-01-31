import { Command } from "commander";
import * as p from "@clack/prompts";
import chalk from "chalk";
import {
  getCredentialStore,
  type DiscordCredentials,
} from "../../platform/auth/credential-store.js";

function getDiscordToken(): string | undefined {
  const store = getCredentialStore();
  return (
    store.getDiscordCredentials()?.botToken ?? process.env.DISCORD_BOT_TOKEN
  );
}

export function registerDiscordCommand(cli: Command): void {
  const discord = cli.command("discord").description("Discord bot management");

  discord
    .command("setup")
    .description("Configure Discord bot credentials")
    .action(async () => {
      p.intro(chalk.cyan("Discord Bot Setup"));

      const token = await p.text({
        message: "Bot Token",
        placeholder: "Enter your Discord bot token",
        validate: (v) => (v.length > 0 ? undefined : "Token is required"),
      });
      if (p.isCancel(token)) return p.cancel("Setup cancelled");

      const clientId = await p.text({
        message: "Client ID (Application ID)",
        placeholder: "Enter your Discord application client ID",
        validate: (v) => (v.length > 0 ? undefined : "Client ID is required"),
      });
      if (p.isCancel(clientId)) return p.cancel("Setup cancelled");

      const guildIdsInput = await p.text({
        message: "Guild IDs (comma-separated, optional for dev)",
        placeholder: "123456789,987654321",
      });
      if (p.isCancel(guildIdsInput)) return p.cancel("Setup cancelled");

      const guildIds = guildIdsInput
        ? guildIdsInput.split(",").map((id) => id.trim())
        : undefined;

      const creds: DiscordCredentials = { botToken: token, clientId, guildIds };
      getCredentialStore().setDiscordCredentials(creds);

      p.note(
        [
          "Credentials saved to ~/.indra/credentials/credentials.json",
          "",
          "Alternatively, set environment variables:",
          "  DISCORD_BOT_TOKEN",
          "  DISCORD_CLIENT_ID",
          "  DISCORD_GUILD_IDS (comma-separated)",
        ].join("\n"),
        "Setup Complete",
      );
      p.outro("Discord bot is ready to use!");
    });

  discord
    .command("status")
    .description("Check Discord bot status")
    .action(() => {
      const creds = getCredentialStore().getDiscordCredentials();
      const envToken = process.env.DISCORD_BOT_TOKEN;
      const envClientId = process.env.DISCORD_CLIENT_ID;
      const envGuildIds = process.env.DISCORD_GUILD_IDS;

      p.intro(chalk.cyan("Discord Bot Status"));

      if (creds) {
        p.note(
          [
            `Client ID: ${creds.clientId}`,
            `Token: ${creds.botToken.slice(0, 10)}...`,
            `Guild IDs: ${creds.guildIds?.join(", ") ?? "(global)"}`,
            "",
            "Source: credentials file",
          ].join("\n"),
          "Configured",
        );
      } else if (envToken && envClientId) {
        p.note(
          [
            `Client ID: ${envClientId}`,
            `Token: ${envToken.slice(0, 10)}...`,
            `Guild IDs: ${envGuildIds ?? "(global)"}`,
            "",
            "Source: environment variables",
          ].join("\n"),
          "Configured",
        );
      } else {
        p.note(
          [
            "No credentials found.",
            "",
            "Run `indra discord setup` to configure,",
            "or set environment variables:",
            "  DISCORD_BOT_TOKEN",
            "  DISCORD_CLIENT_ID",
          ].join("\n"),
          "Not Configured",
        );
      }
      p.outro("");
    });

  discord
    .command("clear")
    .description("Clear Discord credentials")
    .action(async () => {
      const confirm = await p.confirm({
        message: "Are you sure you want to clear Discord credentials?",
        initialValue: false,
      });

      if (p.isCancel(confirm) || !confirm) {
        return p.cancel("Operation cancelled");
      }

      getCredentialStore().clearDiscordCredentials();
      p.log.success("Discord credentials cleared!");
    });

  discord
    .command("send <channel> <message>")
    .description("Send a message to a Discord channel")
    .action(async (channelId: string, message: string) => {
      const token = getDiscordToken();
      if (!token) {
        p.log.error("Discord bot token not configured");
        p.log.info("Run `indra discord setup` or set DISCORD_BOT_TOKEN");
        return;
      }

      const { DiscordConnector } = await import("../../integrations/discord.js");
      const connector = new DiscordConnector({ token });

      const s = p.spinner();
      s.start("Connecting to Discord...");

      try {
        await connector.connect();
        s.message("Sending message...");

        const result = await connector.sendMessage(channelId, message);

        if (result.success) {
          s.stop("Message sent!");
          p.log.success(`Message ID: ${result.messageId}`);
        } else {
          s.stop("Failed to send message");
          p.log.error(result.error ?? "Unknown error");
        }
      } catch (error) {
        s.stop("Error");
        p.log.error(
          error instanceof Error ? error.message : "Failed to send message",
        );
      } finally {
        await connector.disconnect();
      }
    });
}
