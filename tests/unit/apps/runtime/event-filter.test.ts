/**
 * Unit tests for apps/runtime/event-filter
 *
 * Tests the event filter engine including:
 * - matchesFilter: type/source/rule matching
 * - matchTypeGlob: glob pattern matching for event types
 * - applyOperator: field-level operator evaluation
 * - getByPath: field path resolution
 *
 * These tests cover bugs found in the implementation:
 * - Bug 1: 'gte'/'lte' operators NOT implemented in applyOperator
 *          (but defined in FilterOpSchema)
 * - Bug 1b: 'in'/'nin' operators implemented in applyOperator
 *           but NOT defined in FilterOpSchema
 * - Bug 3: 'matches' operator silently fails on invalid regex
 */

import { describe, it, expect, vi } from 'vitest'
import {
  matchesFilter,
  matchTypeGlob,
  evaluateRule,
  applyOperator,
  getByPath,
} from '../../../../src/main/apps/runtime/event-filter'
import type { AutomationEvent, EventFilter, FilterRule } from '../../../../src/main/apps/runtime/event-types'

// ============================================
// Test Fixtures
// ============================================

function createTestEvent(overrides?: Partial<AutomationEvent>): AutomationEvent {
  return {
    id: 'evt-001',
    type: 'file.changed',
    source: 'file-watcher',
    timestamp: 1000,
    payload: {
      path: '/tmp/test.txt',
      extension: 'txt',
      size: 1024,
      tags: ['important', 'urgent'],
      metadata: { author: 'test' },
    },
    ...overrides,
  }
}

// ============================================
// matchTypeGlob Tests
// ============================================

describe('matchTypeGlob', () => {
  it('should match exact type', () => {
    expect(matchTypeGlob('file.changed', 'file.changed')).toBe(true)
  })

  it('should match wildcard prefix', () => {
    expect(matchTypeGlob('file.changed', 'file.*')).toBe(true)
    expect(matchTypeGlob('file.created', 'file.*')).toBe(true)
  })

  it('should match universal wildcard', () => {
    expect(matchTypeGlob('anything.here', '*')).toBe(true)
  })

  it('should not match different types', () => {
    expect(matchTypeGlob('webhook.received', 'file.*')).toBe(false)
  })

  it('should not match prefix without wildcard', () => {
    expect(matchTypeGlob('file.changed', 'file')).toBe(false)
  })
})

// ============================================
// getByPath Tests
// ============================================

describe('getByPath', () => {
  it('should resolve top-level field', () => {
    const event = createTestEvent()
    expect(getByPath(event, 'type')).toBe('file.changed')
  })

  it('should resolve nested payload field', () => {
    const event = createTestEvent()
    expect(getByPath(event, 'payload.path')).toBe('/tmp/test.txt')
  })

  it('should resolve deeply nested field', () => {
    const event = createTestEvent()
    expect(getByPath(event, 'payload.metadata.author')).toBe('test')
  })

  it('should resolve array index', () => {
    const event = createTestEvent()
    expect(getByPath(event, 'payload.tags[0]')).toBe('important')
  })

  it('should return undefined for unresolvable path', () => {
    const event = createTestEvent()
    expect(getByPath(event, 'payload.nonexistent')).toBeUndefined()
  })

  it('should return undefined for empty path', () => {
    const event = createTestEvent()
    expect(getByPath(event, '')).toBeUndefined()
  })

  it('should return undefined for path into non-object', () => {
    const event = createTestEvent()
    expect(getByPath(event, 'payload.size.nested')).toBeUndefined()
  })
})

// ============================================
// applyOperator Tests
// ============================================

