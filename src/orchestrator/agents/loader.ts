import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import type { AgentDefinition, Model } from "./types.js";

interface AgentFrontmatter {
  name: string;
  description: string;
  tools?: string;
  model?: string;
}

function parseFrontmatter(content: string): {
  frontmatter: AgentFrontmatter;
  body: string;
} {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) {
    throw new Error("Invalid frontmatter format");
  }

  const [, yaml, body] = match;
  const frontmatter: Record<string, string> = {};

  for (const line of yaml.split("\n")) {
    const colonIndex = line.indexOf(":");
    if (colonIndex > 0) {
      const key = line.slice(0, colonIndex).trim();
      const value = line.slice(colonIndex + 1).trim();
      frontmatter[key] = value;
    }
  }

  return {
    frontmatter: frontmatter as unknown as AgentFrontmatter,
    body: body.trim(),
  };
}

function parseTools(toolsStr: string | undefined): string[] | undefined {
  if (!toolsStr) return undefined;
  return toolsStr.split(",").map((t) => t.trim());
}

function parseModel(modelStr: string | undefined): Model | undefined {
  if (!modelStr) return undefined;
  const normalized = modelStr.toLowerCase().trim();
  if (
    normalized === "haiku" ||
    normalized === "sonnet" ||
    normalized === "opus"
  ) {
    return normalized;
  }
  return undefined;
}

export async function loadAgentFromFile(
  filePath: string,
): Promise<AgentDefinition> {
  const content = await readFile(filePath, "utf-8");
  const { frontmatter, body } = parseFrontmatter(content);

  return {
    name: frontmatter.name,
    description: frontmatter.description,
    prompt: body,
    tools: parseTools(frontmatter.tools),
    model: parseModel(frontmatter.model),
  };
}

export async function loadAgentsFromDirectory(
  dirPath: string,
): Promise<AgentDefinition[]> {
  const agents: AgentDefinition[] = [];

  try {
    const files = await readdir(dirPath);
    const mdFiles = files.filter((f) => f.endsWith(".md"));

    for (const file of mdFiles) {
      try {
        const agent = await loadAgentFromFile(join(dirPath, file));
        agents.push(agent);
      } catch (error) {
        console.warn(`Failed to load agent from ${file}:`, error);
      }
    }
  } catch (error) {
    console.warn(`Failed to read agents directory:`, error);
  }

  return agents;
}

export async function loadProjectAgents(
  projectRoot: string = process.cwd(),
): Promise<AgentDefinition[]> {
  const agentsDir = join(projectRoot, ".claude", "agents");
  return loadAgentsFromDirectory(agentsDir);
}
