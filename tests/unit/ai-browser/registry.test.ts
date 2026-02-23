import { describe, expect, it } from 'vitest'
import { allSdkTools, getAIBrowserSdkToolNames } from '@main/services/ai-browser/sdk-mcp-server'

describe('AI Browser tool registry', () => {
  it('registers 26 unique browser_* tools', () => {
    const names = getAIBrowserSdkToolNames()

    expect(names).toHaveLength(26)
    expect(new Set(names).size).toBe(26)
    expect(names.every(name => name.startsWith('browser_'))).toBe(true)
  })

  it('tool list and names API stay in sync', () => {
    const namesFromTools = allSdkTools.map(tool => tool.name)
    const namesFromApi = getAIBrowserSdkToolNames()

    expect(namesFromApi).toEqual(namesFromTools)
  })
})
