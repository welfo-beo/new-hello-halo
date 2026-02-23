import { ipcMain } from 'electron'
import { getWorkingDir } from '../services/agent/helpers'
import {
  getGitStatus, getGitDiff, getGitLog,
  gitStage, gitUnstage, gitCommit,
  getGitBranches, gitCheckout, getStagedDiff, getCurrentBranch
} from '../services/git.service'

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
  ipcMain.handle('git:stage', (_e, spaceId: string, filePath: string) =>
    ({ success: gitStage(getWorkingDir(spaceId), filePath) })
  )
  ipcMain.handle('git:unstage', (_e, spaceId: string, filePath: string) =>
    ({ success: gitUnstage(getWorkingDir(spaceId), filePath) })
  )
  ipcMain.handle('git:commit', (_e, spaceId: string, message: string) =>
    gitCommit(getWorkingDir(spaceId), message)
  )
  ipcMain.handle('git:branches', (_e, spaceId: string) =>
    ({ success: true, data: getGitBranches(getWorkingDir(spaceId)) })
  )
  ipcMain.handle('git:checkout', (_e, spaceId: string, branch: string, create = false) =>
    gitCheckout(getWorkingDir(spaceId), branch, create)
  )
  ipcMain.handle('git:staged-diff', (_e, spaceId: string) =>
    ({ success: true, data: getStagedDiff(getWorkingDir(spaceId)) })
  )
  ipcMain.handle('git:current-branch', (_e, spaceId: string) =>
    ({ success: true, data: getCurrentBranch(getWorkingDir(spaceId)) })
  )
}
