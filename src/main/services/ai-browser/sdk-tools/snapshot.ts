import { z } from 'zod'
import { tool } from '@anthropic-ai/claude-agent-sdk'
import { browserContext } from '../context'
import { textResult, imageResult, withTimeout, TOOL_TIMEOUT } from './helpers'

const browser_snapshot = tool(
  'browser_snapshot',
  `Take a text snapshot of the currently selected page based on the a11y tree. The snapshot lists page elements along with a unique
identifier (uid). Always use the latest snapshot. Prefer taking a snapshot over taking a screenshot. The snapshot indicates the element selected
in the DevTools Elements panel (if any).`,
  {
    verbose: z.boolean().optional().describe('Whether to include all possible information available in the full a11y tree. Default is false.'),
    filePath: z.string().optional().describe('The absolute path, or a path relative to the current working directory, to save the snapshot to instead of attaching it to the response.')
  },
  async (args) => {
    if (!browserContext.getActiveViewId()) {
      return textResult('No active browser page. Use browser_new_page first.', true)
    }
    try {
      const snapshot = await withTimeout(
        browserContext.createSnapshot(args.verbose || false),
        TOOL_TIMEOUT, 'browser_snapshot'
      )
      const formatted = snapshot.format(args.verbose || false)
      if (args.filePath) {
        const { writeFileSync } = require('fs')
        writeFileSync(args.filePath, formatted, 'utf-8')
        return textResult(`Snapshot saved to: ${args.filePath}\n\nPage: ${snapshot.title}\nURL: ${snapshot.url}\nElements: ${snapshot.idToNode.size}`)
      }
      return textResult(formatted)
    } catch (error) {
      return textResult(`Failed to take snapshot: ${(error as Error).message}`, true)
    }
  }
)

const browser_screenshot = tool(
  'browser_screenshot',
  'Take a screenshot of the page or element.',
  {
    format: z.enum(['png', 'jpeg', 'webp']).optional().describe('Type of format to save the screenshot as. Default is "png"'),
    quality: z.number().optional().describe('Compression quality for JPEG and WebP formats (0-100). Ignored for PNG format.'),
    uid: z.string().optional().describe('The uid of an element on the page from the page content snapshot. If omitted takes a pages screenshot.'),
    fullPage: z.boolean().optional().describe('If set to true takes a screenshot of the full page instead of the currently visible viewport. Incompatible with uid.'),
    filePath: z.string().optional().describe('The absolute path, or a path relative to the current working directory, to save the screenshot to instead of attaching it to the response.')
  },
  async (args) => {
    if (!browserContext.getActiveViewId()) {
      return textResult('No active browser page.', true)
    }
    if (args.uid && args.fullPage) {
      return textResult('Providing both "uid" and "fullPage" is not allowed.', true)
    }
    try {
      const format = args.format || 'png'
      const result = await withTimeout(
        browserContext.captureScreenshot({
          format,
          quality: format === 'png' ? undefined : args.quality,
          uid: args.uid,
          fullPage: args.fullPage || false
        }),
        TOOL_TIMEOUT, 'browser_screenshot'
      )
      let message: string
      if (args.uid) message = `Took a screenshot of node with uid "${args.uid}".`
      else if (args.fullPage) message = 'Took a screenshot of the full current page.'
      else message = "Took a screenshot of the current page's viewport."

      if (args.filePath) {
        const { writeFileSync } = require('fs')
        writeFileSync(args.filePath, Buffer.from(result.data, 'base64'))
        return textResult(`${message}\nSaved screenshot to ${args.filePath}.`)
      }
      return imageResult(message, result.data, result.mimeType)
    } catch (error) {
      return textResult(`Failed to take screenshot: ${(error as Error).message}`, true)
    }
  }
)

const browser_evaluate = tool(
  'browser_evaluate',
  `Evaluate a JavaScript function inside the currently selected page. Returns the response as JSON
so returned values have to JSON-serializable.`,
  {
    function: z.string().describe(`A JavaScript function declaration to be executed by the tool in the currently selected page.
Example without arguments: \`() => {
  return document.title
}\` or \`async () => {
  return await fetch("example.com")
}\`.
Example with arguments: \`(el) => {
  return el.innerText;
}\`
`),
    args: z.array(z.object({
      uid: z.string().describe('The uid of an element on the page from the page content snapshot')
    })).optional().describe('An optional list of arguments to pass to the function.')
  },
  async (args) => {
    if (!browserContext.getActiveViewId()) {
      return textResult('No active browser page.', true)
    }
    try {
      const elementArgs: unknown[] = []
      if (args.args && args.args.length > 0) {
        for (const arg of args.args) {
          const element = browserContext.getElementByUid(arg.uid)
          if (!element) throw new Error(`Element not found: ${arg.uid}`)
          elementArgs.push(element)
        }
      }
      const result = await withTimeout(
        browserContext.evaluateScript(args.function, elementArgs),
        TOOL_TIMEOUT, 'browser_evaluate'
      )
      const resultStr = typeof result === 'object' ? JSON.stringify(result, null, 2) : String(result)
      return textResult(`Script ran on page and returned:\n\`\`\`json\n${resultStr}\n\`\`\``)
    } catch (error) {
      return textResult(`Script error: ${(error as Error).message}`, true)
    }
  }
)

export const snapshotTools = [browser_snapshot, browser_screenshot, browser_evaluate]
