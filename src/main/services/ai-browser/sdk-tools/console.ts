import { z } from 'zod'
import { tool } from '@anthropic-ai/claude-agent-sdk'
import { browserContext } from '../context'
import { textResult } from './helpers'

const browser_console = tool(
  'browser_console',
  'List all console messages for the currently selected page since the last navigation.',
  {
    pageSize: z.number().int().positive().optional().describe('Maximum number of messages to return.'),
    pageIdx: z.number().int().min(0).optional().describe('Page number to return (0-based).'),
    types: z.array(z.string()).optional().describe('Filter messages by type.'),
    includePreservedMessages: z.boolean().optional().describe('Set to true to return preserved messages over the last 3 navigations.')
  },
  async (args) => {
    try {
      let messages = browserContext.getConsoleMessages(args.includePreservedMessages || false)

      if (args.types && args.types.length > 0) {
        const typeSet = new Set(args.types)
        messages = messages.filter(m => typeSet.has(m.type))
      }

      const total = messages.length
      const pageIdx = args.pageIdx || 0
      let pageMessages: typeof messages
      if (args.pageSize !== undefined) {
        const startIdx = pageIdx * args.pageSize
        pageMessages = messages.slice(startIdx, Math.min(startIdx + args.pageSize, total))
      } else {
        pageMessages = messages
      }

      if (pageMessages.length === 0) return textResult('No console messages captured.')

      const lines: string[] = []
      if (args.pageSize !== undefined) {
        const startIdx = pageIdx * args.pageSize
        const endIdx = Math.min(startIdx + args.pageSize, total)
        lines.push(`Console Messages (${startIdx + 1}-${endIdx} of ${total}):`)
      } else {
        lines.push(`Console Messages (${total} total):`)
      }
      lines.push('')

      for (const msg of pageMessages) {
        const time = new Date(msg.timestamp).toLocaleTimeString()
        lines.push(`[msgid=${msg.id}] ${msg.type.toUpperCase()} (${time})`)
        lines.push(`    ${msg.text.substring(0, 200)}${msg.text.length > 200 ? '...' : ''}`)
        if (msg.url) lines.push(`    at ${msg.url}${msg.lineNumber !== undefined ? `:${msg.lineNumber}` : ''}`)
        lines.push('')
      }

      if (args.pageSize !== undefined && pageIdx * args.pageSize + pageMessages.length < total) {
        lines.push(`Use pageIdx=${pageIdx + 1} to see more messages.`)
      }

      return textResult(lines.join('\n'))
    } catch (error) {
      return textResult(`Failed to get console messages: ${(error as Error).message}`, true)
    }
  }
)

const browser_console_message = tool(
  'browser_console_message',
  'Gets a console message by its ID.',
  {
    msgid: z.number().describe('The msgid of a console message')
  },
  async (args) => {
    try {
      const message = browserContext.getConsoleMessage(String(args.msgid))
      if (!message) return textResult(`Message not found: ${args.msgid}`, true)

      const time = new Date(message.timestamp).toLocaleString()
      const lines = [
        `# Console Message: msgid=${message.id}`, '',
        `## Type: ${message.type.toUpperCase()}`,
        `Timestamp: ${time}`, ''
      ]

      if (message.url) {
        lines.push(`## Source`, `File: ${message.url}`)
        if (message.lineNumber !== undefined) lines.push(`Line: ${message.lineNumber}`)
        lines.push('')
      }

      lines.push(`## Message`, '```', message.text, '```')

      if (message.stackTrace) {
        lines.push('', `## Stack Trace`, '```', message.stackTrace, '```')
      }
      if (message.args && message.args.length > 0) {
        lines.push('', `## Arguments`, '```json', JSON.stringify(message.args, null, 2), '```')
      }

      return textResult(lines.join('\n'))
    } catch (error) {
      return textResult(`Failed to get message details: ${(error as Error).message}`, true)
    }
  }
)

export const consoleTools = [browser_console, browser_console_message]
