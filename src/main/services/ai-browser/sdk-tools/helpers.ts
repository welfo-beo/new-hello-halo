import { browserContext } from '../context'

/** Default per-tool timeout (ms). */
export const TOOL_TIMEOUT = 60_000
/** Default navigation wait timeout (ms). */
export const NAV_TIMEOUT = 30_000

/** Wrap a promise with a timeout guard. */
export function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
    promise.then(
      v => { clearTimeout(timer); resolve(v) },
      e => { clearTimeout(timer); reject(e) }
    )
  })
}

/** Build a standard text content response. */
export function textResult(text: string, isError = false) {
  return {
    content: [{ type: 'text' as const, text }],
    ...(isError ? { isError: true } : {})
  }
}

/** Build an image + text content response. */
export function imageResult(text: string, data: string, mimeType: string) {
  return {
    content: [
      { type: 'text' as const, text },
      { type: 'image' as const, data, mimeType }
    ]
  }
}

/**
 * Determine how to fill a form element, handling combobox disambiguation.
 */
export async function fillFormElement(uid: string, value: string): Promise<void> {
  const element = browserContext.getElementByUid(uid)

  if (element && element.role === 'combobox') {
    const hasOptions = element.children?.some(child => child.role === 'option')
    if (hasOptions) {
      try {
        await browserContext.selectOption(uid, value)
        return
      } catch (e) {
        if (!(e instanceof Error) || !e.message.includes('Could not find option')) {
          throw e
        }
      }
    }
    await browserContext.fillElement(uid, value)
    return
  }

  await browserContext.fillElement(uid, value)
}
