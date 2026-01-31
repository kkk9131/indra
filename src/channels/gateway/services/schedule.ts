import type {
  SchedulerManager,
  CreateTaskParams,
  UpdateTaskParams,
  TaskDefinition,
  ScheduledTask,
} from "../../../orchestrator/scheduler/index.js";

export interface ScheduleService {
  list: () => ScheduledTask[];
  get: (id: string) => ScheduledTask | null;
  create: (params: CreateTaskParams) => ScheduledTask;
  update: (id: string, params: UpdateTaskParams) => ScheduledTask | null;
  remove: (id: string) => boolean;
  toggle: (id: string, enabled: boolean) => ScheduledTask | null;
  runNow: (id: string) => Promise<{ success: boolean; error?: string }>;
  taskTypes: () => TaskDefinition[];
}

interface ScheduleServiceDeps {
  schedulerManager: SchedulerManager;
}

export function createScheduleService(
  deps: ScheduleServiceDeps,
): ScheduleService {
  return {
    list: () => deps.schedulerManager.list(),
    get: (id) => deps.schedulerManager.get(id),
    create: (params) => deps.schedulerManager.create(params),
    update: (id, params) => deps.schedulerManager.update(id, params),
    remove: (id) => deps.schedulerManager.delete(id),
    toggle: (id, enabled) => deps.schedulerManager.toggle(id, enabled),
    runNow: (id) => deps.schedulerManager.runNow(id),
    taskTypes: () => deps.schedulerManager.taskTypes(),
  };
}
