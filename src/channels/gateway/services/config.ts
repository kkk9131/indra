import type { Config, ConfigManager } from "../../../platform/config/index.js";

export interface ConfigService {
  get: () => Config;
  set: (update: Partial<Config>) => void;
}

interface ConfigServiceDeps {
  configManager: ConfigManager;
}

export function createConfigService(deps: ConfigServiceDeps): ConfigService {
  return {
    get: () => deps.configManager.get(),
    set: (update) => deps.configManager.set(update),
  };
}
