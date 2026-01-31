import type { SlashCommand } from "../types.js";
import { askCommand } from "./ask.js";
import { approveCommand } from "./approve.js";
import { postCommand } from "./post.js";
import { statusCommand } from "./status.js";

export const commands: SlashCommand[] = [
  askCommand,
  approveCommand,
  postCommand,
  statusCommand,
];
