import { Command } from "commander";

export function createCli(): Command {
  const cli = new Command();

  cli
    .name("indra")
    .description("Local multi-agent AI assistant")
    .version("0.1.0");

  return cli;
}
