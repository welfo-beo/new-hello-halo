/**
 * Dev Mode Agent Definitions - OMC Integration
 *
 * Types and category mappings for OMC agents.
 * Actual agent data (prompts, descriptions) is fetched via IPC from the main process.
 */

export interface OmcAgentInfo {
  name: string
  description: string
  model?: string
  category: string
}

export interface OmcAgentDef {
  description: string
  prompt: string
  tools?: string[]
  model?: string
}

export interface ResolvedSubagent {
  name: string
  description: string
  prompt: string
  tools?: string[]
  model?: 'sonnet' | 'opus' | 'haiku' | 'inherit'
}

export interface ResolvedOmcAgents {
  resolvedSubagents: ResolvedSubagent[]
  unresolvedAgents: string[]
}

function normalizeModel(model?: string): 'sonnet' | 'opus' | 'haiku' | 'inherit' | undefined {
  if (model === 'sonnet' || model === 'opus' || model === 'haiku' || model === 'inherit') return model
  return undefined
}

/**
 * Resolve selected agent names into executable subagent definitions.
 * Any unknown or incomplete definitions are returned in unresolvedAgents.
 */
export function resolveSelectedOmcAgents(
  selectedAgents: Iterable<string>,
  defs: Record<string, OmcAgentDef>
): ResolvedOmcAgents {
  const resolvedSubagents: ResolvedSubagent[] = []
  const unresolvedAgents: string[] = []

  for (const name of selectedAgents) {
    const def = defs[name]
    if (!def || !def.description || !def.prompt) {
      unresolvedAgents.push(name)
      continue
    }

    resolvedSubagents.push({
      name,
      description: def.description,
      prompt: def.prompt,
      tools: def.tools,
      model: normalizeModel(def.model)
    })
  }

  return { resolvedSubagents, unresolvedAgents }
}

/** Full OMC agent -> category mapping (canonical + aliases). */
export const OMC_AGENT_CATEGORY_MAP: Record<string, string> = {
  explore: 'build',
  analyst: 'build',
  planner: 'build',
  architect: 'build',
  debugger: 'build',
  executor: 'build',
  verifier: 'build',

  'quality-reviewer': 'review',
  'security-reviewer': 'review',
  'code-reviewer': 'review',
  'api-reviewer': 'review',
  'performance-reviewer': 'review',

  'deep-executor': 'specialist',
  'test-engineer': 'specialist',
  'build-fixer': 'specialist',
  designer: 'specialist',
  writer: 'specialist',
  'qa-tester': 'specialist',
  scientist: 'specialist',
  'git-master': 'specialist',
  'code-simplifier': 'specialist',
  'document-specialist': 'specialist',
  'dependency-expert': 'specialist',
  researcher: 'specialist',
  'tdd-guide': 'specialist',

  critic: 'coordination'
}

/** OMC agent categories for UI grouping */
export const OMC_CATEGORIES: Record<string, { label: string; description: string }> = {
  build: {
    label: 'Build / Analysis',
    description: 'Codebase exploration, planning, architecture, debugging, execution, verification'
  },
  review: {
    label: 'Review',
    description: 'Quality, security, and comprehensive code review'
  },
  specialist: {
    label: 'Domain Specialists',
    description: 'Testing, build fixing, UI design, documentation, git, and more'
  },
  coordination: {
    label: 'Coordination',
    description: 'Plan review and critical evaluation'
  }
}

/** Category display order */
export const CATEGORY_ORDER = ['build', 'review', 'specialist', 'coordination']
