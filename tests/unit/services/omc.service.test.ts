import { beforeEach, describe, expect, it, vi } from 'vitest'

function createMockSession() {
  return {
    queryOptions: {
      options: {
        systemPrompt: 'omc-system',
        agents: {},
        mcpServers: {},
        allowedTools: ['Task'],
        permissionMode: 'acceptEdits'
      }
    },
    state: {
      activeAgents: new Map(),
      backgroundTasks: [],
      contextFiles: []
    },
    config: {},
    processPrompt: (prompt: string) => prompt,
    detectKeywords: () => [],
    backgroundTasks: {
      getRunningCount: () => 0,
      getMaxTasks: () => 3
    },
    shouldRunInBackground: () => ({ shouldBackground: false, reason: 'test' })
  }
}

function createAllMappedDefinitions() {
  const names = [
    'explore',
    'analyst',
    'planner',
    'architect',
    'debugger',
    'executor',
    'verifier',
    'quality-reviewer',
    'security-reviewer',
    'code-reviewer',
    'deep-executor',
    'test-engineer',
    'build-fixer',
    'designer',
    'writer',
    'qa-tester',
    'scientist',
    'git-master',
    'code-simplifier',
    'critic',
    'document-specialist'
  ]

  return Object.fromEntries(names.map(name => [name, {
    description: `${name} description`,
    prompt: `${name} prompt`,
    tools: ['Read']
  }]))
}

describe('omc.service', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('prefers createSisyphusSession when available', async () => {
    const createSisyphusSession = vi.fn(() => createMockSession())
    const createOmcSession = vi.fn(() => createMockSession())

    vi.doMock('oh-my-claude-sisyphus', () => ({
      getAgentDefinitions: vi.fn(() => createAllMappedDefinitions()),
      omcSystemPrompt: 'omc-system',
      createSisyphusSession,
      createOmcSession
    }))

    const service = await import('../../../src/main/services/omc.service')
    service.createOmcSessionForSpace('/workspace')

    expect(createSisyphusSession).toHaveBeenCalledTimes(1)
    expect(createSisyphusSession).toHaveBeenCalledWith(expect.objectContaining({
      workingDirectory: '/workspace',
      skipConfigLoad: true,
      skipContextInjection: true
    }))
    expect(createOmcSession).not.toHaveBeenCalled()
  })

  it('falls back to createOmcSession when createSisyphusSession is unavailable', async () => {
    const createOmcSession = vi.fn(() => createMockSession())

    vi.doMock('oh-my-claude-sisyphus', () => ({
      getAgentDefinitions: vi.fn(() => createAllMappedDefinitions()),
      omcSystemPrompt: 'omc-system',
      createSisyphusSession: undefined,
      createOmcSession
    }))

    const service = await import('../../../src/main/services/omc.service')
    service.createOmcSessionForSpace('/workspace')

    expect(createOmcSession).toHaveBeenCalledTimes(1)
    expect(createOmcSession).toHaveBeenCalledWith(expect.objectContaining({
      workingDirectory: '/workspace',
      skipConfigLoad: true,
      skipContextInjection: true
    }))
  })

  it('maintains 100% category coverage for loaded agent definitions', async () => {
    const defs = createAllMappedDefinitions()

    vi.doMock('oh-my-claude-sisyphus', () => ({
      getAgentDefinitions: vi.fn(() => defs),
      omcSystemPrompt: 'omc-system',
      createSisyphusSession: undefined,
      createOmcSession: vi.fn(() => createMockSession())
    }))

    const service = await import('../../../src/main/services/omc.service')
    const list = service.getOmcAgentList()
    const unmapped = service.getUnmappedOmcAgents()

    expect(unmapped).toEqual([])
    expect(new Set(list.map(a => a.name))).toEqual(new Set(Object.keys(defs)))
  })
})
