import type { WorkflowRunRecord } from "./types.js";
import { findRunByTaskTitle, listWorkflowRuns } from "./run-store.js";

export type WorkflowStatusResult =
  | {
      status: "ok";
      run: WorkflowRunRecord;
    }
  | { status: "not_found"; message: string };

export async function getWorkflowStatus(taskTitle: string): Promise<WorkflowStatusResult> {
  const match = await findRunByTaskTitle(taskTitle);
  if (!match) {
    const runs = await listWorkflowRuns();
    const available = runs.map((run) => run.taskTitle).filter(Boolean);
    return {
      status: "not_found",
      message: available.length
        ? `No workflow run found for "${taskTitle}". Available tasks: ${available.join(", ")}`
        : "No workflow runs found.",
    };
  }
  return { status: "ok", run: match };
}
