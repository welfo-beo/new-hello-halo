import { ipcMain } from 'electron'
import { getWorkingDir } from '../services/agent/helpers'
import { getGitStatus, getGitDiff, getGitLog } from '../services/git.service'

export function registerGitHandlers(): void {
  ipcMain.handle('git:status', (_e, spaceId: string) =>
    getGitStatus(getWorkingDir(spaceId))
  )
  ipcMain.handle('git:diff', (_e, spaceId: string, filePath?: string, staged = false) =>
    getGitDiff(getWorkingDir(spaceId), filePath, staged)
  )
  ipcMain.handle('git:log', (_e, spaceId: string, limit = 10) =>
    getGitLog(getWorkingDir(spaceId), limit)
  )
}
