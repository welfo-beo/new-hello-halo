/**
 * Git Service - Workspace git operations
 */

import { execSync } from 'child_process'
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

function exec(cmd: string, cwd: string): string {
  try {
    return execSync(cmd, { cwd, encoding: 'utf-8', timeout: 10000 }).trim()
  } catch {
    return ''
  }
}

export function isGitRepo(workDir: string): boolean {
  return existsSync(join(workDir, '.git'))
}

export function getGitStatus(workDir: string): GitFileStatus[] {
  if (!isGitRepo(workDir)) return []
  const output = exec('git status --porcelain', workDir)
  if (!output) return []

  return output.split('\n').filter(Boolean).map(line => {
    const xy = line.substring(0, 2)
    const path = line.substring(3).trim()
    const staged = xy[0] !== ' ' && xy[0] !== '?'
    const status: GitFileStatus['status'] = xy[0] === '?' ? 'untracked'
      : xy[0] === 'A' || xy[1] === 'A' ? 'added'
      : xy[0] === 'D' || xy[1] === 'D' ? 'deleted'
      : xy[0] === 'R' || xy[1] === 'R' ? 'renamed'
      : 'modified'
    return { path, status, staged }
  })
}

export function getGitDiff(workDir: string, filePath?: string, staged = false): string {
  if (!isGitRepo(workDir)) return ''
  const stagedFlag = staged ? '--staged' : ''
  const fileArg = filePath ? `-- "${filePath}"` : ''
  return exec(`git diff ${stagedFlag} ${fileArg}`.trim(), workDir)
}

export function getGitLog(workDir: string, limit = 10): GitCommit[] {
  if (!isGitRepo(workDir)) return []
  const output = exec(`git log -${limit} --format="%H|%s|%an|%ar"`, workDir)
  if (!output) return []

  return output.split('\n').filter(Boolean).map(line => {
    const parts = line.split('|')
    return {
      hash: (parts[0] || '').substring(0, 7),
      message: parts[1] || '',
      author: parts[2] || '',
      date: parts[3] || ''
    }
  })
}
