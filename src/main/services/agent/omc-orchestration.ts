import type { AgentRequest } from './types'

export interface OmcSessionOptions {
  systemPrompt?: string
  agents?: Record<string, {
    description: string
    prompt: string
    tools?: string[]
    model?: string
  }>
  mcpServers?: Record<string, any>
  allowedTools?: string[]
}

function appendPromptSection(base: string, section?: string): string {
  if (!section || !section.trim()) return base
  return base ? `${base}\n\n${section}` : section
}

/**
 * Build orchestration signature for session rebuild detection.
 */
export function createOrchestrationSignature(orchestration?: AgentRequest['orchestration']): string {
  if (!orchestration || orchestration.provider !== 'omc' || orchestration.mode !== 'session') return ''
  const selectedAgents = [...(orchestration.selectedAgents || [])].sort()
  return `omc:${orchestration.mode}:${orchestration.workflowMode}:${selectedAgents.join(',')}`
}

/**
 * Extract OMC query options from session payload.
 */
export function extractOmcSessionOptions(session: { queryOptions?: unknown }): OmcSessionOptions {
  const queryOptions = session.queryOptions as { options?: OmcSessionOptions } | undefined
  return queryOptions?.options || {}
}

/**
 * Merge OMC session options into SDK options.
 *
 * Merge priority:
 * - systemPrompt: Halo base -> OMC -> AI Browser
 * - agents: OMC defaults, local overrides
 * - allowedTools: union
 * - mcpServers: OMC defaults, local overrides
 */
export function mergeOmcSessionIntoSdkOptions(
  sdkOptions: Record<string, any>,
  omcOptions: OmcSessionOptions,
  options?: {
    aiBrowserEnabled?: boolean
    aiBrowserPrompt?: string
  }
): Record<string, any> {
  const aiBrowserEnabled = !!options?.aiBrowserEnabled
  const aiBrowserPrompt = options?.aiBrowserPrompt

  const localAgents = (sdkOptions.agents && typeof sdkOptions.agents === 'object') ? sdkOptions.agents : {}
  const omcAgents = (omcOptions.agents && typeof omcOptions.agents === 'object') ? omcOptions.agents : {}
  const mergedAgents = { ...omcAgents, ...localAgents }
  if (Object.keys(mergedAgents).length > 0) {
    sdkOptions.agents = mergedAgents
  }

  const localMcpServers = (sdkOptions.mcpServers && typeof sdkOptions.mcpServers === 'object') ? sdkOptions.mcpServers : {}
  const omcMcpServers = (omcOptions.mcpServers && typeof omcOptions.mcpServers === 'object') ? omcOptions.mcpServers : {}
  const mergedMcpServers = { ...omcMcpServers, ...localMcpServers }
  if (Object.keys(mergedMcpServers).length > 0) {
    sdkOptions.mcpServers = mergedMcpServers
  }

  const localAllowedTools = Array.isArray(sdkOptions.allowedTools) ? sdkOptions.allowedTools : []
  const omcAllowedTools = Array.isArray(omcOptions.allowedTools) ? omcOptions.allowedTools : []
  sdkOptions.allowedTools = [...new Set([...localAllowedTools, ...omcAllowedTools])]

  const basePrompt = typeof sdkOptions.systemPrompt === 'string' ? sdkOptions.systemPrompt : ''
  const withOmcPrompt = appendPromptSection(basePrompt, omcOptions.systemPrompt)
  sdkOptions.systemPrompt = (aiBrowserEnabled && aiBrowserPrompt)
    ? appendPromptSection(withOmcPrompt, aiBrowserPrompt)
    : withOmcPrompt

  return sdkOptions
}
