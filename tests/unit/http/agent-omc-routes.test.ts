import { describe, it, expect, vi, beforeEach } from 'vitest'
import { registerApiRoutes } from '../../../src/main/http/routes/index'

const mockedAgentController = vi.hoisted(() => ({
  sendMessage: vi.fn(),
  stopGeneration: vi.fn(),
  approveTool: vi.fn(),
  rejectTool: vi.fn(),
  listActiveSessions: vi.fn(),
  checkGenerating: vi.fn(),
  getSessionState: vi.fn(),
  answerQuestion: vi.fn(),
  testMcpConnections: vi.fn(),
  getOmcAgents: vi.fn(() => ({ success: true, data: [{ name: 'analyst' }] })),
  getOmcAgentDefs: vi.fn(() => ({ success: true, data: { analyst: { description: 'A', prompt: 'P' } } })),
  getOmcSystemPrompt: vi.fn(() => ({ success: true, data: 'system-prompt' }))
}))

vi.mock('../../../src/main/controllers/agent.controller', () => mockedAgentController)

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

describe('HTTP OMC agent routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should register OMC GET endpoints', () => {
    const { app, handlers } = createMockApp()
    registerApiRoutes(app, null)

    expect(handlers.get.has('/api/agent/omc-agents')).toBe(true)
    expect(handlers.get.has('/api/agent/omc-agent-defs')).toBe(true)
    expect(handlers.get.has('/api/agent/omc-system-prompt')).toBe(true)
  })

  it('should return success=true for OMC endpoints', async () => {
    const { app, handlers } = createMockApp()
    registerApiRoutes(app, null)

    const res1 = { json: vi.fn() }
    const res2 = { json: vi.fn() }
    const res3 = { json: vi.fn() }

    await handlers.get.get('/api/agent/omc-agents')?.({} as any, res1 as any)
    await handlers.get.get('/api/agent/omc-agent-defs')?.({} as any, res2 as any)
    await handlers.get.get('/api/agent/omc-system-prompt')?.({} as any, res3 as any)

    expect(res1.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }))
    expect(res2.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }))
    expect(res3.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }))
    expect(mockedAgentController.getOmcAgents).toHaveBeenCalledTimes(1)
    expect(mockedAgentController.getOmcAgentDefs).toHaveBeenCalledTimes(1)
    expect(mockedAgentController.getOmcSystemPrompt).toHaveBeenCalledTimes(1)
  })
})
