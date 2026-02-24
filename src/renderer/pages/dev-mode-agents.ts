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
