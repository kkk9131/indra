export type Model = "haiku" | "sonnet" | "opus";

export interface AgentDefinition {
  name: string;
  description: string;
  prompt: string;
  tools?: string[];
  model?: Model;
}

export interface SDKAgentDefinition {
  description: string;
  prompt: string;
  tools?: string[];
  model?: Model;
}

export function toSDKFormat(agent: AgentDefinition): SDKAgentDefinition {
  return {
    description: agent.description,
    prompt: agent.prompt,
    tools: agent.tools,
    model: agent.model,
  };
}

export function toSDKAgentsMap(
  agents: AgentDefinition[],
): Record<string, SDKAgentDefinition> {
  const map: Record<string, SDKAgentDefinition> = {};
  for (const agent of agents) {
    map[agent.name] = toSDKFormat(agent);
  }
  return map;
}
