/**
 * OMC (Oh-My-ClaudeCode) Integration Service
 *
 * Wraps oh-my-claude-sisyphus to provide OMC's 21 specialized agents
 * and orchestration capabilities for Dev Mode.
 */

import { getAgentDefinitions, omcSystemPrompt, createOmcSession } from 'oh-my-claude-sisyphus'
import type { OmcSession } from 'oh-my-claude-sisyphus'

export interface OmcAgentInfo {
  name: string
  description: string
  model?: string
  category: string
}

// OMC agent → category mapping
const AGENT_CATEGORIES: Record<string, string> = {
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
  'deep-executor': 'specialist',
  'test-engineer': 'specialist',
  'build-fixer': 'specialist',
  designer: 'specialist',
  writer: 'specialist',
  'qa-tester': 'specialist',
  scientist: 'specialist',
  'git-master': 'specialist',
  'code-simplifier': 'specialist',
  critic: 'coordination',
  'document-specialist': 'specialist'
}

let cachedAgents: Record<string, { description: string; prompt: string; tools?: string[]; model?: string }> | null = null

/**
 * Get all OMC agent definitions (cached)
 */
export function getOmcAgents(): Record<string, { description: string; prompt: string; tools?: string[]; model?: string }> {
  if (!cachedAgents) {
    cachedAgents = getAgentDefinitions()
  }
  return cachedAgents
}

/**
 * Get OMC agent list with categories (for renderer display)
 */
export function getOmcAgentList(): OmcAgentInfo[] {
  const agents = getOmcAgents()
  return Object.entries(agents).map(([name, def]) => ({
    name,
    description: def.description,
    model: def.model,
    category: AGENT_CATEGORIES[name] || 'specialist'
  }))
}

/**
 * Get OMC system prompt for orchestration
 */
export function getOmcSystemPrompt(): string {
  return omcSystemPrompt
}

/**
 * Create a full OMC session (for advanced orchestration)
 */
export function createOmcSessionForSpace(workDir?: string): OmcSession {
  return createOmcSession({
    workingDirectory: workDir,
    skipConfigLoad: true,
    skipContextInjection: true
  })
}
