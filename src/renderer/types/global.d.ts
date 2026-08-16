/**
 * Global type declarations for renderer process
 * Extends Window interface with Electron preload APIs
 */

import type { HaloAPI } from '../../preload/index'

declare global {
  interface Window {
    halo: HaloAPI
    platform: {
      platform: 'darwin' | 'win32' | 'linux'
      isMac: boolean
      isWindows: boolean
      isLinux: boolean
    }
    electron?: {
      ipcRenderer: {
        on: (channel: string, callback: (...args: unknown[]) => void) => void
        removeListener: (channel: string, callback: (...args: unknown[]) => void) => void
        send: (channel: string, ...args: unknown[]) => void
      }
    }
  }
}

export {}
