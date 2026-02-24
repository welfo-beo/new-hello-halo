import { ipcMain } from 'electron'
import { listSkills } from '../services/skills.service'
import { writeFileSync, mkdirSync, existsSync, unlinkSync } from 'fs'
import { join, resolve, basename, relative, isAbsolute, dirname } from 'path'
import { getHaloDir } from '../services/config.service'
import { getAllSpacePaths } from '../services/space.service'

/** Sanitize skill name to prevent path traversal */
function sanitizeName(name: string): string {
  return basename(name)
    .replace(/[^a-zA-Z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/** Check that a resolved path is inside the expected directory */
function isInsideDir(filePath: string, dir: string): boolean {
  const rel = relative(resolve(dir), resolve(filePath))
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel))
}

function getGlobalSkillsDir(): string {
  return resolve(join(getHaloDir(), 'skills'))
}

function getAllowedSkillsDirs(): string[] {
  const globalDir = getGlobalSkillsDir()
  const spaceSkillDirs = getAllSpacePaths().map(spacePath => resolve(join(spacePath, '.halo', 'skills')))
  return [globalDir, ...spaceSkillDirs]
}

function resolveAllowedSpaceSkillsDir(spaceDir?: string): string | null {
  if (!spaceDir) return null
  const target = resolve(join(spaceDir, '.halo', 'skills'))
  const allowed = getAllowedSkillsDirs()
  return allowed.includes(target) ? target : null
}

function isAllowedSkillsPath(filePath: string): boolean {
  const resolvedFile = resolve(filePath)
  return getAllowedSkillsDirs().some(dir => isInsideDir(resolvedFile, dir))
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
        ? getGlobalSkillsDir()
        : resolveAllowedSpaceSkillsDir(spaceDir)

      if (!dir) {
        return { success: false, error: 'Space directory is not registered' }
      }

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
      if (!isAllowedSkillsPath(filePath)) {
        return { success: false, error: 'Cannot delete files outside skills directories' }
      }

      const resolvedFile = resolve(filePath)
      const dir = dirname(resolvedFile)
      if (!isAllowedSkillsPath(dir)) {
        return { success: false, error: 'Invalid target directory' }
      }

      if (existsSync(resolvedFile)) unlinkSync(resolvedFile)
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })
}
