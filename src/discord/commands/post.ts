import type { SlashCommand, CommandContext } from "../types.js";
import { getErrorMessage } from "../types.js";

type Platform = "x" | "note";

const DISCORD_BLURPLE = 0x5865f2;

export const postCommand: SlashCommand = {
  name: "post",
  description: "Create a social media post (goes to approval queue)",
  options: [
    {
      name: "platform",
      description: "Target platform",
      type: "string",
      required: true,
      choices: [
        { name: "X (Twitter)", value: "x" },
        { name: "note", value: "note" },
      ],
    },
    {
      name: "prompt",
      description: "What should the post be about?",
      type: "string",
      required: true,
    },
  ],

  async execute({ interaction, gateway }: CommandContext): Promise<void> {
    const platform = interaction.options.getString(
      "platform",
      true,
    ) as Platform;
    const prompt = interaction.options.getString("prompt", true);

    await interaction.deferReply();

    try {
      const item = await gateway.createPostForDiscord(platform, prompt);

      await interaction.editReply({
        embeds: [
          {
            title: "Post Created",
            description: item.content.text,
            color: DISCORD_BLURPLE,
            fields: [
              { name: "Platform", value: platform, inline: true },
              { name: "Status", value: item.status, inline: true },
              { name: "ID", value: item.id, inline: true },
            ],
            footer: { text: "Use /indra approve to publish" },
          },
        ],
      });
    } catch (error) {
      await interaction.editReply(
        `Error: ${getErrorMessage(error, "Failed to create post")}`,
      );
    }
  },
};
