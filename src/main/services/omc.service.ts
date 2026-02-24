/**
 * OMC (Oh-My-ClaudeCode) Integration Service
 *
 * Wraps oh-my-claude-sisyphus and exposes stable integration points for:
 * - Agent definitions and category metadata
 * - Orchestrator system prompt
 * - Session factory compatibility across export renames
 */

import * as omcPackage from 'oh-my-claude-sisyphus'
import type { OmcOptions, OmcSession } from 'oh-my-claude-sisyphus'

export interface OmcAgentDefinition {
  description: string
  prompt: string
  tools?: string[]
  model?: string
}

export interface OmcAgentInfo {
  name: string
  description: string
  model?: string
  category: string
}

type OmcCategory = 'build' | 'review' | 'specialist' | 'coordination'
type OmcFactoryName = 'createSisyphusSession' | 'createOmcSession'
type OmcSessionFactory = (options?: OmcOptions) => OmcSession

/**
 * Full category mapping for OMC agents (canonical + legacy aliases).
 * Legacy aliases are included to prevent silent fallback when upstream reintroduces aliases.
 */
export const OMC_AGENT_CATEGORY_MAP: Record<string, OmcCategory> = {
  // Build / analysis lane
  explore: 'build',
  analyst: 'build',
  planner: 'build',
  architect: 'build',
  debugger: 'build',
  executor: 'build',
  verifier: 'build',

  // Review lane
  'quality-reviewer': 'review',
  'security-reviewer': 'review',
  'code-reviewer': 'review',
  'api-reviewer': 'review',
  'performance-reviewer': 'review',

  // Domain specialists
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

  // Coordination
  critic: 'coordination'
}

let cachedAgents: Record<string, OmcAgentDefinition> | null = null
let cachedSessionFactory: OmcSessionFactory | null = null
let cachedSessionFactoryName: OmcFactoryName | null = null
let loggedFactoryName: OmcFactoryName | null = null

/**
 * Reset internal caches for deterministic unit tests.
 */
export function resetOmcServiceCachesForTest(): void {
  cachedAgents = null
  cachedSessionFactory = null
  cachedSessionFactoryName = null
  loggedFactoryName = null
}

function resolveSessionFactory(): { factory: OmcSessionFactory; name: OmcFactoryName } {
  if (cachedSessionFactory && cachedSessionFactoryName) {
    return { factory: cachedSessionFactory, name: cachedSessionFactoryName }
  }

  const runtimeExports = omcPackage as unknown as Record<string, unknown>
  let sisyphusFactory: unknown
  let omcFactory: unknown

  try {
    sisyphusFactory = runtimeExports.createSisyphusSession
  } catch {
    sisyphusFactory = undefined
  }

  try {
    omcFactory = runtimeExports.createOmcSession
  } catch {
    omcFactory = undefined
  }

  if (typeof sisyphusFactory === 'function') {
    cachedSessionFactory = sisyphusFactory as OmcSessionFactory
    cachedSessionFactoryName = 'createSisyphusSession'
    return { factory: cachedSessionFactory, name: cachedSessionFactoryName }
  }

  if (typeof omcFactory === 'function') {
    cachedSessionFactory = omcFactory as OmcSessionFactory
    cachedSessionFactoryName = 'createOmcSession'
    return { factory: cachedSessionFactory, name: cachedSessionFactoryName }
  }

  throw new Error('OMC session factory not found: expected createSisyphusSession or createOmcSession')
}

function normalizeAgentDefinitions(raw: Record<string, any>): Record<string, OmcAgentDefinition> {
  const normalized: Record<string, OmcAgentDefinition> = {}

  for (const [name, def] of Object.entries(raw)) {
    normalized[name] = {
      description: String(def?.description || ''),
      prompt: String(def?.prompt || ''),
      ...(Array.isArray(def?.tools) ? { tools: def.tools as string[] } : {}),
      ...(typeof def?.model === 'string' ? { model: def.model } : {})
    }
  }

  return normalized
}

function resolveCategory(agentName: string): OmcCategory {
  return OMC_AGENT_CATEGORY_MAP[agentName] || 'specialist'
}

/**
 * Get all OMC agent definitions (cached).
 */
export function getOmcAgents(): Record<string, OmcAgentDefinition> {
  if (!cachedAgents) {
    cachedAgents = normalizeAgentDefinitions(omcPackage.getAgentDefinitions())
  }
  return cachedAgents
}

/**
 * Get OMC agent list with categories (for renderer display).
 */
export function getOmcAgentList(): OmcAgentInfo[] {
  const agents = getOmcAgents()
  return Object.entries(agents).map(([name, def]) => ({
    name,
    description: def.description,
    model: def.model,
    category: resolveCategory(name)
  }))
}

/**
 * Return unmapped agent names (coverage guard for tests and diagnostics).
 */
export function getUnmappedOmcAgents(): string[] {
  const agents = getOmcAgents()
  return Object.keys(agents).filter(name => !(name in OMC_AGENT_CATEGORY_MAP)).sort()
}

/**
 * Get OMC system prompt for orchestration.
 */
export function getOmcSystemPrompt(): string {
  return omcPackage.omcSystemPrompt
}

/**
 * Create a full OMC session (for advanced orchestration).
 */
export function createOmcSessionForSpace(workDir?: string): OmcSession {
  const { factory, name } = resolveSessionFactory()
  if (loggedFactoryName !== name) {
    console.log(`[OMC] Session factory selected: ${name}`)
    loggedFactoryName = name
  }

  return factory({
    workingDirectory: workDir,
    skipConfigLoad: true,
    skipContextInjection: true
  })
}
