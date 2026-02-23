import { join } from 'path'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs'
import { homedir } from 'os'
import { getHaloDir } from './config.service'

export function getGlobalMemoryPath(): string {
  return join(getHaloDir(), 'CLAUDE.md')
}

export function getSpaceMemoryPath(spaceDir: string): string {
  return join(spaceDir, '.halo', 'CLAUDE.md')
}

export function readMemory(path: string): string {
  if (!existsSync(path)) return ''
  try {
    return readFileSync(path, 'utf-8')
  } catch {
    return ''
  }
}

export function writeMemory(path: string, content: string): void {
  const dir = join(path, '..')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  writeFileSync(path, content, 'utf-8')
}

export function buildMemorySystemPrompt(spaceDir?: string): string {
  const parts: string[] = []
  const global = readMemory(getGlobalMemoryPath())
  if (global.trim()) parts.push(`# Global Memory (CLAUDE.md)\n${global}`)
  if (spaceDir) {
    const space = readMemory(getSpaceMemoryPath(spaceDir))
    if (space.trim()) parts.push(`# Space Memory (CLAUDE.md)\n${space}`)
  }
  return parts.join('\n\n')
}
