import { Command } from "commander";
import * as p from "@clack/prompts";
import chalk from "chalk";
import { WSClient } from "../../channels/cli/ws-client.js";
import type { Platform } from "../../integrations/types.js";
import type { ApprovalStatus, ApprovalItem } from "../../platform/approval/types.js";

const DEFAULT_GATEWAY_URL = "ws://localhost:3001";

const STATUS_COLORS: Record<ApprovalStatus, (s: string) => string> = {
  pending: chalk.yellow,
  approved: chalk.blue,
  rejected: chalk.red,
  posted: chalk.green,
  scheduled: chalk.magenta,
  failed: chalk.redBright,
};

function formatItem(item: ApprovalItem): string {
  const colorFn = STATUS_COLORS[item.status];
  const lines = [
    `${chalk.dim("ID:")} ${item.id}`,
    `${chalk.dim("Platform:")} ${item.platform}`,
    `${chalk.dim("Status:")} ${colorFn(item.status)}`,
    `${chalk.dim("Content:")} ${item.content.text}`,
  ];

  if (item.postUrl)
    lines.push(`${chalk.dim("URL:")} ${chalk.cyan(item.postUrl)}`);
  if (item.error) lines.push(`${chalk.dim("Error:")} ${chalk.red(item.error)}`);
  lines.push(
    `${chalk.dim("Created:")} ${new Date(item.createdAt).toLocaleString()}`,
  );

  return lines.join("\n");
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}

interface CommandContext {
  client: WSClient;
  spinner: ReturnType<typeof p.spinner>;
}

async function withGateway<T>(
  url: string,
  connectMessage: string,
  fn: (ctx: CommandContext) => Promise<T>,
): Promise<T | null> {
  const client = new WSClient({ url });
  const spinner = p.spinner();

  spinner.start("Connecting to gateway...");

  try {
    await client.connect();
    spinner.message(connectMessage);
    return await fn({ client, spinner });
  } catch (error) {
    spinner.stop(chalk.red("Operation failed"));
    p.log.error(getErrorMessage(error));
    return null;
  } finally {
    client.disconnect();
  }
}

export function registerPostCommand(cli: Command): void {
  const postCmd = cli.command("post").description("Manage social media posts");

  postCmd
    .command("create")
    .description("Create a new post with AI")
    .requiredOption("-p, --platform <platform>", "Target platform (x, note)")
    .requiredOption("--prompt <prompt>", "Prompt for content generation")
    .option("-u, --url <url>", "Gateway WebSocket URL", DEFAULT_GATEWAY_URL)
    .action(async (options) => {
      await withGateway(
        options.url,
        "Generating post with AI...",
        async ({ client, spinner }) => {
          const item = await client.postCreate(
            options.platform as Platform,
            options.prompt,
          );
          spinner.stop(chalk.green("Post created"));
          p.note(formatItem(item), "Created Post");
          p.log.info(
            chalk.dim(
              `Use ${chalk.cyan(`indra post approve ${item.id}`)} to approve and post`,
            ),
          );
          return item;
        },
      );
    });

  postCmd
    .command("list")
    .description("List posts")
    .option(
      "-s, --status <status>",
      "Filter by status (pending, approved, rejected, posted)",
    )
    .option("-u, --url <url>", "Gateway WebSocket URL", DEFAULT_GATEWAY_URL)
    .action(async (options) => {
      await withGateway(
        options.url,
        "Fetching posts...",
        async ({ client, spinner }) => {
          const items = await client.postList(
            options.status as ApprovalStatus | undefined,
          );
          spinner.stop(chalk.green(`Found ${items.length} posts`));

          if (items.length === 0) {
            p.log.info("No posts found");
          } else {
            for (const item of items) {
              console.log();
              p.note(formatItem(item));
            }
          }
          return items;
        },
      );
    });

  postCmd
    .command("approve <id>")
    .description("Approve and post to SNS")
    .option("-u, --url <url>", "Gateway WebSocket URL", DEFAULT_GATEWAY_URL)
    .action(async (id: string, options) => {
      await withGateway(
        options.url,
        "Approving and posting...",
        async ({ client, spinner }) => {
          const item = await client.postApprove(id);
          spinner.stop(chalk.green("Posted successfully"));
          p.note(formatItem(item), "Posted");
          return item;
        },
      );
    });

  postCmd
    .command("reject <id>")
    .description("Reject a post")
    .option("-u, --url <url>", "Gateway WebSocket URL", DEFAULT_GATEWAY_URL)
    .action(async (id: string, options) => {
      await withGateway(
        options.url,
        "Rejecting post...",
        async ({ client, spinner }) => {
          const item = await client.postReject(id);
          spinner.stop(chalk.green("Post rejected"));
          p.note(formatItem(item), "Rejected");
          return item;
        },
      );
    });
}
