import type { SlashCommand, CommandContext } from "../types.js";
import { getErrorMessage } from "../types.js";

const DISCORD_MESSAGE_LIMIT = 2000;

export const askCommand: SlashCommand = {
  name: "ask",
  description: "Ask the LLM agent a question",
  options: [
    {
      name: "prompt",
      description: "Your question or prompt",
      type: "string",
      required: true,
    },
  ],

  async execute({ interaction, gateway }: CommandContext): Promise<void> {
    const prompt = interaction.options.getString("prompt", true);

    await interaction.deferReply();

    try {
      const response = await gateway.chatForDiscord(prompt);

      if (response.length > DISCORD_MESSAGE_LIMIT) {
        const chunks = splitMessage(response, DISCORD_MESSAGE_LIMIT);
        await interaction.editReply(chunks[0]);
        for (let i = 1; i < chunks.length; i++) {
          await interaction.followUp(chunks[i]);
        }
      } else {
        await interaction.editReply(response);
      }
    } catch (error) {
      await interaction.editReply(
        `Error: ${getErrorMessage(error, "Failed to get response")}`,
      );
    }
  },
};

function splitMessage(text: string, maxLength: number): string[] {
  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= maxLength) {
      chunks.push(remaining);
      break;
    }

    // Find a good split point (newline or space)
    let splitIndex = remaining.lastIndexOf("\n", maxLength);
    if (splitIndex === -1 || splitIndex < maxLength / 2) {
      splitIndex = remaining.lastIndexOf(" ", maxLength);
    }
    if (splitIndex === -1 || splitIndex < maxLength / 2) {
      splitIndex = maxLength;
    }

    chunks.push(remaining.slice(0, splitIndex));
    remaining = remaining.slice(splitIndex).trimStart();
  }

  return chunks;
}
