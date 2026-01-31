import type { AgentDefinition, SDKAgentDefinition } from "./types.js";
import { toSDKFormat, toSDKAgentsMap } from "./types.js";
import { loadProjectAgents } from "./loader.js";

class AgentRegistry {
  private agents = new Map<string, AgentDefinition>();
  private loaded = false;

  async load(projectRoot?: string): Promise<void> {
    const agents = await loadProjectAgents(projectRoot);
    for (const agent of agents) {
      this.agents.set(agent.name, agent);
    }
    this.loaded = true;
  }

  async ensureLoaded(projectRoot?: string): Promise<void> {
    if (!this.loaded) {
      await this.load(projectRoot);
    }
  }

  get(name: string): AgentDefinition | undefined {
    return this.agents.get(name);
  }

  getSDKFormat(name: string): SDKAgentDefinition | undefined {
    const agent = this.get(name);
    return agent ? toSDKFormat(agent) : undefined;
  }

  list(): AgentDefinition[] {
    return Array.from(this.agents.values());
  }

  listNames(): string[] {
    return Array.from(this.agents.keys());
  }

  toSDKAgentsMap(): Record<string, SDKAgentDefinition> {
    return toSDKAgentsMap(this.list());
  }

  register(agent: AgentDefinition): void {
    this.agents.set(agent.name, agent);
  }

  clear(): void {
    this.agents.clear();
    this.loaded = false;
  }
}

export const agentRegistry = new AgentRegistry();

export async function getAgent(
  name: string,
): Promise<AgentDefinition | undefined> {
  await agentRegistry.ensureLoaded();
  return agentRegistry.get(name);
}

export async function getAgentSDKFormat(
  name: string,
): Promise<SDKAgentDefinition | undefined> {
  await agentRegistry.ensureLoaded();
  return agentRegistry.getSDKFormat(name);
}

export async function getAllAgents(): Promise<AgentDefinition[]> {
  await agentRegistry.ensureLoaded();
  return agentRegistry.list();
}

export async function getSDKAgentsMap(): Promise<
  Record<string, SDKAgentDefinition>
> {
  await agentRegistry.ensureLoaded();
  return agentRegistry.toSDKAgentsMap();
}
