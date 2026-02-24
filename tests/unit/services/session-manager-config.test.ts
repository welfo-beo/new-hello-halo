import { describe, expect, it } from 'vitest'
import type { SessionConfig } from '../../../src/main/services/agent/types'
import { needsSessionRebuildConfig } from '../../../src/main/services/agent/session-config'

describe('needsSessionRebuild', () => {
  it('rebuilds when orchestration signature changes', () => {
    const existing: SessionConfig = {
      aiBrowserEnabled: false,
      effort: 'high',
      subagentsSignature: 'manual',
      orchestrationSignature: 'omc:session:autopilot:analyst'
    }

    const nextConfig: SessionConfig = {
      aiBrowserEnabled: false,
      effort: 'high',
      subagentsSignature: 'manual',
      orchestrationSignature: 'omc:session:ralph:analyst'
    }

    expect(needsSessionRebuildConfig(existing, nextConfig)).toBe(true)
  })
})
