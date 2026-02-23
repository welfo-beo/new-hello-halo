import { exec } from 'child_process'
import { promisify } from 'util'
import { getConfig } from './config.service'

const execAsync = promisify(exec)

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

export function getHooksConfig(): HooksConfig {
  const config = getConfig() as any
  return config.hooks || {}
}

export async function executeHooks(
  event: HookEvent,
  toolName: string,
  toolInput?: Record<string, any>
): Promise<void> {
  const hooksConfig = getHooksConfig()
  const entries = hooksConfig[event] || []

  for (const entry of entries) {
    const regex = new RegExp(entry.matcher)
    if (!regex.test(toolName)) continue

    for (const hook of entry.hooks) {
      if (hook.type === 'command') {
        const timeout = (hook.timeout || 30) * 1000
        try {
          const env = {
            ...process.env,
            HALO_TOOL_NAME: toolName,
            HALO_TOOL_INPUT: JSON.stringify(toolInput || {})
          }
          await Promise.race([
            execAsync(hook.command, { env }),
            new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error('Hook timeout')), timeout)
            )
          ])
        } catch (err) {
          console.warn(`[Hooks] ${event} hook failed for ${toolName}:`, err)
        }
      }
    }
  }
}
