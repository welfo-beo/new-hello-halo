import { ipcMain } from 'electron'
import { searchFiles } from '../services/file-search.service'
import { getWorkingDir } from '../services/agent/helpers'

export function registerFileSearchHandlers(): void {
  ipcMain.handle('file-search:execute', async (_event, query: string, spaceId: string) => {
    const workDir = getWorkingDir(spaceId)
    return searchFiles(query, workDir)
  })
}
