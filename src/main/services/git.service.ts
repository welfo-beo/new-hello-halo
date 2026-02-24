/**
 * Git Service - Workspace git operations
 */

import { execFileSync } from 'child_process'
import { existsSync } from 'fs'
import { join } from 'path'

export interface GitFileStatus {
  path: string
  status: 'modified' | 'added' | 'deleted' | 'renamed' | 'untracked'
  staged: boolean
}

export interface GitCommit {
  hash: string
  message: string
  author: string
  date: string
}

function gitExec(args: string[], cwd: string, timeout = 10000): string {
  try {
    return execFileSync('git', args, { cwd, encoding: 'utf-8', timeout }).trim()
  } catch {
    return ''
  }
}

export function isGitRepo(workDir: string): boolean {
  return existsSync(join(workDir, '.git'))
}

export function getGitStatus(workDir: string): GitFileStatus[] {
  if (!isGitRepo(workDir)) return []
  const output = gitExec(['status', '--porcelain'], workDir)
  if (!output) return []

  return output.split('\n').filter(Boolean).map(line => {
    const xy = line.substring(0, 2)
    let filePath = line.substring(3).trim()
    // Handle renamed files: "old -> new"
    if ((xy[0] === 'R' || xy[1] === 'R') && filePath.includes(' -> ')) {
      filePath = filePath.split(' -> ')[1]
    }
    const staged = xy[0] !== ' ' && xy[0] !== '?'
    const status: GitFileStatus['status'] = xy[0] === '?' ? 'untracked'
      : xy[0] === 'A' || xy[1] === 'A' ? 'added'
      : xy[0] === 'D' || xy[1] === 'D' ? 'deleted'
      : xy[0] === 'R' || xy[1] === 'R' ? 'renamed'
      : 'modified'
    return { path: filePath, status, staged }
  })
}

export function getGitDiff(workDir: string, filePath?: string, staged = false): string {
  if (!isGitRepo(workDir)) return ''
  const args = ['diff']
  if (staged) args.push('--staged')
  if (filePath) args.push('--', filePath)
  return gitExec(args, workDir)
}

export function getGitLog(workDir: string, limit = 10): GitCommit[] {
  if (!isGitRepo(workDir)) return []
  const SEP = '\x1f'
  const output = gitExec(['log', `-${limit}`, `--format=%H${SEP}%s${SEP}%an${SEP}%ar`], workDir)
  if (!output) return []

  return output.split('\n').filter(Boolean).map(line => {
    const parts = line.split(SEP)
    return {
      hash: (parts[0] || '').substring(0, 7),
      message: parts[1] || '',
      author: parts[2] || '',
      date: parts[3] || ''
    }
  })
}

export function gitStage(workDir: string, filePath: string): boolean {
  if (!isGitRepo(workDir)) return false
  return gitExec(['add', '--', filePath], workDir) !== null
}

export function gitUnstage(workDir: string, filePath: string): boolean {
  if (!isGitRepo(workDir)) return false
  gitExec(['restore', '--staged', '--', filePath], workDir)
  return true
}

export function gitCommit(workDir: string, message: string): { success: boolean; error?: string } {
  if (!isGitRepo(workDir)) return { success: false, error: 'Not a git repo' }
  try {
    execFileSync('git', ['commit', '-m', message], { cwd: workDir, encoding: 'utf-8', timeout: 15000 })
    return { success: true }
  } catch (e: any) {
    return { success: false, error: e.stderr || e.message }
  }
}

export interface GitBranch {
  name: string
  current: boolean
  remote: boolean
}

