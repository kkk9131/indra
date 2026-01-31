import type { LogStore } from "../../../platform/logs/index.js";
import type { LogEntry } from "../../../platform/logs/types.js";

export interface LogsService {
  list: () => LogEntry[];
}

interface LogsServiceDeps {
  logStore: LogStore;
}

export function createLogsService(deps: LogsServiceDeps): LogsService {
  return {
    list: () => deps.logStore.list(),
  };
}
