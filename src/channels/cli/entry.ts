import "dotenv/config";
import { createCli } from "./index.js";
import { registerChatCommand } from "../../orchestrator/commands/chat.js";
import { registerConfigCommand } from "../../orchestrator/commands/config.js";
import { registerPostCommand } from "../../orchestrator/commands/post.js";
import { registerDiscordCommand } from "../../orchestrator/commands/discord.js";
import { registerAuthCommand } from "../../orchestrator/commands/auth.js";
import { registerEvalCommand } from "../../orchestrator/commands/eval.js";
import { registerMemoryCommand } from "../../orchestrator/commands/memory.js";

const cli = createCli();

registerChatCommand(cli);
registerConfigCommand(cli);
registerPostCommand(cli);
registerDiscordCommand(cli);
registerAuthCommand(cli);
registerEvalCommand(cli);
registerMemoryCommand(cli);

cli.parse(process.argv);
