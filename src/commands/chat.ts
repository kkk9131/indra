import { Command } from "commander";
import * as p from "@clack/prompts";
import chalk from "chalk";
import { WSClient } from "../cli/ws-client.js";
import { renderStream } from "../cli/stream-renderer.js";
import type { Message } from "../llm/types.js";

export function registerChatCommand(cli: Command): void {
  cli
    .command("chat")
    .description("Start interactive chat session")
    .option("-u, --url <url>", "Gateway WebSocket URL", "ws://localhost:3001")
    .action(async (options) => {
      const client = new WSClient({ url: options.url });
      const history: Message[] = [];

      p.intro(chalk.cyan("Indra Chat"));
      p.log.info(
        chalk.dim(
          "Type your message and press Enter. Type 'exit' or 'quit' to end.",
        ),
      );

      // Connect to gateway
      const connectSpinner = p.spinner();
      connectSpinner.start("Connecting to gateway...");

      try {
        await client.connect();
        connectSpinner.stop(chalk.green("Connected to gateway"));
      } catch (error) {
        connectSpinner.stop(chalk.red("Failed to connect to gateway"));
        p.log.error(error instanceof Error ? error.message : "Unknown error");
        p.outro(
          chalk.red("Please make sure the gateway is running (pnpm gateway)"),
        );
        return;
      }

      // Main chat loop
      try {
        while (true) {
          const input = await p.text({
            message: chalk.blue("You:"),
            placeholder: "Type your message...",
          });

          if (p.isCancel(input)) {
            break;
          }

          const message = (input as string).trim();

          if (!message) {
            continue;
          }

          if (message === "exit" || message === "quit") {
            break;
          }

          // Special commands
          if (message === "/clear") {
            history.length = 0;
            p.log.info("Chat history cleared");
            continue;
          }

          if (message === "/history") {
            if (history.length === 0) {
              p.log.info("No chat history");
            } else {
              const historyText = history
                .map(
                  (m) => `${chalk.bold(m.role)}: ${m.content.slice(0, 50)}...`,
                )
                .join("\n");
              p.note(historyText, "Chat History");
            }
            continue;
          }

          // Send message and stream response
          try {
            process.stdout.write(chalk.green("\nAssistant: "));

            const chunks = client.sendChat(message, history);
            const response = await renderStream(chunks, {
              showSpinner: true,
              spinnerMessage: "Thinking...",
            });

            process.stdout.write("\n\n");

            // Update history
            history.push({ role: "user", content: message });
            history.push({ role: "assistant", content: response });
          } catch (error) {
            process.stdout.write("\n");
            p.log.error(
              error instanceof Error ? error.message : "Failed to get response",
            );
          }
        }
      } finally {
        client.disconnect();
      }

      p.outro(chalk.cyan("Goodbye!"));
    });
}
