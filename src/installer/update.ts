import { fetchWorkflow } from "./workflow-fetch.js";
import { loadWorkflowSpec } from "./workflow-spec.js";
import { provisionAgents } from "./agent-provision.js";
import { readOpenClawConfig, writeOpenClawConfig } from "./openclaw-config.js";
import { updateMainAgentGuidance } from "./main-agent-guidance.js";
import { resolveWorkflowDir } from "./paths.js";
import type { WorkflowInstallResult } from "./types.js";

export async function updateWorkflowFromSource(params: {
  source: string;
}): Promise<WorkflowInstallResult> {
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

  return { workflowId: workflow.id, workflowDir };
}

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

export async function updateWorkflow(params: {
  workflowId: string;
  source?: string;
}): Promise<WorkflowInstallResult> {
  const workflowDir = resolveWorkflowDir(params.workflowId);
  if (params.source) {
    return await updateWorkflowFromSource({ source: params.source });
  }
  const workflow = await loadWorkflowSpec(workflowDir);
  const provisioned = await provisionAgents({ workflow, workflowDir });

  const { path: configPath, config } = await readOpenClawConfig();
  const list = ensureAgentList(config);
  for (const agent of provisioned) {
    upsertAgent(list, agent);
  }
  await writeOpenClawConfig(configPath, config);
  await updateMainAgentGuidance();

  return { workflowId: workflow.id, workflowDir };
}
