import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { resolveWorkflowDir, resolveWorkflowRoot } from "./paths.js";

function isGitRepoUrl(input: string): boolean {
  const trimmed = input.toLowerCase();
  if (trimmed.endsWith(".yml") || trimmed.endsWith(".yaml")) {
    return false;
  }
  if (trimmed.includes("raw.githubusercontent.com") || trimmed.includes("/raw/")) {
    return false;
  }
  return trimmed.endsWith(".git") || trimmed.includes("github.com") || trimmed.includes("gitlab.com");
}

function isHttpUrl(input: string): boolean {
  return /^https?:\/\//.test(input);
}

async function runGit(args: string[], cwd?: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn("git", args, { cwd, stdio: "inherit" });
    child.on("error", reject);
    child.on("exit", (code: number | null) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`git ${args.join(" ")} failed with code ${code}`));
      }
    });
  });
}

function deriveWorkflowIdFromUrl(source: string): string {
  const cleaned = source.replace(/\/$/, "");
  const parts = cleaned.split("/").filter(Boolean);
  const last = parts[parts.length - 1] ?? "workflow";
  return last.replace(/\.git$/, "").replace(/\.(ya?ml)$/i, "");
}

async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
}

export async function fetchWorkflow(source: string): Promise<{ workflowDir: string }> {
  if (!isHttpUrl(source)) {
    throw new Error(`Unsupported source URL: ${source}`);
  }
  const workflowId = deriveWorkflowIdFromUrl(source);
  const workflowDir = resolveWorkflowDir(workflowId);
  await ensureDir(resolveWorkflowRoot());

  if (isGitRepoUrl(source)) {
    try {
      await fs.access(path.join(workflowDir, ".git"));
      await runGit(["-C", workflowDir, "pull", "--ff-only"]);
    } catch {
      await runGit(["clone", source, workflowDir]);
    }
    return { workflowDir };
  }

  const response = await fetch(source);
  if (!response.ok) {
    throw new Error(`Failed to download workflow: ${response.status} ${response.statusText}`);
  }
  const content = await response.text();
  await ensureDir(workflowDir);
  await fs.writeFile(path.join(workflowDir, "workflow.yml"), content, "utf-8");
  return { workflowDir };
}
