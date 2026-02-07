import fs from "node:fs/promises";
import path from "node:path";
import { fetchWorkflow } from "./workflow-fetch.js";
import { loadWorkflowSpec } from "./workflow-spec.js";
import { provisionAgents } from "./agent-provision.js";
import { readOpenClawConfig, writeOpenClawConfig } from "./openclaw-config.js";
import { updateMainAgentGuidance } from "./main-agent-guidance.js";
import type { WorkflowInstallResult } from "./types.js";

function ensureAgentList(config: { agents?: { list?: Array<Record<string, unknown>> } }) {
  if (!config.agents) {
    config.agents = {};
  }
  if (!Array.isArray(config.agents.list)) {
    config.agents.list = [];
  }
  return config.agents.list;
}

function upsertAgent(
  list: Array<Record<string, unknown>>,
  agent: { id: string; name?: string; workspaceDir: string; agentDir: string },
) {
  const existing = list.find((entry) => entry.id === agent.id);
  const payload = {
    id: agent.id,
    name: agent.name ?? agent.id,
    workspace: agent.workspaceDir,
    agentDir: agent.agentDir,
  };
  if (existing) {
    Object.assign(existing, payload);
  } else {
    list.push(payload);
  }
}

async function writeWorkflowMetadata(params: {
  workflowDir: string;
  workflowId: string;
  source: string;
}) {
  const content = {
    workflowId: params.workflowId,
    source: params.source,
    installedAt: new Date().toISOString(),
  };
  await fs.writeFile(
    path.join(params.workflowDir, "metadata.json"),
    `${JSON.stringify(content, null, 2)}\n`,
    "utf-8",
  );
}

export async function installWorkflow(params: { source: string }): Promise<WorkflowInstallResult> {
  const { workflowDir } = await fetchWorkflow(params.source);
  const workflow = await loadWorkflowSpec(workflowDir);
  const provisioned = await provisionAgents({ workflow, workflowDir });

  const { path: configPath, config } = await readOpenClawConfig();
  const list = ensureAgentList(config);
  for (const agent of provisioned) {
    upsertAgent(list, agent);
  }
  await writeOpenClawConfig(configPath, config);
  await updateMainAgentGuidance();
  await writeWorkflowMetadata({
    workflowDir,
    workflowId: workflow.id,
    source: params.source,
  });

  return { workflowId: workflow.id, workflowDir };
}
