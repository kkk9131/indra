import { Command } from "commander";
import * as p from "@clack/prompts";
import chalk from "chalk";
import {
  EvaluationStore,
  calculateMetrics,
  formatMetrics,
  interpretMetrics,
  GLMGrader,
  DEFAULT_K,
} from "../evaluation/index.js";
import type { TaskType, CreateTaskInput } from "../evaluation/types.js";

const TASK_TYPES: TaskType[] = ["xpost", "report", "chat", "browser", "other"];

export function registerEvalCommand(cli: Command): void {
  const evalCmd = cli
    .command("eval")
    .description("Evaluation system for agent tasks");

  // eval list - List all tasks
  evalCmd
    .command("list")
    .description("List all evaluation tasks")
    .option("-t, --type <type>", "Filter by task type")
    .action(async (options) => {
      const store = new EvaluationStore();

      try {
        const tasks = options.type
          ? store.listTasksByType(options.type)
          : store.listTasks();

        if (tasks.length === 0) {
          p.log.info("No evaluation tasks found.");
          return;
        }

        p.intro(chalk.cyan(`Evaluation Tasks (${tasks.length})`));

        for (const task of tasks) {
          const stats = store.getTaskTrialStats(task.id);
          const passRate =
            stats.total > 0
              ? ((stats.passed / stats.total) * 100).toFixed(1)
              : "N/A";

          console.log(
            chalk.bold(`\n${task.name}`) +
              chalk.dim(` (${task.id.slice(0, 8)})`),
          );
          console.log(chalk.dim(`  Type: ${task.taskType}`));
          console.log(
            chalk.dim(
              `  Trials: ${stats.passed}/${stats.total} (${passRate}% pass rate)`,
            ),
          );
          if (task.shouldFail) {
            console.log(chalk.yellow("  [Safety Test]"));
          }
        }

        p.outro("");
      } finally {
        store.close();
      }
    });

  // eval show <taskId> - Show task details with metrics
  evalCmd
    .command("show <taskId>")
    .description("Show task details and evaluation metrics")
    .option(
      "-k <number>",
      "K value for Pass@K/Pass K calculation",
      String(DEFAULT_K),
    )
    .action(async (taskId, options) => {
      const store = new EvaluationStore();
      const k = parseInt(options.k, 10);

      try {
        const task = store.getTask(taskId);
        if (!task) {
          p.log.error(`Task not found: ${taskId}`);
          return;
        }

        p.intro(chalk.cyan(`Task: ${task.name}`));

        // Task details
        console.log(chalk.bold("\n--- Task Details ---"));
        console.log(`ID: ${task.id}`);
        console.log(`Type: ${task.taskType}`);
        console.log(
          `Input: ${task.input.slice(0, 200)}${task.input.length > 200 ? "..." : ""}`,
        );
        console.log(`Success Criteria: ${task.successCriteria}`);
        if (task.shouldFail) {
          console.log(
            chalk.yellow("This is a safety test (should fail/reject)"),
          );
        }

        // Metrics
        const metrics = calculateMetrics(store, taskId, k);
        console.log(chalk.bold("\n--- Evaluation Metrics ---"));
        console.log(`Total Trials: ${metrics.totalTrials}`);
        console.log(`Passed Trials: ${metrics.passedTrials}`);
        console.log(
          chalk.green(`Pass@${k}: ${(metrics.passAtK * 100).toFixed(1)}%`),
        );
        console.log(
          chalk.blue(`Pass ${k}: ${(metrics.passK * 100).toFixed(1)}%`),
        );
        console.log(`Average Score: ${metrics.averageScore.toFixed(1)}`);
        if (
          metrics.averageDuration !== null &&
          metrics.averageDuration !== undefined
        ) {
          console.log(
            `Average Duration: ${metrics.averageDuration.toFixed(0)}ms`,
          );
        }
        console.log(
          chalk.dim(
            `\nInterpretation: ${interpretMetrics(metrics.passAtK, metrics.passK)}`,
          ),
        );

        // Recent trials
        const trials = store.listTrialsByTask(taskId);
        if (trials.length > 0) {
          console.log(chalk.bold("\n--- Recent Trials ---"));
          const recentTrials = trials.slice(-5);
          for (const trial of recentTrials) {
            const status = trial.passed ? chalk.green("✓") : chalk.red("✗");
            const duration = trial.duration ? `${trial.duration}ms` : "N/A";
            console.log(
              `  ${status} Trial #${trial.trialNumber} - Duration: ${duration}`,
            );
          }
        }

        p.outro("");
      } finally {
        store.close();
      }
    });

  // eval create - Create a new task
  evalCmd
    .command("create")
    .description("Create a new evaluation task")
    .action(async () => {
      const store = new EvaluationStore();

      try {
        p.intro(chalk.cyan("Create Evaluation Task"));

        const name = await p.text({
          message: "Task name:",
          placeholder: "e.g., X Post Generation Test",
          validate: (value) => {
            if (!value) return "Name is required";
            return undefined;
          },
        });

        if (p.isCancel(name)) {
          p.cancel("Cancelled");
          return;
        }

        const taskType = await p.select({
          message: "Task type:",
          options: TASK_TYPES.map((type) => ({
            value: type,
            label: type,
          })),
        });

        if (p.isCancel(taskType)) {
          p.cancel("Cancelled");
          return;
        }

        const input = await p.text({
          message: "Task input (prompt/instruction):",
          placeholder: "e.g., Generate a tweet about AI news",
          validate: (value) => {
            if (!value) return "Input is required";
            return undefined;
          },
        });

        if (p.isCancel(input)) {
          p.cancel("Cancelled");
          return;
        }

        const successCriteria = await p.text({
          message: "Success criteria:",
          placeholder:
            "e.g., Tweet should be under 280 characters and engaging",
          validate: (value) => {
            if (!value) return "Success criteria is required";
            return undefined;
          },
        });

        if (p.isCancel(successCriteria)) {
          p.cancel("Cancelled");
          return;
        }

        const shouldFail = await p.confirm({
          message: "Is this a safety test (should fail/reject)?",
          initialValue: false,
        });

        if (p.isCancel(shouldFail)) {
          p.cancel("Cancelled");
          return;
        }

        const taskInput: CreateTaskInput = {
          name: name as string,
          taskType: taskType as TaskType,
          input: input as string,
          successCriteria: successCriteria as string,
          shouldFail: shouldFail as boolean,
        };

        const task = store.createTask(taskInput);

        p.log.success(`Task created: ${task.id}`);
        p.outro(chalk.green("Done!"));
      } finally {
        store.close();
      }
    });

  // eval run <taskId> - Run evaluation on a task
  evalCmd
    .command("run <taskId>")
    .description("Run GLM evaluation on a task outcome")
    .option("-o, --outcome <outcome>", "Outcome text to evaluate")
    .option("-f, --file <file>", "Read outcome from file")
    .action(async (taskId, options) => {
      const store = new EvaluationStore();
      const grader = new GLMGrader();

      try {
        const task = store.getTask(taskId);
        if (!task) {
          p.log.error(`Task not found: ${taskId}`);
          return;
        }

        if (!grader.isAvailable()) {
          p.log.error(
            "GLM is not available. Please set ZAI_API_KEY in ~/.claude/.env",
          );
          return;
        }

        let outcome: string;

        if (options.file) {
          const fs = await import("node:fs/promises");
          outcome = await fs.readFile(options.file, "utf-8");
        } else if (options.outcome) {
          outcome = options.outcome;
        } else {
          const input = await p.text({
            message: "Enter the outcome to evaluate:",
            placeholder: "Paste the outcome here...",
          });

          if (p.isCancel(input)) {
            p.cancel("Cancelled");
            return;
          }

          outcome = input as string;
        }

        p.intro(chalk.cyan(`Evaluating task: ${task.name}`));

        const spinner = p.spinner();
        spinner.start("Running GLM evaluation...");

        // Create a trial
        const trial = store.createTrial({ taskId: task.id });

        // Run grading
        const gradeResult = await grader.gradeForStorage(
          trial.id,
          task,
          outcome,
        );

        // Record result
        store.recordGraderResult(gradeResult);

        // Update trial
        store.updateTrialResult(trial.id, gradeResult.passed);

        spinner.stop("Evaluation complete!");

        // Display results
        console.log(chalk.bold("\n--- Evaluation Result ---"));
        console.log(
          `Status: ${gradeResult.passed ? chalk.green("PASSED") : chalk.red("FAILED")}`,
        );
        console.log(`Score: ${gradeResult.score}/100`);
        console.log(`Reason: ${gradeResult.reason}`);

        if (gradeResult.details) {
          console.log(chalk.bold("\nDetails:"));
          for (const [key, value] of Object.entries(gradeResult.details)) {
            const status = value ? chalk.green("✓") : chalk.red("✗");
            console.log(`  ${status} ${key}`);
          }
        }

        // Show updated metrics
        const metrics = calculateMetrics(store, taskId);
        console.log(chalk.bold("\n--- Updated Metrics ---"));
        console.log(formatMetrics(metrics));

        p.outro("");
      } finally {
        store.close();
      }
    });

  // eval delete <taskId> - Delete a task
  evalCmd
    .command("delete <taskId>")
    .description("Delete an evaluation task and all its trials")
    .action(async (taskId) => {
      const store = new EvaluationStore();

      try {
        const task = store.getTask(taskId);
        if (!task) {
          p.log.error(`Task not found: ${taskId}`);
          return;
        }

        const confirm = await p.confirm({
          message: `Delete task "${task.name}" and all its trials?`,
          initialValue: false,
        });

        if (p.isCancel(confirm) || !confirm) {
          p.cancel("Cancelled");
          return;
        }

        const deleted = store.deleteTask(taskId);
        if (deleted) {
          p.log.success(`Task deleted: ${taskId}`);
        } else {
          p.log.error("Failed to delete task");
        }
      } finally {
        store.close();
      }
    });

  // eval trials <taskId> - List trials for a task
  evalCmd
    .command("trials <taskId>")
    .description("List all trials for a task")
    .action(async (taskId) => {
      const store = new EvaluationStore();

      try {
        const task = store.getTask(taskId);
        if (!task) {
          p.log.error(`Task not found: ${taskId}`);
          return;
        }

        const trials = store.listTrialsByTask(taskId);
        if (trials.length === 0) {
          p.log.info("No trials found for this task.");
          return;
        }

        p.intro(chalk.cyan(`Trials for: ${task.name}`));

        for (const trial of trials) {
          const status = trial.passed
            ? chalk.green("PASSED")
            : chalk.red("FAILED");
          const duration = trial.duration ? `${trial.duration}ms` : "N/A";

          console.log(
            chalk.bold(`\nTrial #${trial.trialNumber}`) +
              ` (${trial.id.slice(0, 8)})`,
          );
          console.log(`  Status: ${status}`);
          console.log(`  Duration: ${duration}`);
          console.log(`  Created: ${trial.createdAt}`);

          // Show grader results
          const results = store.listGraderResultsByTrial(trial.id);
          if (results.length > 0) {
            console.log(chalk.dim("  Grader Results:"));
            for (const result of results) {
              const graderStatus = result.passed
                ? chalk.green("✓")
                : chalk.red("✗");
              console.log(
                `    ${graderStatus} ${result.graderName}: ${result.score}/100`,
              );
            }
          }
        }

        p.outro("");
      } finally {
        store.close();
      }
    });
}
