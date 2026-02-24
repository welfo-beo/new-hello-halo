import { describe, it, expect } from 'vitest'
import {
  createOrchestrationSignature,
  extractOmcSessionOptions,
  mergeOmcSessionIntoSdkOptions
} from '../../../src/main/services/agent/omc-orchestration'

describe('send-message OMC helpers', () => {
  it('creates stable orchestration signature', () => {
    const signature = createOrchestrationSignature({
      provider: 'omc',
      mode: 'session',
      workflowMode: 'autopilot',
      selectedAgents: ['planner', 'analyst']
    })

    expect(signature).toBe('omc:session:autopilot:analyst,planner')
  })

  it('extracts query options from OMC session payload', () => {
    const options = extractOmcSessionOptions({
      queryOptions: {
        options: {
          systemPrompt: 'omc prompt',
          allowedTools: ['Task']
        }
      }
    })

    expect(options).toEqual({
      systemPrompt: 'omc prompt',
      allowedTools: ['Task']
    })
  })

  it('merges OMC options with local priority and preserves effort/thinking fields', () => {
    const sdkOptions: Record<string, any> = {
      systemPrompt: 'halo-base',
      agents: {
        executor: { description: 'local', prompt: 'local prompt', tools: ['Edit'] }
      },
      mcpServers: {
        local: { command: 'local-cmd', args: [] },
        shared: { command: 'local-shared', args: [] }
      },
      allowedTools: ['Read', 'Write'],
      effort: 'high',
      maxThinkingTokens: 2048
    }

    const merged = mergeOmcSessionIntoSdkOptions(
      sdkOptions,
      {
        systemPrompt: 'omc-system',
        agents: {
          executor: { description: 'omc', prompt: 'omc prompt', tools: ['Task'] },
          planner: { description: 'planner', prompt: 'plan prompt' }
        },
        mcpServers: {
          shared: { command: 'omc-shared', args: [] },
          omc: { command: 'omc-cmd', args: [] }
        },
        allowedTools: ['Task', 'Read']
      },
      {
        aiBrowserEnabled: true,
        aiBrowserPrompt: 'AI Browser prompt text'
      }
    )

    expect(merged.systemPrompt).toContain('halo-base')
    expect(merged.systemPrompt).toContain('omc-system')
    expect(merged.systemPrompt).toContain('AI Browser prompt text')

    // Local executor overrides OMC executor, while OMC planner is preserved.
    expect(merged.agents.executor).toEqual({ description: 'local', prompt: 'local prompt', tools: ['Edit'] })
    expect(merged.agents.planner).toEqual({ description: 'planner', prompt: 'plan prompt' })

    // Local mcp server takes precedence for shared key.
    expect(merged.mcpServers.shared).toEqual({ command: 'local-shared', args: [] })
    expect(merged.mcpServers.local).toEqual({ command: 'local-cmd', args: [] })
    expect(merged.mcpServers.omc).toEqual({ command: 'omc-cmd', args: [] })

    // Allowed tools should be merged and deduplicated.
    expect(new Set(merged.allowedTools)).toEqual(new Set(['Read', 'Write', 'Task']))

    // Effort / thinking remain untouched.
    expect(merged.effort).toBe('high')
    expect(merged.maxThinkingTokens).toBe(2048)
  })
})
