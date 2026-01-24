import { Command } from "commander";

export function registerChatCommand(cli: Command): void {
  cli
    .command("chat")
    .description("Start interactive chat session")
    .action(async () => {
      console.log("chat command - stub");
    });
}
