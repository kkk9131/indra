import { createCli } from "./index.js";
import { registerChatCommand } from "../commands/chat.js";
import { registerConfigCommand } from "../commands/config.js";

const cli = createCli();

registerChatCommand(cli);
registerConfigCommand(cli);

cli.parse(process.argv);
