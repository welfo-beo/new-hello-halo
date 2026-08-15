/**
 * Unit tests: apps/spec — Filter Operator Schema Consistency
 *
 * Tests the consistency between the Zod FilterOpSchema (schema.ts) and the
 * applyOperator() implementation (event-filter.ts).
 *
 * Bugs covered:
 * - Bug 1: 'gte'/'lte' operators are defined in FilterOpSchema but NOT
 *          implemented in applyOperator — a spec using them passes
 *          validation but the rule silently never matches at runtime.
 * - Bug 1b: 'in'/'nin' operators ARE implemented in applyOperator but NOT
 *           defined in FilterOpSchema — a valid spec using them is
 *           rejected during validation even though runtime supports them.
 */

import { describe, it, expect } from 'vitest'
import {
  validateAppSpecSafe,
} from '../../../../src/main/apps/spec'
import { FilterOpSchema } from '../../../../src/main/apps/spec/schema'
import { applyOperator } from '../../../../src/main/apps/runtime/event-filter'

// The set of operators the runtime applyOperator() can actually evaluate.
// 'in'/'nin' are implemented there.
const IMPLEMENTED_OPERATORS = ['eq', 'neq', 'contains', 'matches', 'gt', 'lt', 'in', 'nin']

function createAutomationSpecWithFilter(op: string) {
  return {
    name: 'Filter Test',
    version: '1.0',
    author: 'tester',
    description: 'automation with filter',
    type: 'automation',
    system_prompt: 'You are a monitoring agent.',
    filters: [
      { field: 'payload.size', op, value: 100 },
    ],
  }
}

describe('FilterOpSchema consistency', () => {
  it('every schema operator should be implemented by applyOperator (BUG: gte/lte missing)', () => {
    const schemaOps = FilterOpSchema.options
    for (const op of schemaOps) {
      // The rule field/type in FilterOpSchema uses a union type; compare as strings.
      const opString = typeof op === 'string' ? op : String(op)
      expect(
        IMPLEMENTED_OPERATORS.includes(opString),
        `operator "${opString}" is declared in FilterOpSchema but not implemented in applyOperator`
      ).toBe(true)
    }
  })

  it('every implemented operator should be declared in FilterOpSchema (BUG: in/nin missing)', () => {
    const schemaOps = new Set(FilterOpSchema.options.map((op) => String(op)))
    for (const op of IMPLEMENTED_OPERATORS) {
      expect(
        schemaOps.has(op),
        `operator "${op}" is implemented in applyOperator but not declared in FilterOpSchema`
      ).toBe(true)
    }
  })

  it('spec using gte should validate but actually never match (BUG)', () => {
    // gte passes schema validation...
    const result = validateAppSpecSafe(createAutomationSpecWithFilter('gte'))
    expect(result.success).toBe(true)

    // ...but at runtime applyOperator returns false for every input.
    expect(applyOperator(200, 'gte', 100)).toBe(true) // BUG: returns false
  })

  it('spec using lte should validate but actually never match (BUG)', () => {
    const result = validateAppSpecSafe(createAutomationSpecWithFilter('lte'))
    expect(result.success).toBe(true)

    expect(applyOperator(50, 'lte', 100)).toBe(true) // BUG: returns false
  })

  it('spec using in should be accepted (BUG: rejected by schema)', () => {
    // 'in' is implemented in applyOperator but NOT in FilterOpSchema,
    // so this valid spec is rejected at validation time.
    const result = validateAppSpecSafe(
      createAutomationSpecWithFilter('in')
    )
    expect(result.success).toBe(true) // BUG: validation fails
  })

  it('spec using nin should be accepted (BUG: rejected by schema)', () => {
    const result = validateAppSpecSafe(
      createAutomationSpecWithFilter('nin')
    )
    expect(result.success).toBe(true) // BUG: validation fails
  })
})