describe('applyOperator', () => {
  describe('eq', () => {
    it('should match strict equality', () => {
      expect(applyOperator('hello', 'eq', 'hello')).toBe(true)
    })

    it('should not match different types', () => {
      expect(applyOperator(42, 'eq', '42')).toBe(false)
    })
  })

  describe('neq', () => {
    it('should match inequality', () => {
      expect(applyOperator('hello', 'neq', 'world')).toBe(true)
    })

    it('should not match equal values', () => {
      expect(applyOperator('hello', 'neq', 'hello')).toBe(false)
    })
  })

  describe('contains', () => {
    it('should match substring in string', () => {
      expect(applyOperator('hello world', 'contains', 'world')).toBe(true)
    })

    it('should match element in array', () => {
      expect(applyOperator(['a', 'b', 'c'], 'contains', 'b')).toBe(true)
    })

    it('should not match missing substring', () => {
      expect(applyOperator('hello', 'contains', 'world')).toBe(false)
    })
  })

  // ============================================
  // Bug 1: 'gte' and 'lte' are NOT implemented
  // ============================================
  describe('gte (BUG: NOT IMPLEMENTED)', () => {
    it('should return true when fieldValue >= ruleValue', () => {
      // BUG: gte is defined in FilterOpSchema but NOT implemented in applyOperator
      // This test demonstrates the bug — it will FAIL because applyOperator
      // falls through to default: return false
      expect(applyOperator(5, 'gte', 3)).toBe(true)
    })

    it('should return true when fieldValue equals ruleValue', () => {
      // BUG: same as above — gte is not implemented
      expect(applyOperator(3, 'gte', 3)).toBe(true)
    })

    it('should return false when fieldValue < ruleValue', () => {
      expect(applyOperator(2, 'gte', 5)).toBe(false)
    })
  })

  describe('lte (BUG: NOT IMPLEMENTED)', () => {
    it('should return true when fieldValue <= ruleValue', () => {
      // BUG: lte is defined in FilterOpSchema but NOT implemented in applyOperator
      expect(applyOperator(3, 'lte', 5)).toBe(true)
    })

    it('should return true when fieldValue equals ruleValue', () => {
      expect(applyOperator(5, 'lte', 5)).toBe(true)
    })

    it('should return false when fieldValue > ruleValue', () => {
      expect(applyOperator(7, 'lte', 5)).toBe(false)
    })
  })

  // ============================================
  // Bug 1b: 'in' and 'nin' are implemented
  //          but NOT in FilterOpSchema
  // ============================================
  describe('in', () => {
    it('should return true when fieldValue is in array', () => {
      expect(applyOperator('a', 'in', ['a', 'b', 'c'])).toBe(true)
    })

    it('should return false when fieldValue is not in array', () => {
      expect(applyOperator('x', 'in', ['a', 'b', 'c'])).toBe(false)
    })

    it('should return false when ruleValue is not an array', () => {
      expect(applyOperator('a', 'in', 'not-an-array')).toBe(false)
    })
  })

  describe('nin', () => {
    it('should return true when fieldValue is not in array', () => {
      expect(applyOperator('x', 'nin', ['a', 'b', 'c'])).toBe(true)
    })

    it('should return false when fieldValue is in array', () => {
      expect(applyOperator('a', 'nin', ['a', 'b', 'c'])).toBe(false)
    })

    it('should return false when ruleValue is not an array', () => {
      expect(applyOperator('a', 'nin', 'not-an-array')).toBe(false)
    })
  })

  describe('gt', () => {
    it('should return true for greater than', () => {
      expect(applyOperator(10, 'gt', 5)).toBe(true)
    })

    it('should return false for equal values', () => {
      expect(applyOperator(5, 'gt', 5)).toBe(false)
    })

    it('should return false for non-numeric', () => {
      expect(applyOperator('hello', 'gt', 'world')).toBe(false)
    })
  })

  describe('lt', () => {
    it('should return true for less than', () => {
      expect(applyOperator(3, 'lt', 7)).toBe(true)
    })

    it('should return false for equal values', () => {
      expect(applyOperator(5, 'lt', 5)).toBe(false)
    })
  })

  // ============================================
  // Bug 3: Silent regex failure on invalid pattern
  // ============================================
  describe('matches (BUG: silent regex failure)', () => {
    it('should match valid regex pattern', () => {
      expect(applyOperator('hello123', 'matches', '^[a-z]+\\d+$')).toBe(true)
    })

    it('should not match non-matching pattern', () => {
      expect(applyOperator('hello', 'matches', '^\\d+$')).toBe(false)
    })

    it('should silently return false on invalid regex pattern (BUG)', () => {
      // BUG: This silently returns false with no warning/error logged.
      // The user has no way to know their regex pattern is invalid.
      expect(applyOperator('hello', 'matches', '[invalid')).toBe(false)
    })

    it('should return false for non-string fieldValue', () => {
      expect(applyOperator(42, 'matches', '\\d+')).toBe(false)
    })

    it('should return false for non-string ruleValue', () => {
      expect(applyOperator('hello', 'matches', 42)).toBe(false)
    })
  })
})

