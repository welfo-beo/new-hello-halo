import { ipcMain } from 'electron'
import { listSkills } from '../services/skills.service'
import { writeFileSync, mkdirSync, existsSync, unlinkSync } from 'fs'
import { join } from 'path'
import { getHaloDir } from '../services/config.service'

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
      const dir = scope === 'global'
        ? join(getHaloDir(), 'skills')
        : join(spaceDir || '', '.halo', 'skills')
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
      writeFileSync(join(dir, `${name}.md`), content, 'utf-8')
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('skills:delete', async (_event, filePath: string) => {
    try {
      if (existsSync(filePath)) unlinkSync(filePath)
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })
}
