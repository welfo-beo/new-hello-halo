import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockBrowserContext, mockBrowserViewManager } = vi.hoisted(() => {
  return {
    mockBrowserContext: {
      getActiveViewId: vi.fn(),
      setActiveViewId: vi.fn(),
      waitForNavigation: vi.fn(),
      createSnapshot: vi.fn(),
      clickElement: vi.fn(),
      getElementByUid: vi.fn(),
      selectOption: vi.fn(),
      fillElement: vi.fn(),
      getNetworkRequest: vi.fn(),
      getSelectedNetworkRequest: vi.fn(),
      getConsoleMessage: vi.fn()
    },
    mockBrowserViewManager: {
      create: vi.fn(),
      getState: vi.fn(),
      reload: vi.fn(),
      navigate: vi.fn(),
      goBack: vi.fn(),
      goForward: vi.fn(),
      destroy: vi.fn(),
      getAllStates: vi.fn()
    }
  }
})

vi.mock('@main/services/ai-browser/context', () => ({
  browserContext: mockBrowserContext
}))

vi.mock('@main/services/browser-view.service', () => ({
  browserViewManager: mockBrowserViewManager
}))

import { handleBrowserSnapshot } from '@main/services/ai-browser/sdk-tools/snapshot'
import { handleBrowserNavigate, handleBrowserNewPage } from '@main/services/ai-browser/sdk-tools/navigation'
import { handleBrowserClick } from '@main/services/ai-browser/sdk-tools/input'
import { handleBrowserNetworkRequest } from '@main/services/ai-browser/sdk-tools/network'
import { handleBrowserConsoleMessage } from '@main/services/ai-browser/sdk-tools/console'
import { fillFormElement, normalizePrefixedId } from '@main/services/ai-browser/sdk-tools/shared'

function textContent(result: any): string {
  return result?.content?.[0]?.text || ''
}

describe('AI Browser SDK tools', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockBrowserContext.getActiveViewId.mockReturnValue('view-1')
    mockBrowserContext.waitForNavigation.mockResolvedValue(undefined)
    mockBrowserViewManager.getState.mockReturnValue({ title: 'Example', url: 'https://example.com' })
    mockBrowserViewManager.create.mockResolvedValue(undefined)
    mockBrowserViewManager.reload.mockReturnValue(true)
    mockBrowserContext.clickElement.mockResolvedValue(undefined)
  })

  it('returns error when snapshot has no active page', async () => {
    mockBrowserContext.getActiveViewId.mockReturnValue(null)

    const result = await handleBrowserSnapshot({})

    expect(result.isError).toBe(true)
    expect(textContent(result)).toContain('No active browser page')
  })

  it('supports workflow new_page -> snapshot -> click -> snapshot', async () => {
    const snapshotA = {
      title: 'A',
      url: 'https://example.com',
      idToNode: new Map([['e1', {}]]),
      format: vi.fn(() => 'snapshot-a')
    }
    const snapshotB = {
      title: 'B',
      url: 'https://example.com',
      idToNode: new Map([['e1', {}], ['e2', {}]]),
      format: vi.fn(() => 'snapshot-b')
    }

    mockBrowserContext.createSnapshot
      .mockResolvedValueOnce(snapshotA)
      .mockResolvedValueOnce(snapshotB)

    const pageResult = await handleBrowserNewPage({ url: 'https://example.com' })
    const snap1 = await handleBrowserSnapshot({})
    const click = await handleBrowserClick({ uid: 'e1' })
    const snap2 = await handleBrowserSnapshot({})

    expect(pageResult.isError).toBeUndefined()
    expect(textContent(pageResult)).toContain('Created new page')
    expect(textContent(snap1)).toContain('snapshot-a')
    expect(click.isError).toBeUndefined()
    expect(textContent(click)).toContain('Successfully clicked')
    expect(textContent(snap2)).toContain('snapshot-b')
  })

  it('normalizes reqid as req_1 for both number and prefixed string', async () => {
    mockBrowserContext.getNetworkRequest.mockImplementation((id: string) => {
      if (id === 'req_1') {
        return {
          id: 'req_1',
          url: 'https://example.com/api',
          method: 'GET',
          resourceType: 'xhr',
          status: 200,
          statusText: 'OK'
        }
      }
      return undefined
    })

    const fromString = await handleBrowserNetworkRequest({ reqid: 'req_1' })
    const fromNumber = await handleBrowserNetworkRequest({ reqid: 1 })

    expect(fromString.isError).toBeUndefined()
    expect(fromNumber.isError).toBeUndefined()
    expect(mockBrowserContext.getNetworkRequest).toHaveBeenNthCalledWith(1, 'req_1')
    expect(mockBrowserContext.getNetworkRequest).toHaveBeenNthCalledWith(2, 'req_1')
  })

  it('normalizes msgid as msg_1 for both number and prefixed string', async () => {
    mockBrowserContext.getConsoleMessage.mockImplementation((id: string) => {
      if (id === 'msg_1') {
        return {
          id: 'msg_1',
          type: 'log',
          text: 'hello',
          timestamp: Date.now()
        }
      }
      return undefined
    })

    const fromString = await handleBrowserConsoleMessage({ msgid: 'msg_1' })
    const fromNumber = await handleBrowserConsoleMessage({ msgid: 1 })

    expect(fromString.isError).toBeUndefined()
    expect(fromNumber.isError).toBeUndefined()
    expect(mockBrowserContext.getConsoleMessage).toHaveBeenNthCalledWith(1, 'msg_1')
    expect(mockBrowserContext.getConsoleMessage).toHaveBeenNthCalledWith(2, 'msg_1')
  })

  it('uses ignoreCache on reload navigation branch', async () => {
    const result = await handleBrowserNavigate({ type: 'reload', ignoreCache: true })

    expect(result.isError).toBeUndefined()
    expect(mockBrowserViewManager.reload).toHaveBeenCalledWith('view-1', { ignoreCache: true })
  })

  it('fillFormElement handles combobox select and fallback paths', async () => {
    mockBrowserContext.getElementByUid.mockReturnValue({
      role: 'combobox',
      children: [{ role: 'option' }]
    })
    mockBrowserContext.selectOption.mockResolvedValue(undefined)

    await fillFormElement('uid-1', 'alpha')
    expect(mockBrowserContext.selectOption).toHaveBeenCalledWith('uid-1', 'alpha')
    expect(mockBrowserContext.fillElement).not.toHaveBeenCalled()

    mockBrowserContext.selectOption.mockRejectedValueOnce(new Error('Could not find option: alpha'))
    await fillFormElement('uid-1', 'alpha')
    expect(mockBrowserContext.fillElement).toHaveBeenCalledWith('uid-1', 'alpha')
  })

  it('normalizes prefixed ids consistently', () => {
    expect(normalizePrefixedId('req_7', 'req')).toBe('req_7')
    expect(normalizePrefixedId(7, 'req')).toBe('req_7')
    expect(normalizePrefixedId('8', 'msg')).toBe('msg_8')
  })
})
