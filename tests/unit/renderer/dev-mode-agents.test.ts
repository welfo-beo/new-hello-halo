import { describe, it, expect } from 'vitest'
import { resolveSelectedOmcAgents } from '../../../src/renderer/pages/dev-mode-agents'

describe('resolveSelectedOmcAgents', () => {
  it('returns unresolved when defs are empty', () => {
    const selected = new Set(['analyst', 'planner'])
    const result = resolveSelectedOmcAgents(selected, {})

    expect(result.resolvedSubagents).toHaveLength(0)
    expect(result.unresolvedAgents).toEqual(['analyst', 'planner'])
  })

  it('resolves partial defs and reports missing agents', () => {
    const selected = new Set(['analyst', 'planner'])
    const defs = {
      analyst: {
        description: 'Analyze requirements',
        prompt: 'Do analysis',
        model: 'sonnet'
      }
    }

    const result = resolveSelectedOmcAgents(selected, defs)

    expect(result.resolvedSubagents).toHaveLength(1)
    expect(result.resolvedSubagents[0]).toEqual({
      name: 'analyst',
      description: 'Analyze requirements',
      prompt: 'Do analysis',
      model: 'sonnet'
    })
    expect(result.unresolvedAgents).toEqual(['planner'])
  })

  it('resolves all selected agents when defs are complete', () => {
    const selected = new Set(['analyst', 'planner', 'executor'])
    const defs = {
      analyst: { description: 'A', prompt: 'PA', model: 'sonnet' },
      planner: { description: 'B', prompt: 'PB', model: 'opus' },
      executor: { description: 'C', prompt: 'PC', model: 'haiku' }
    }

    const result = resolveSelectedOmcAgents(selected, defs)

    expect(result.unresolvedAgents).toHaveLength(0)
    expect(result.resolvedSubagents).toHaveLength(3)
    expect(result.resolvedSubagents.map(a => a.name)).toEqual(['analyst', 'planner', 'executor'])
  })

  it('preserves tools and supports inherit model', () => {
    const selected = new Set(['executor'])
    const defs = {
      executor: {
        description: 'Executes tasks',
        prompt: 'Do work',
        tools: ['Read', 'Edit'],
        model: 'inherit'
      }
    }

    const result = resolveSelectedOmcAgents(selected, defs)
    expect(result.unresolvedAgents).toEqual([])
    expect(result.resolvedSubagents).toEqual([{
      name: 'executor',
      description: 'Executes tasks',
      prompt: 'Do work',
      tools: ['Read', 'Edit'],
      model: 'inherit'
    }])
  })
})
