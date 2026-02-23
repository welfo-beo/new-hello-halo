import { ipcMain } from 'electron'
import {
  getGlobalMemoryPath,
  getSpaceMemoryPath,
  readMemory,
  writeMemory
} from '../services/claude-memory.service'
import { getConfig } from '../services/config.service'

export function registerMemoryHandlers(): void {
  ipcMain.handle('memory:read', async (_event, scope: 'global' | 'space', spaceDir?: string) => {
    try {
      const path = scope === 'global' ? getGlobalMemoryPath() : getSpaceMemoryPath(spaceDir || '')
      return { success: true, data: readMemory(path) }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('memory:write', async (_event, scope: 'global' | 'space', content: string, spaceDir?: string) => {
    try {
      const path = scope === 'global' ? getGlobalMemoryPath() : getSpaceMemoryPath(spaceDir || '')
      writeMemory(path, content)
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })
}
