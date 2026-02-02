import { listDevlogs } from "../../../capabilities/devlog/index.js";
import type {
  DevlogEntry,
  DevlogListParams,
} from "../../../capabilities/devlog/types.js";

export interface DevlogService {
  list: (params?: DevlogListParams) => DevlogEntry[];
}

export function createDevlogService(): DevlogService {
  return {
    list: (params) => listDevlogs(params),
  };
}
