import { spawn, type ChildProcess } from 'child_process'
import { getConfig } from './config.service'

export type HookEvent = 'PreToolUse' | 'PostToolUse' | 'Stop' | 'Notification' | 'SubagentStop'
export type HookType = 'command'

export interface Hook {
  type: HookType
  command: string
  timeout?: number
}

export interface HookEntry {
  matcher: string
  hooks: Hook[]
}

export type HooksConfig = Partial<Record<HookEvent, HookEntry[]>>

const MAX_CACHE = 200
const regexCache = new Map<string, RegExp | null>()

function getMatcherRegex(pattern: string): RegExp | null {
  if (regexCache.has(pattern)) return regexCache.get(pattern)!
  if (regexCache.size >= MAX_CACHE) {
    const first = regexCache.keys().next().value
    if (first !== undefined) regexCache.delete(first)
  }
  try {
    const re = new RegExp(pattern)
    regexCache.set(pattern, re)
    return re
  } catch {
    console.warn(`[Hooks] Invalid regex pattern: ${pattern}`)
    regexCache.set(pattern, null)
    return null
  }
}

export function getHooksConfig(): HooksConfig {
  const config = getConfig()
  return config.hooks || {}
}

function killTree(pid: number): void {
  try {
    if (process.platform === 'win32') {
      spawn('taskkill', ['/T', '/F', '/PID', String(pid)], { stdio: 'ignore' })
    } else {
      process.kill(-pid, 'SIGTERM')
    }
  } catch { /* already dead */ }
}

function runCommand(command: string, env: NodeJS.ProcessEnv, timeout: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const isWin = process.platform === 'win32'
    const child: ChildProcess = isWin
      ? spawn('cmd', ['/c', command], { env, stdio: 'ignore' })
      : spawn('sh', ['-c', command], { env, stdio: 'ignore', detached: true })

    const timer = setTimeout(() => {
      if (child.pid) killTree(child.pid)
      reject(new Error('Hook timeout'))
    }, timeout)

    child.on('close', (code) => {
      clearTimeout(timer)
      code === 0 ? resolve() : reject(new Error(`Hook exited with code ${code}`))
    })
    child.on('error', (err) => {
      clearTimeout(timer)
      reject(err)
    })
  })
}

export async function executeHooks(
  event: HookEvent,
  toolName: string,
  toolInput?: Record<string, any>
): Promise<void> {
  const hooksConfig = getHooksConfig()
  const entries = hooksConfig[event] || []

  for (const entry of entries) {
    const regex = getMatcherRegex(entry.matcher)
    if (!regex || !regex.test(toolName)) continue

    for (const hook of entry.hooks) {
      if (hook.type === 'command') {
        const timeout = (hook.timeout || 30) * 1000
        try {
          const env = {
            ...process.env,
            HALO_TOOL_NAME: toolName,
            HALO_TOOL_INPUT: JSON.stringify(toolInput || {})
          }
          await runCommand(hook.command, env, timeout)
        } catch (err) {
          console.warn(`[Hooks] ${event} hook failed for ${toolName}:`, err)
        }
      }
    }
  }
}
