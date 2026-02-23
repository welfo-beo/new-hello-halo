import { spawnSync } from 'node:child_process'

function resolveTargetPlatform() {
  if (process.platform === 'win32') {
    return 'win'
  }
  if (process.platform === 'linux') {
    return 'linux'
  }
  if (process.platform === 'darwin') {
    return process.arch === 'arm64' ? 'mac-arm64' : 'mac-x64'
  }
  return 'all'
}

const target = resolveTargetPlatform()
const args = ['tests/check/binaries.mjs', '--platform', target]
const result = spawnSync(process.execPath, args, { stdio: 'inherit' })

process.exit(result.status ?? 1)
