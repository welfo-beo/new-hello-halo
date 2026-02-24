import { describe, it, expect, vi, beforeEach } from 'vitest'
import fs from 'fs'
import path from 'path'
import { ipcMain } from 'electron'
import { initializeApp, getHaloDir } from '../../../src/main/services/config.service'

const mockSpaceService = vi.hoisted(() => {
  const state = { paths: [] as string[] }
  return {
    state,
    getAllSpacePaths: vi.fn(() => state.paths)
  }
})

vi.mock('../../../src/main/services/space.service', () => ({
  getAllSpacePaths: mockSpaceService.getAllSpacePaths
}))

import { registerSkillsHandlers } from '../../../src/main/ipc/skills'

function getIpcHandler(channel: string) {
  const call = vi.mocked(ipcMain.handle).mock.calls.find(([name]) => name === channel)
  if (!call) throw new Error(`IPC handler not found: ${channel}`)
  return call[1] as (...args: any[]) => Promise<{ success: boolean; error?: string }>
}

describe('skills IPC handlers', () => {
  beforeEach(async () => {
    await initializeApp()
    mockSpaceService.state.paths = []
    vi.mocked(ipcMain.handle).mockClear()
    registerSkillsHandlers()
  })

  it('allows deleting a file in global skills directory', async () => {
    const globalSkillsDir = path.join(getHaloDir(), 'skills')
    fs.mkdirSync(globalSkillsDir, { recursive: true })
    const filePath = path.join(globalSkillsDir, 'global.md')
    fs.writeFileSync(filePath, 'content')

    const handler = getIpcHandler('skills:delete')
    const result = await handler({} as any, filePath)

    expect(result.success).toBe(true)
    expect(fs.existsSync(filePath)).toBe(false)
  })

  it('allows deleting a file in a registered space skills directory', async () => {
    const registeredSpaceDir = path.join(globalThis.__HALO_TEST_DIR__, 'space-1')
    mockSpaceService.state.paths = [registeredSpaceDir]

    const skillsDir = path.join(registeredSpaceDir, '.halo', 'skills')
    fs.mkdirSync(skillsDir, { recursive: true })
    const filePath = path.join(skillsDir, 'space.md')
    fs.writeFileSync(filePath, 'content')

    const handler = getIpcHandler('skills:delete')
    const result = await handler({} as any, filePath)

    expect(result.success).toBe(true)
    expect(fs.existsSync(filePath)).toBe(false)
  })

  it('rejects deleting file from unregistered .halo/skills path', async () => {
    const rogueSpaceDir = path.join(globalThis.__HALO_TEST_DIR__, 'rogue-space')
    const rogueSkillsDir = path.join(rogueSpaceDir, '.halo', 'skills')
    fs.mkdirSync(rogueSkillsDir, { recursive: true })
    const filePath = path.join(rogueSkillsDir, 'rogue.md')
    fs.writeFileSync(filePath, 'content')

    const handler = getIpcHandler('skills:delete')
    const result = await handler({} as any, filePath)

    expect(result.success).toBe(false)
    expect(result.error).toContain('outside skills directories')
    expect(fs.existsSync(filePath)).toBe(true)
  })

  it('rejects saving space skill when spaceDir is not registered', async () => {
    const rogueSpaceDir = path.join(globalThis.__HALO_TEST_DIR__, 'rogue-space')
    fs.mkdirSync(rogueSpaceDir, { recursive: true })

    const handler = getIpcHandler('skills:save')
    const result = await handler({} as any, 'demo', 'content', 'space', rogueSpaceDir)

    expect(result.success).toBe(false)
    expect(result.error).toContain('not registered')
    expect(fs.existsSync(path.join(rogueSpaceDir, '.halo', 'skills', 'demo.md'))).toBe(false)
  })
})
