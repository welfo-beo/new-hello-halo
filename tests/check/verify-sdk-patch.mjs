import fs from 'fs'
import path from 'path'

const root = process.cwd()
const patchPath = path.join(root, 'patches', '@anthropic-ai+claude-agent-sdk+0.1.76.patch')
const sdkPath = path.join(root, 'node_modules', '@anthropic-ai', 'claude-agent-sdk', 'sdk.mjs')

function fail(message) {
  console.error(`[patch-check] ${message}`)
  process.exit(1)
}

if (!fs.existsSync(patchPath)) {
  fail(`Missing patch file: ${patchPath}`)
}

if (!fs.existsSync(sdkPath)) {
  fail(`Missing SDK runtime file: ${sdkPath}`)
}

const patchText = fs.readFileSync(patchPath, 'utf8')
const sdkText = fs.readFileSync(sdkPath, 'utf8')

const patchMarkers = [
  '[PATCHED] Expose pid for health system process tracking',
  "includePartialMessages: options.includePartialMessages ?? true",
  'Removed CLAUDE_CODE_ENTRYPOINT to appear as native CLI',
]

const runtimeMarkers = [
  'get pid() {',
  'includePartialMessages: options.includePartialMessages ?? true',
  'this.query = new Query(transport, false, options.canUseTool, options.hooks',
]

for (const marker of patchMarkers) {
  if (!patchText.includes(marker)) {
    fail(`Patch marker not found in patch file: ${marker}`)
  }
}

for (const marker of runtimeMarkers) {
  if (!sdkText.includes(marker)) {
    fail(`Patched SDK marker not found in runtime file: ${marker}`)
  }
}

console.log('[patch-check] Claude Agent SDK patch markers verified')
