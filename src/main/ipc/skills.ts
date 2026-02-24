import { ipcMain } from 'electron'
import { listSkills } from '../services/skills.service'
import { writeFileSync, mkdirSync, existsSync, unlinkSync } from 'fs'
import { join, resolve, basename } from 'path'
import { getHaloDir } from '../services/config.service'

/** Sanitize skill name to prevent path traversal */
function sanitizeName(name: string): string {
  return basename(name).replace(/[^a-zA-Z0-9_-]/g, '-')
}

/** Check that a resolved path is inside the expected directory */
function isInsideDir(filePath: string, dir: string): boolean {
  const resolved = resolve(filePath)
  return resolved.startsWith(resolve(dir) + require('path').sep) || resolved === resolve(dir)
}

export function registerSkillsHandlers(): void {
  ipcMain.handle('skills:list', async (_event, spaceDir?: string) => {
    try {
      return { success: true, data: listSkills(spaceDir) }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('skills:save', async (_event, name: string, content: string, scope: 'global' | 'space', spaceDir?: string) => {
    try {
      const safeName = sanitizeName(name)
      if (!safeName) return { success: false, error: 'Invalid skill name' }
      const dir = scope === 'global'
        ? join(getHaloDir(), 'skills')
        : join(spaceDir || '', '.halo', 'skills')
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
      const target = join(dir, `${safeName}.md`)
      if (!isInsideDir(target, dir)) return { success: false, error: 'Invalid path' }
      writeFileSync(target, content, 'utf-8')
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('skills:delete', async (_event, filePath: string) => {
    try {
      // Validate the file is inside a known skills directory
      const globalDir = resolve(join(getHaloDir(), 'skills'))
      const resolved = resolve(filePath)
      if (!resolved.startsWith(globalDir + require('path').sep) && !resolved.includes(`${require('path').sep}.halo${require('path').sep}skills${require('path').sep}`)) {
        return { success: false, error: 'Cannot delete files outside skills directories' }
      }
      if (existsSync(resolved)) unlinkSync(resolved)
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })
}
