import type { SessionConfig } from './types'

/**
 * Check if session config requires rebuild.
 * Only process-level params should be included here.
 */
export function needsSessionRebuildConfig(existing: SessionConfig, next: SessionConfig): boolean {
  return existing.aiBrowserEnabled !== next.aiBrowserEnabled
    || existing.effort !== next.effort
    || existing.subagentsSignature !== next.subagentsSignature
    || existing.orchestrationSignature !== next.orchestrationSignature
}
