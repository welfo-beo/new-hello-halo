import { describe, it, expect, vi, beforeEach } from 'vitest'
import fs from 'fs'
import path from 'path'
import { getHooksConfig, executeHooks } from '../../../src/main/services/hooks.service'
import { saveConfig, initializeApp } from '../../../src/main/services/config.service'

// Mock child_process to avoid running real commands
vi.mock('child_process', () => {
  const mockOn = vi.fn()
  const mockChild = { pid: 123, on: mockOn, kill: vi.fn() }
  const mockSpawn = vi.fn(() => {
    // Simulate immediate success by default
    setTimeout(() => {
      const closeHandler = mockOn.mock.calls.find(c => c[0] === 'close')
      if (closeHandler) closeHandler[1](0)
    }, 0)
    return mockChild
  })
  return { spawn: mockSpawn, __mockChild: mockChild, __mockOn: mockOn }
})

describe('Hooks Service', () => {
  beforeEach(async () => {
    await initializeApp()
  })

  describe('getHooksConfig', () => {
    it('should return empty object when no hooks configured', () => {
      const config = getHooksConfig()
      expect(config).toEqual({})
    })

    it('should return hooks from config', () => {
      const hooks = {
        PreToolUse: [{ matcher: '.*', hooks: [{ type: 'command' as const, command: 'echo test' }] }]
      }
      saveConfig({ hooks } as any)

      const config = getHooksConfig()
      expect(config.PreToolUse).toHaveLength(1)
      expect(config.PreToolUse![0].matcher).toBe('.*')
    })
  })

  describe('executeHooks', () => {
    it('should not throw when no hooks configured', async () => {
      await expect(executeHooks('PreToolUse', 'some_tool')).resolves.toBeUndefined()
    })

    it('should execute matching hooks', async () => {
      const { spawn } = await import('child_process')
      const hooks = {
        PreToolUse: [{ matcher: 'Write', hooks: [{ type: 'command' as const, command: 'echo writing' }] }]
      }
      saveConfig({ hooks } as any)

      await executeHooks('PreToolUse', 'Write', { path: '/test' })
      expect(spawn).toHaveBeenCalled()
    })

    it('should skip non-matching hooks', async () => {
      const { spawn } = await import('child_process')
      vi.mocked(spawn).mockClear()

      const hooks = {
        PreToolUse: [{ matcher: '^Read$', hooks: [{ type: 'command' as const, command: 'echo read' }] }]
      }
      saveConfig({ hooks } as any)

      await executeHooks('PreToolUse', 'Write')
      expect(spawn).not.toHaveBeenCalled()
    })

    it('should handle invalid regex gracefully', async () => {
      const hooks = {
        PreToolUse: [{ matcher: '[invalid', hooks: [{ type: 'command' as const, command: 'echo bad' }] }]
      }
      saveConfig({ hooks } as any)

      await expect(executeHooks('PreToolUse', 'test')).resolves.toBeUndefined()
    })
  })
})
