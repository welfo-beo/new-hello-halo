/**
 * AI Browser SDK MCP Server
 *
 * Single authoritative registration point for all AI Browser SDK MCP tools.
 */

import { createSdkMcpServer } from '@anthropic-ai/claude-agent-sdk'
import { navigationTools } from './sdk-tools/navigation'
import { inputTools } from './sdk-tools/input'
import { snapshotTools } from './sdk-tools/snapshot'
import { networkTools } from './sdk-tools/network'
import { consoleTools } from './sdk-tools/console'
import { emulationTools } from './sdk-tools/emulation'
import { performanceTools } from './sdk-tools/performance'

/**
 * All AI Browser tools as SDK MCP tools (26 tools)
 */
export const allSdkTools = [
  ...navigationTools,
  ...inputTools,
  ...snapshotTools,
  ...networkTools,
  ...consoleTools,
  ...emulationTools,
  ...performanceTools
]

/**
 * Create AI Browser SDK MCP Server.
 * This server runs in-process and handles all browser_* tools.
 */
export function createAIBrowserMcpServer() {
  return createSdkMcpServer({
    name: 'ai-browser',
    version: '1.0.0',
    tools: allSdkTools
  })
}

/**
 * Get all AI Browser tool names.
 */
export function getAIBrowserSdkToolNames(): string[] {
  return allSdkTools.map(t => t.name)
}
