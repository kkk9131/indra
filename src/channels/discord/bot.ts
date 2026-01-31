import {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  TextChannel,
  type ChatInputCommandInteraction,
  type APIEmbed,
  type Message,
} from "discord.js";
import type {
  DiscordBotConfig,
  SlashCommand,
  CommandContext,
  NotificationData,
} from "./types.js";
import { getErrorMessage } from "./types.js";
import { createNotificationEmbed } from "../../orchestrator/analytics/discord-notifier.js";
import { MessageHandler } from "./message-handler.js";
import type { GatewayServer } from "../gateway/server.js";

export class DiscordBot {
  private client: Client;
  private config: DiscordBotConfig;
  private commands = new Map<string, SlashCommand>();
  private gateway?: GatewayServer;
  private messageHandler: MessageHandler;

  constructor(config: DiscordBotConfig) {
    this.config = config;
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
      ],
    });
    this.messageHandler = new MessageHandler();
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.client.once("ready", () => {
      console.log(`Discord bot logged in as ${this.client.user?.tag}`);
    });

    this.client.on("interactionCreate", async (interaction) => {
      if (!interaction.isChatInputCommand()) return;
      if (interaction.commandName !== "indra") return;

      const subcommand = interaction.options.getSubcommand();
      await this.handleSubcommand(interaction, subcommand);
    });

    this.client.on("error", (error) => {
      console.error("Discord client error:", error);
    });

    // メッセージベースタスク実行
    this.client.on("messageCreate", async (message: Message) => {
      console.log(
        `[Discord] Message received: channel=${message.channel.id}, author=${message.author.tag}, content="${message.content.slice(0, 50)}"`,
      );

      if (!this.messageHandler.shouldProcess(message)) {
        console.log(
          `[Discord] Message skipped: taskChannelId=${this.messageHandler.getTaskChannelId()}, isBot=${message.author.bot}`,
        );
        return;
      }

      console.log("[Discord] Processing message as task");
      const intent = this.messageHandler.parseTaskIntent(message.content);
      console.log(`[Discord] Parsed intent: ${JSON.stringify(intent)}`);
      await this.messageHandler.executeTask(intent, message);
    });
  }

  private async handleSubcommand(
    interaction: ChatInputCommandInteraction,
    subcommand: string,
  ): Promise<void> {
    const command = this.commands.get(subcommand);
    if (!command) {
      await interaction.reply({
        content: `Unknown command: ${subcommand}`,
        ephemeral: true,
      });
      return;
    }

    if (!this.gateway) {
      await interaction.reply({
        content: "Gateway not available",
        ephemeral: true,
      });
      return;
    }

    const ctx: CommandContext = {
      interaction,
      gateway: this.gateway,
    };

    try {
      await command.execute(ctx);
    } catch (error) {
      console.error(`Error executing command ${subcommand}:`, error);
      const errorMessage = getErrorMessage(error, "An error occurred");

      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({
          content: `Error: ${errorMessage}`,
          ephemeral: true,
        });
      } else {
        await interaction.reply({
          content: `Error: ${errorMessage}`,
          ephemeral: true,
        });
      }
    }
  }

  registerCommand(command: SlashCommand): void {
    this.commands.set(command.name, command);
  }

  setGateway(gateway: GatewayServer): void {
    this.gateway = gateway;
    this.messageHandler.setGateway(gateway);
  }

  async registerSlashCommands(): Promise<void> {
    const rest = new REST().setToken(this.config.token);

    // Build the /indra command with subcommands
    const indraCommand = new SlashCommandBuilder()
      .setName("indra")
      .setDescription("Indra agent commands");

    // Add subcommands from registered commands
    for (const command of this.commands.values()) {
      indraCommand.addSubcommand((sub) => {
        sub.setName(command.name).setDescription(command.description);

        // Add options for the subcommand
        if (command.options) {
          for (const opt of command.options) {
            switch (opt.type) {
              case "string":
                sub.addStringOption((option) => {
                  option
                    .setName(opt.name)
                    .setDescription(opt.description)
                    .setRequired(opt.required ?? false);
                  if (opt.choices) {
                    option.addChoices(
                      ...opt.choices.map((c) => ({
                        name: c.name,
                        value: c.value,
                      })),
                    );
                  }
                  return option;
                });
                break;
              case "integer":
                sub.addIntegerOption((option) =>
                  option
                    .setName(opt.name)
                    .setDescription(opt.description)
                    .setRequired(opt.required ?? false),
                );
                break;
              case "boolean":
                sub.addBooleanOption((option) =>
                  option
                    .setName(opt.name)
                    .setDescription(opt.description)
                    .setRequired(opt.required ?? false),
                );
                break;
            }
          }
        }
        return sub;
      });
    }

    const commandData = [indraCommand.toJSON()];

    // Register commands to specific guilds (faster for development)
    if (this.config.guildIds && this.config.guildIds.length > 0) {
      for (const guildId of this.config.guildIds) {
        await rest.put(
          Routes.applicationGuildCommands(this.config.clientId, guildId),
          { body: commandData },
        );
        console.log(`Registered slash commands for guild ${guildId}`);
      }
    } else {
      // Register global commands (takes up to 1 hour to propagate)
      await rest.put(Routes.applicationCommands(this.config.clientId), {
        body: commandData,
      });
      console.log("Registered global slash commands");
    }
  }

  async start(): Promise<void> {
    await this.registerSlashCommands();
    await this.client.login(this.config.token);
  }

  async stop(): Promise<void> {
    await this.client.destroy();
  }

  getClient(): Client {
    return this.client;
  }

  isReady(): boolean {
    return this.client.isReady();
  }

  getBotName(): string | null {
    return this.client.user?.username ?? null;
  }

  /**
   * 指定チャンネルにEmbedを送信
   */
  async sendEmbed(
    channelId: string,
    embed: APIEmbed,
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    if (!this.client.isReady()) {
      return { success: false, error: "Discord bot not ready" };
    }

    try {
      const channel = await this.client.channels.fetch(channelId);
      if (!channel || !("send" in channel)) {
        return {
          success: false,
          error: "Channel not found or not a text channel",
        };
      }

      const textChannel = channel as TextChannel;
      const message = await textChannel.send({ embeds: [embed] });

      return { success: true, messageId: message.id };
    } catch (error) {
      const errorMessage = getErrorMessage(error, "Failed to send embed");
      console.error("Discord sendEmbed error:", errorMessage);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * 一般チャンネルに通知を送信
   */
  async sendNotification(
    data: NotificationData,
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const channelId = process.env.DISCORD_GENERAL_CHANNEL_ID;
    if (!channelId) {
      return { success: false, error: "DISCORD_GENERAL_CHANNEL_ID not set" };
    }

    const embed = createNotificationEmbed(data);
    return this.sendEmbed(channelId, embed);
  }
}
