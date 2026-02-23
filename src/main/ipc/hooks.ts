import { ipcMain } from 'electron'
import { getConfig, saveConfig } from '../services/config.service'
import type { HooksConfig } from '../services/hooks.service'

export function registerHooksHandlers(): void {
  ipcMain.handle('hooks:get', async () => {
    try {
      const config = getConfig() as any
      return { success: true, data: config.hooks || {} }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('hooks:set', async (_event, hooks: HooksConfig) => {
    try {
      saveConfig({ hooks } as any)
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })
}
