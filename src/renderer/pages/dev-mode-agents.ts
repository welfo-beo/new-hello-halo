/**
 * Dev Mode Agent Definitions - OMC Integration
 *
 * Types and category mappings for oh-my-claudecode's 21 specialized agents.
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
  model?: 'sonnet' | 'opus' | 'haiku'
}

export interface ResolvedOmcAgents {
  resolvedSubagents: ResolvedSubagent[]
  unresolvedAgents: string[]
}

function normalizeModel(model?: string): 'sonnet' | 'opus' | 'haiku' | undefined {
  if (model === 'sonnet' || model === 'opus' || model === 'haiku') return model
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
      model: normalizeModel(def.model)
    })
  }

  return { resolvedSubagents, unresolvedAgents }
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
