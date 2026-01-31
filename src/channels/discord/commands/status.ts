import type { SlashCommand, CommandContext } from "../types.js";
import { getErrorMessage } from "../types.js";

const DISCORD_BLURPLE = 0x5865f2;

export const statusCommand: SlashCommand = {
  name: "status",
  description: "Check system status and pending posts",

  async execute({ interaction, gateway }: CommandContext): Promise<void> {
    try {
      const status = await gateway.getStatusForDiscord();

      await interaction.reply({
        embeds: [
          {
            title: "Indra Status",
            color: DISCORD_BLURPLE,
            fields: [
              { name: "Gateway", value: status.gateway, inline: true },
              { name: "X Auth", value: status.xAuth, inline: true },
              { name: "Discord Bot", value: status.discordBot, inline: true },
              {
                name: "Pending Posts",
                value: String(status.pendingPosts),
                inline: true,
              },
            ],
            timestamp: new Date().toISOString(),
          },
        ],
      });
    } catch (error) {
      await interaction.reply({
        content: `Error: ${getErrorMessage(error, "Failed to get status")}`,
        ephemeral: true,
      });
    }
  },
};
