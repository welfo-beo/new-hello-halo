/**
 * AI Browser SDK MCP Server
 *
 * Thin aggregation layer that imports tool definitions from sdk-tools/
 * and exposes them via an in-process MCP server.
 *
 * Tool categories (26 tools total):
 * - Navigation (8): list/select/new/close pages, navigate, wait, resize, dialog
 * - Input (7): click, hover, fill, fill_form, drag, press_key, upload_file
 * - Snapshot (3): snapshot, screenshot, evaluate
 * - Network (2): network_requests, network_request
 * - Console (2): console, console_message
 * - Emulation (1): emulate
 * - Performance (3): perf_start, perf_stop, perf_insight
 */

import { createSdkMcpServer } from '@anthropic-ai/claude-agent-sdk'
import {
  navigationTools,
  inputTools,
  snapshotTools,
  networkTools,
  consoleTools,
  emulationTools,
  performanceTools
} from './sdk-tools'

const allSdkTools = [
  ...navigationTools,
  ...inputTools,
  ...snapshotTools,
  ...networkTools,
  ...consoleTools,
  ...emulationTools,
  ...performanceTools
]

export function createAIBrowserMcpServer() {
  return createSdkMcpServer({
    name: 'ai-browser',
    version: '1.0.0',
    tools: allSdkTools
  })
}

export function getAIBrowserSdkToolNames(): string[] {
  return allSdkTools.map(t => t.name)
}