// ============================================
// evaluateRule Tests
// ============================================

describe('evaluateRule', () => {
  it('should evaluate a rule against an event', () => {
    const event = createTestEvent()
    const rule: FilterRule = { field: 'type', op: 'eq', value: 'file.changed' }
    expect(evaluateRule(event, rule)).toBe(true)
  })

  it('should evaluate payload field', () => {
    const event = createTestEvent()
    const rule: FilterRule = { field: 'payload.size', op: 'gt', value: 500 }
    expect(evaluateRule(event, rule)).toBe(true)
  })

  it('should evaluate nested payload field', () => {
    const event = createTestEvent()
    const rule: FilterRule = { field: 'payload.metadata.author', op: 'eq', value: 'test' }
    expect(evaluateRule(event, rule)).toBe(true)
  })

  it('should return false for non-matching rule', () => {
    const event = createTestEvent()
    const rule: FilterRule = { field: 'type', op: 'eq', value: 'webhook.received' }
    expect(evaluateRule(event, rule)).toBe(false)
  })
})

// ============================================
// matchesFilter Tests
// ============================================

describe('matchesFilter', () => {
  it('should match event with matching type', () => {
    const event = createTestEvent()
    const filter: EventFilter = { types: ['file.changed'] }
    expect(matchesFilter(event, filter)).toBe(true)
  })

  it('should match event with type glob', () => {
    const event = createTestEvent()
    const filter: EventFilter = { types: ['file.*'] }
    expect(matchesFilter(event, filter)).toBe(true)
  })

  it('should not match event with wrong type', () => {
    const event = createTestEvent()
    const filter: EventFilter = { types: ['webhook.received'] }
    expect(matchesFilter(event, filter)).toBe(false)
  })

  it('should match event with matching source', () => {
    const event = createTestEvent()
    const filter: EventFilter = { sources: ['file-watcher'] }
    expect(matchesFilter(event, filter)).toBe(true)
  })

  it('should not match event with wrong source', () => {
    const event = createTestEvent()
    const filter: EventFilter = { sources: ['webhook'] }
    expect(matchesFilter(event, filter)).toBe(false)
  })

  it('should match event with matching rules (AND logic)', () => {
    const event = createTestEvent()
    const filter: EventFilter = {
      rules: [
        { field: 'type', op: 'eq', value: 'file.changed' },
        { field: 'payload.size', op: 'gt', value: 500 },
      ],
    }
    expect(matchesFilter(event, filter)).toBe(true)
  })

  it('should not match event when one rule fails (AND logic)', () => {
    const event = createTestEvent()
    const filter: EventFilter = {
      rules: [
        { field: 'type', op: 'eq', value: 'file.changed' },
        { field: 'payload.size', op: 'lt', value: 500 },
      ],
    }
    expect(matchesFilter(event, filter)).toBe(false)
  })

  it('should match event with empty filter (match all)', () => {
    const event = createTestEvent()
    expect(matchesFilter(event, {})).toBe(true)
  })

  it('should match event with empty arrays', () => {
    const event = createTestEvent()
    expect(matchesFilter(event, { types: [], sources: [], rules: [] })).toBe(true)
  })

  it('should match event with combined type, source, and rules', () => {
    const event = createTestEvent()
    const filter: EventFilter = {
      types: ['file.*'],
      sources: ['file-watcher'],
      rules: [{ field: 'payload.extension', op: 'eq', value: 'txt' }],
    }
    expect(matchesFilter(event, filter)).toBe(true)
  })
})