import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockedAgentController = vi.hoisted(() => ({
  sendMessage: vi.fn(async () => ({ success: true })),
  stopGeneration: vi.fn(() => ({ success: true })),
  approveTool: vi.fn(() => ({ success: true })),
  rejectTool: vi.fn(() => ({ success: true })),
  listActiveSessions: vi.fn(() => ({ success: true, data: [] })),
  checkGenerating: vi.fn(() => ({ success: true, data: false })),
  getSessionState: vi.fn(() => ({ success: true, data: null })),
  answerQuestion: vi.fn(() => ({ success: true })),
  testMcpConnections: vi.fn(async () => ({ success: true, servers: [] })),
  getOmcAgents: vi.fn(() => ({ success: true, data: [] })),
  getOmcAgentDefs: vi.fn(() => ({ success: true, data: {} })),
  getOmcSystemPrompt: vi.fn(() => ({ success: true, data: '' }))
}))

vi.mock('../../../src/main/controllers/agent.controller', () => mockedAgentController)
vi.mock('../../../src/main/services/artifact.service', () => ({
  listArtifacts: vi.fn(async () => []),
  listArtifactsTree: vi.fn(async () => []),
  loadTreeChildren: vi.fn(async () => []),
  readArtifactContent: vi.fn(() => ({ content: '', fileType: 'text' })),
  saveArtifactContent: vi.fn(),
  detectFileType: vi.fn(() => ({ fileType: 'text', canPreview: true }))
}))

type RouteHandler = (req: any, res: any) => unknown | Promise<unknown>
type Method = 'get' | 'post' | 'put' | 'delete'

function createMockApp() {
  const handlers: Record<Method, Map<string, RouteHandler>> = {
    get: new Map(),
    post: new Map(),
    put: new Map(),
    delete: new Map()
  }

  const app = {
    get: vi.fn((path: string, ...routeHandlers: RouteHandler[]) => {
      handlers.get.set(path, routeHandlers[routeHandlers.length - 1])
    }),
    post: vi.fn((path: string, ...routeHandlers: RouteHandler[]) => {
      handlers.post.set(path, routeHandlers[routeHandlers.length - 1])
    }),
    put: vi.fn((path: string, ...routeHandlers: RouteHandler[]) => {
      handlers.put.set(path, routeHandlers[routeHandlers.length - 1])
    }),
    delete: vi.fn((path: string, ...routeHandlers: RouteHandler[]) => {
      handlers.delete.set(path, routeHandlers[routeHandlers.length - 1])
    })
  }

  return { app: app as any, handlers }
}

describe('HTTP agent message route orchestration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('forwards orchestration metadata to controller sendMessage', async () => {
    const { registerApiRoutes } = await import('../../../src/main/http/routes/index')
    const { app, handlers } = createMockApp()
    registerApiRoutes(app, null)

    const req = {
      body: {
        spaceId: 'space-1',
        conversationId: 'conv-1',
        message: 'autopilot: build it',
        subagents: [{ name: 'executor', description: 'Exec', prompt: 'Do it' }],
        orchestration: {
          provider: 'omc',
          mode: 'session',
          workflowMode: 'autopilot',
          selectedAgents: ['executor']
        }
      }
    }
    const res = { json: vi.fn() }

    await handlers.post.get('/api/agent/message')?.(req as any, res as any)

    expect(mockedAgentController.sendMessage).toHaveBeenCalledTimes(1)
    expect(mockedAgentController.sendMessage).toHaveBeenCalledWith(
      null,
      expect.objectContaining({
        spaceId: 'space-1',
        conversationId: 'conv-1',
        message: 'autopilot: build it',
        orchestration: {
          provider: 'omc',
          mode: 'session',
          workflowMode: 'autopilot',
          selectedAgents: ['executor']
        }
      })
    )
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }))
  })
})
