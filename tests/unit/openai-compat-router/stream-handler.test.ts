/**
 * Unit tests for openai-compat-router/stream — Content Block Indexing
 *
 * Verifies that the OpenAI → Anthropic stream conversion assigns UNIQUE,
 * monotonically increasing content block indices for each block type.
 *
 * Bug covered:
 * - Bug 2: startTextBlock()/startThinkingBlock() write content_block_start
 *          using state.contentBlockIndex but never increment it. When a
 *          model emits thinking followed by text (without a signature_delta),
 *          both blocks reuse the SAME index on the wire, which corrupts the
 *          Anthropic stream (duplicate content_block_start index).
 *
 * Demonstrates that with current code the thinking→text sequence produces
 * duplicate index 0 for both blocks.
 */

import { describe, it, expect } from 'vitest'
import { ReadableStream } from 'node:stream/web'
import { OpenAIChatStreamHandler } from '../../../src/main/openai-compat-router/stream/openai-chat-stream'

// ============================================
// Helpers
// ============================================

interface ParsedSseEvent {
  event: string
  data: Record<string, unknown>
}

/**
 * Build a web ReadableStream from SSE text parts.
 * The handler feeds these into Readable.fromWeb().
 */
function makeWebStream(parts: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  const chunks = parts.map((p) => encoder.encode(p))
  return new ReadableStream({
    start(controller) {
      for (const c of chunks) controller.enqueue(c)
      controller.close()
    },
  })
}

/**
 * Fake Express response that captures everything written.
 */
function createFakeRes() {
  const chunks: string[] = []
  const res: any = {
    write: (s: string) => {
      chunks.push(s)
      return true
    },
    end: () => undefined,
    status: () => res,
    json: () => undefined,
  }
  return { res, getChunks: () => chunks.join('') }
}

/** Split captured SSE output into parsed events. */
function parseSse(raw: string): ParsedSseEvent[] {
  const events: ParsedSseEvent[] = []
  for (const block of raw.split('\n\n')) {
    if (!block.trim()) continue
    let event = 'message'
    let data = ''
    for (const line of block.split('\n')) {
      if (line.startsWith('event: ')) event = line.slice(7)
      else if (line.startsWith('data: ')) data += line.slice(6)
    }
    if (!data) continue
    try {
      events.push({ event, data: JSON.parse(data) })
    } catch {
      // skip unparseable
    }
  }
  return events
}

/** Extract { index, blockType } of every content_block_start event. */
function blockStarts(events: ParsedSseEvent[]): Array<{ index: number; blockType: string }> {
  return events
    .filter((e) => e.event === 'content_block_start')
    .map((e) => ({
      index: (e.data as any).index as number,
      blockType: ((e.data as any).content_block as any)?.type as string,
    }))
}

function sseLine(obj: unknown): string {
  return `data: ${JSON.stringify(obj)}\n\n`
}

// ============================================
// Tests
// ============================================

describe('OpenAI Chat → Anthropic content block indexing', () => {
  it('should assign unique index for a single text block (baseline)', async () => {
    const { res, getChunks } = createFakeRes()
    const handler = new OpenAIChatStreamHandler(res, { debug: false })

    const stream = makeWebStream([
      sseLine({ choices: [{ delta: { content: 'Hello' } }] }),
      sseLine({ choices: [{ delta: {}, finish_reason: 'stop' }] }),
      'data: [DONE]\n\n',
    ])

    await handler.processStream(stream)

    const starts = blockStarts(parseSse(getChunks()))
    expect(starts).toHaveLength(1)
    expect(starts[0]).toEqual({ index: 0, blockType: 'text' })
  })

  it('should assign unique indices when thinking is followed by text (BUG: duplicate index)', async () => {
    const { res, getChunks } = createFakeRes()
    const handler = new OpenAIChatStreamHandler(res, { debug: false })

    // DeepSeek-R1 style stream: reasoning first, then content, no signature.
    const stream = makeWebStream([
      sseLine({ choices: [{ delta: { reasoning: 'Let me think about this...' } }] }),
      sseLine({ choices: [{ delta: { content: 'Here is the answer.' } }] }),
      sseLine({ choices: [{ delta: {}, finish_reason: 'stop' }] }),
      'data: [DONE]\n\n',
    ])

    await handler.processStream(stream)

    const starts = blockStarts(parseSse(getChunks()))
    // Two blocks must exist: one thinking + one text.
    const blockTypes = starts.map((s) => s.blockType)
    expect(blockTypes).toContain('thinking')
    expect(blockTypes).toContain('text')

    // BUG: both blocks currently reuse index 0 because text/thinking block
    // starts never increment contentBlockIndex.
    const indices = starts.map((s) => s.index)
    const uniqueIndices = new Set(indices)
    expect(uniqueIndices.size).toBe(starts.length) // BUG: this is 1, not 2
  })

  it('should assign unique indices when thinking is closed by a signature before text (correct path)', async () => {
    const { res, getChunks } = createFakeRes()
    const handler = new OpenAIChatStreamHandler(res, { debug: false })

    // Structured thinking: signature closes the thinking block (increments index),
    // then text gets the next index. This path works in current code.
    const stream = makeWebStream([
      sseLine({ choices: [{ delta: { thinking: { content: 'reasoning...' } } }] }),
      sseLine({ choices: [{ delta: { thinking: { signature: 'abc123' } } }] }),
      sseLine({ choices: [{ delta: { content: 'Final answer.' } }] }),
      sseLine({ choices: [{ delta: {}, finish_reason: 'stop' }] }),
      'data: [DONE]\n\n',
    ])

    await handler.processStream(stream)

    const starts = blockStarts(parseSse(getChunks()))
    const indices = starts.map((s) => s.index)
    expect(uniqueCount(indices)).toBe(indices.length) // should be unique
  })
})

function uniqueCount<T>(arr: T[]): number {
  return new Set(arr).size
}