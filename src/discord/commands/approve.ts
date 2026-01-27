import type { SlashCommand, CommandContext } from "../types.js";
import { getErrorMessage } from "../types.js";

const DISCORD_GREEN = 0x57f287;

export const approveCommand: SlashCommand = {
  name: "approve",
  description: "Approve and publish a pending post",
  options: [
    {
      name: "id",
      description: "Post ID to approve",
      type: "string",
      required: true,
    },
  ],

  async execute({ interaction, gateway }: CommandContext): Promise<void> {
    const id = interaction.options.getString("id", true);

    await interaction.deferReply();

    try {
      const result = await gateway.approvePostForDiscord(id);

      if (result.success && result.item) {
        await interaction.editReply({
          embeds: [
            {
              title: "Post Published!",
              description: result.item.content.text,
              color: DISCORD_GREEN,
              fields: [
                { name: "Platform", value: result.item.platform, inline: true },
                { name: "Status", value: result.item.status, inline: true },
                {
                  name: "URL",
                  value: result.item.postUrl ?? "N/A",
                  inline: false,
                },
              ],
            },
          ],
        });
      } else {
        await interaction.editReply(
          `Failed to approve: ${result.error ?? "Unknown error"}`,
        );
      }
    } catch (error) {
      await interaction.editReply(
        `Error: ${getErrorMessage(error, "Failed to approve post")}`,
      );
    }
  },
};
