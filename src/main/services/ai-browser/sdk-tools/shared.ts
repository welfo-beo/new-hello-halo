import { browserContext } from '../context'

/** Default per-tool timeout (ms). Individual tools may override. */
export const TOOL_TIMEOUT = 60_000
/** Default navigation wait timeout (ms). */
export const NAV_TIMEOUT = 30_000

/** Convenience: wrap a promise with a timeout guard. */
export function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
    promise.then(
      v => {
        clearTimeout(timer)
        resolve(v)
      },
      e => {
        clearTimeout(timer)
        reject(e)
      }
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
 * Normalize numeric/string id inputs to canonical prefixed IDs.
 * Examples:
 * - prefix=req, input=1 => req_1
 * - prefix=msg, input="msg_2" => msg_2
 */
export function normalizePrefixedId(
  value: string | number | undefined,
  prefix: 'req' | 'msg'
): string | undefined {
  if (value === undefined || value === null) {
    return undefined
  }

  const raw = String(value).trim()
  if (!raw) {
    return undefined
  }

  if (raw.startsWith(`${prefix}_`)) {
    return raw
  }

  if (/^\d+$/.test(raw)) {
    return `${prefix}_${raw}`
  }

  return raw
}

/**
 * Determine how to fill a form element, handling combobox disambiguation.
 *
 * - combobox with option children => select-like (e.g. <select>), use selectOption.
 *   If no matching option is found, fall back to fillElement for editable comboboxes
 *   that happen to have autocomplete suggestions showing.
 * - combobox without option children => editable (e.g. search input), use fillElement.
 * - everything else => fillElement.
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
        // Only fall back for "option not found" - rethrow infrastructure errors (CDP failures, etc.)
        if (!(e instanceof Error) || !e.message.includes('Could not find option')) {
          throw e
        }
        // No matching option - combobox may be editable, fall back to text input
      }
    }
    // Editable combobox (no options, or no matching option) - fill as text
    await browserContext.fillElement(uid, value)
    return
  }

  await browserContext.fillElement(uid, value)
}
