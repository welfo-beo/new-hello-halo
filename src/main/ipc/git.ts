import { ipcMain } from 'electron'
import { getWorkingDir } from '../services/agent/helpers'
import {
  getGitStatus, getGitDiff, getGitLog,
  gitStage, gitUnstage, gitCommit,
  getGitBranches, gitCheckout, getStagedDiff, getCurrentBranch,
  gitPush, gitPull, gitFetch, gitMerge, gitStash, gitReset,
  gitInit, gitClone, getGitRemotes, gitRemoteAdd, gitRemoteRemove
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
  ipcMain.handle('git:push', (_e, spaceId: string, remote?: string, branch?: string) =>
    gitPush(getWorkingDir(spaceId), remote, branch)
  )
  ipcMain.handle('git:pull', (_e, spaceId: string, remote?: string, branch?: string) =>
    gitPull(getWorkingDir(spaceId), remote, branch)
  )
  ipcMain.handle('git:fetch', (_e, spaceId: string, remote?: string) =>
    gitFetch(getWorkingDir(spaceId), remote)
  )
  ipcMain.handle('git:merge', (_e, spaceId: string, branch: string) =>
    gitMerge(getWorkingDir(spaceId), branch)
  )
  ipcMain.handle('git:stash', (_e, spaceId: string, action?: string, message?: string) =>
    gitStash(getWorkingDir(spaceId), action as any, message)
  )
  ipcMain.handle('git:reset', (_e, spaceId: string, mode?: string, ref?: string) =>
    gitReset(getWorkingDir(spaceId), mode as any, ref)
  )
  ipcMain.handle('git:init', (_e, spaceId: string) =>
    gitInit(getWorkingDir(spaceId))
  )
  ipcMain.handle('git:clone', (_e, url: string, targetDir: string) =>
    gitClone(url, targetDir)
  )
  ipcMain.handle('git:remotes', (_e, spaceId: string) =>
    ({ success: true, data: getGitRemotes(getWorkingDir(spaceId)) })
  )
  ipcMain.handle('git:remote-add', (_e, spaceId: string, name: string, url: string) =>
    gitRemoteAdd(getWorkingDir(spaceId), name, url)
  )
  ipcMain.handle('git:remote-remove', (_e, spaceId: string, name: string) =>
    gitRemoteRemove(getWorkingDir(spaceId), name)
  )
}
