import "dotenv/config";
import { createCli } from "./index.js";
import { registerChatCommand } from "../commands/chat.js";
import { registerConfigCommand } from "../commands/config.js";
import { registerPostCommand } from "../commands/post.js";
import { registerDiscordCommand } from "../commands/discord.js";

const cli = createCli();

registerChatCommand(cli);
registerConfigCommand(cli);
registerPostCommand(cli);
registerDiscordCommand(cli);

cli.parse(process.argv);
