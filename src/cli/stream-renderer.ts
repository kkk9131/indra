import * as p from "@clack/prompts";
import chalk from "chalk";

export type RenderStreamOptions = {
  showSpinner?: boolean;
  spinnerMessage?: string;
};

export async function renderStream(
  chunks: AsyncIterable<string>,
  options: RenderStreamOptions = {},
): Promise<string> {
  const showSpinner = options.showSpinner ?? true;
  const spinnerMessage = options.spinnerMessage ?? "Waiting for response...";

  const spin = showSpinner ? p.spinner() : null;
  if (spin) {
    spin.start(chalk.dim(spinnerMessage));
  }

  let receivedFirstChunk = false;
  let fullText = "";

  try {
    for await (const chunk of chunks) {
      if (!receivedFirstChunk) {
        receivedFirstChunk = true;
        spin?.stop();
      }

      process.stdout.write(chunk);
      fullText += chunk;
    }
  } finally {
    if (!receivedFirstChunk) {
      spin?.stop();
    }
  }

  return fullText;
}