export function getGitBranches(workDir: string): GitBranch[] {
  if (!isGitRepo(workDir)) return []
  const output = gitExec(['branch', '-a'], workDir)
  if (!output) return []
  return output.split('\n').filter(Boolean).map(line => {
    const current = line.startsWith('*')
    const name = line.replace(/^\*?\s+/, '').replace(/^remotes\//, '')
    return { name, current, remote: line.includes('remotes/') }
  })
}

export function gitCheckout(workDir: string, branch: string, create = false): { success: boolean; error?: string } {
  if (!isGitRepo(workDir)) return { success: false, error: 'Not a git repo' }
  try {
    const args = create ? ['checkout', '-b', branch] : ['checkout', branch]
    execFileSync('git', args, { cwd: workDir, encoding: 'utf-8', timeout: 15000 })
    return { success: true }
  } catch (e: any) {
    return { success: false, error: e.stderr || e.message }
  }
}

export function getStagedDiff(workDir: string): string {
  return getGitDiff(workDir, undefined, true)
}

export function getCurrentBranch(workDir: string): string {
  if (!isGitRepo(workDir)) return ''
  return gitExec(['branch', '--show-current'], workDir)
}

export function gitPush(workDir: string, remote = 'origin', branch?: string): { success: boolean; error?: string } {
  if (!isGitRepo(workDir)) return { success: false, error: 'Not a git repo' }
  try {
    const args = ['push', remote]
    if (branch) args.push(branch)
    execFileSync('git', args, { cwd: workDir, encoding: 'utf-8', timeout: 30000 })
    return { success: true }
  } catch (e: any) {
    return { success: false, error: e.stderr || e.message }
  }
}

export function gitPull(workDir: string, remote = 'origin', branch?: string): { success: boolean; error?: string } {
  if (!isGitRepo(workDir)) return { success: false, error: 'Not a git repo' }
  try {
    const args = ['pull', remote]
    if (branch) args.push(branch)
    execFileSync('git', args, { cwd: workDir, encoding: 'utf-8', timeout: 30000 })
    return { success: true }
  } catch (e: any) {
    return { success: false, error: e.stderr || e.message }
  }
}

export function gitFetch(workDir: string, remote?: string): { success: boolean; error?: string } {
  if (!isGitRepo(workDir)) return { success: false, error: 'Not a git repo' }
  try {
    const args = remote ? ['fetch', remote] : ['fetch', '--all']
    execFileSync('git', args, { cwd: workDir, encoding: 'utf-8', timeout: 30000 })
    return { success: true }
  } catch (e: any) {
    return { success: false, error: e.stderr || e.message }
  }
}

export function gitMerge(workDir: string, branch: string): { success: boolean; error?: string } {
  if (!isGitRepo(workDir)) return { success: false, error: 'Not a git repo' }
  try {
    execFileSync('git', ['merge', branch], { cwd: workDir, encoding: 'utf-8', timeout: 30000 })
    return { success: true }
  } catch (e: any) {
    return { success: false, error: e.stderr || e.message }
  }
}

export function gitStash(workDir: string, action: 'push' | 'pop' | 'list' | 'drop' = 'push', message?: string): { success: boolean; output?: string; error?: string } {
  if (!isGitRepo(workDir)) return { success: false, error: 'Not a git repo' }
  try {
    const args = ['stash', action]
    if (action === 'push' && message) args.push('-m', message)
    const output = execFileSync('git', args, { cwd: workDir, encoding: 'utf-8', timeout: 15000 }).trim()
    return { success: true, output }
  } catch (e: any) {
    return { success: false, error: e.stderr || e.message }
  }
}

export function gitReset(workDir: string, mode: 'soft' | 'mixed' | 'hard' = 'mixed', ref?: string): { success: boolean; error?: string } {
  if (!isGitRepo(workDir)) return { success: false, error: 'Not a git repo' }
  try {
    const args = ['reset', `--${mode}`]
    if (ref) args.push(ref)
    execFileSync('git', args, { cwd: workDir, encoding: 'utf-8', timeout: 15000 })
    return { success: true }
  } catch (e: any) {
    return { success: false, error: e.stderr || e.message }
  }
}

export function gitInit(workDir: string): { success: boolean; error?: string } {
  try {
    execFileSync('git', ['init'], { cwd: workDir, encoding: 'utf-8', timeout: 10000 })
    return { success: true }
  } catch (e: any) {
    return { success: false, error: e.stderr || e.message }
  }
}

export function gitClone(url: string, targetDir: string): { success: boolean; error?: string } {
  try {
    execFileSync('git', ['clone', url, targetDir], { encoding: 'utf-8', timeout: 120000 })
    return { success: true }
  } catch (e: any) {
    return { success: false, error: e.stderr || e.message }
  }
}

export interface GitRemote {
  name: string
  url: string
  type: 'fetch' | 'push'
}

export function getGitRemotes(workDir: string): GitRemote[] {
  if (!isGitRepo(workDir)) return []
  const output = gitExec(['remote', '-v'], workDir)
  if (!output) return []
  return output.split('\n').filter(Boolean).map(line => {
    const [name, rest] = line.split('\t')
    const match = rest?.match(/^(.+)\s+\((fetch|push)\)$/)
    return { name: name || '', url: match?.[1] || '', type: (match?.[2] || 'fetch') as 'fetch' | 'push' }
  })
}

export function gitRemoteAdd(workDir: string, name: string, url: string): { success: boolean; error?: string } {
  if (!isGitRepo(workDir)) return { success: false, error: 'Not a git repo' }
  try {
    execFileSync('git', ['remote', 'add', name, url], { cwd: workDir, encoding: 'utf-8', timeout: 10000 })
    return { success: true }
  } catch (e: any) {
    return { success: false, error: e.stderr || e.message }
  }
}

export function gitRemoteRemove(workDir: string, name: string): { success: boolean; error?: string } {
  if (!isGitRepo(workDir)) return { success: false, error: 'Not a git repo' }
  try {
    execFileSync('git', ['remote', 'remove', name], { cwd: workDir, encoding: 'utf-8', timeout: 10000 })
    return { success: true }
  } catch (e: any) {
    return { success: false, error: e.stderr || e.message }
  }
}
