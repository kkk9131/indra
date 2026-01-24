import { Command } from "commander";
import * as p from "@clack/prompts";
import chalk from "chalk";

export function registerConfigCommand(cli: Command): void {
  cli
    .command("config")
    .description("Manage configuration")
    .action(async () => {
      p.intro(chalk.cyan("Indra Config"));

      const action = await p.select({
        message: "What would you like to do?",
        options: [
          { value: "view", label: "View configuration" },
          { value: "edit", label: "Edit configuration" },
          { value: "reset", label: "Reset to defaults" },
        ],
      });

      if (p.isCancel(action)) {
        p.cancel("Operation cancelled");
        return;
      }

      switch (action) {
        case "view":
          console.log("Configuration: {}", {});
          break;
        case "edit":
          console.log("Edit configuration - stub");
          break;
        case "reset":
          console.log("Reset configuration - stub");
          break;
      }

      p.outro("Done!");
    });
}
