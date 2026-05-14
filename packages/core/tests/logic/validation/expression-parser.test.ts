import { describe, test, expect } from 'vitest'
import {
  parseExpression,
  validateExpressionSyntax,
} from '@/logic/design-time/validation/expression-parser'

/**
 * Tests for expression-parser.ts (design-time validation).
 */
describe('expression-parser', () => {
  // ============================================================================
  // parseExpression Tests
  // ============================================================================

  describe('parseExpression', () => {
    describe('valid expressions', () => {
      test('parses simple variable reference', () => {
        const result = parseExpression('age')
        expect(result.success).toBe(true)
        expect(result.variables).toContain('age')
      })

      test('parses member access', () => {
        const result = parseExpression('fields.age')
        expect(result.success).toBe(true)
        expect(result.variables).toContain('fields.age')
      })

      test('parses comparison expression', () => {
        const result = parseExpression('fields.age >= 18')
        expect(result.success).toBe(true)
        expect(result.variables).toContain('fields.age')
      })

      test('parses logical expression', () => {
        const result = parseExpression('isAdult and hasLicense')
        expect(result.success).toBe(true)
        expect(result.variables).toContain('isAdult')
        expect(result.variables).toContain('hasLicense')
      })

      test('parses arithmetic expression', () => {
        const result = parseExpression('fields.age + 10')
        expect(result.success).toBe(true)
        expect(result.variables).toContain('fields.age')
      })

      test('parses parenthesized expression', () => {
        const result = parseExpression('(isAdult or hasParentConsent) and agreed')
        expect(result.success).toBe(true)
        expect(result.variables).toContain('isAdult')
        expect(result.variables).toContain('hasParentConsent')
        expect(result.variables).toContain('agreed')
      })

      test('parses conditional (ternary) expression', () => {
        const result = parseExpression('isAdult ? "adult" : "minor"')
        expect(result.success).toBe(true)
        expect(result.variables).toContain('isAdult')
      })

      test('parses not expression', () => {
        const result = parseExpression('not isAdult')
        expect(result.success).toBe(true)
        expect(result.variables).toContain('isAdult')
      })
    })

    describe('variable extraction', () => {
      test('extracts simple variables', () => {
        const result = parseExpression('x + y')
        expect(result.variables).toContain('x')
        expect(result.variables).toContain('y')
      })

      test('extracts member access variables with full path', () => {
        const result = parseExpression('fields.person.name')
        expect(result.variables).toContain('fields.person.name')
      })

      test('extracts multiple nested paths', () => {
        const result = parseExpression('fields.age > fields.minAge')
        expect(result.variables).toContain('fields.age')
        expect(result.variables).toContain('fields.minAge')
      })

      test('extracts logic key references', () => {
        const result = parseExpression('isAdult and canVote')
        expect(result.variables).toContain('isAdult')
        expect(result.variables).toContain('canVote')
      })

      test('does not duplicate variables', () => {
        const result = parseExpression('x + x + x')
        expect(result.variables.filter((v) => v === 'x')).toHaveLength(1)
      })
    })

    describe('syntax errors', () => {
      test('detects missing operand', () => {
        const result = parseExpression('fields.age >=')
        expect(result.success).toBe(false)
        expect(result.error).toBeDefined()
      })

      test('detects unmatched parenthesis', () => {
        const result = parseExpression('(x + y')
        expect(result.success).toBe(false)
        expect(result.error).toBeDefined()
      })

      test('detects invalid operator', () => {
        const result = parseExpression('x && y')
        expect(result.success).toBe(false)
        expect(result.error).toBeDefined()
      })

      test('handles unary plus operators', () => {
        // expr-eval-fork treats ++ as two unary plus operators
        // so 'x ++ y' is parsed as 'x + (+y)' which is valid
        const result = parseExpression('x ++ y')
        expect(result.success).toBe(true)
      })

      test('returns empty variables on error', () => {
        const result = parseExpression('invalid syntax ((')
        expect(result.success).toBe(false)
        expect(result.variables).toHaveLength(0)
      })
    })

    describe('edge cases', () => {
      test('handles empty string', () => {
        const result = parseExpression('')
        expect(result.success).toBe(false)
        expect(result.error).toBeDefined()
      })

      test('handles whitespace only', () => {
        const result = parseExpression('   ')
        expect(result.success).toBe(false)
        expect(result.error).toBeDefined()
      })

      test('handles numeric literals', () => {
        const result = parseExpression('42')
        expect(result.success).toBe(true)
        expect(result.variables).toHaveLength(0)
      })

      test('handles string literals', () => {
        const result = parseExpression('"hello"')
        expect(result.success).toBe(true)
        expect(result.variables).toHaveLength(0)
      })

      test('handles boolean-like keywords', () => {
        const result = parseExpression('true')
        expect(result.success).toBe(true)
        // 'true' is a constant, not a variable
      })
    })
  })

  // ============================================================================
  // validateExpressionSyntax Tests
  // ============================================================================

  describe('validateExpressionSyntax', () => {
    test('returns true for valid expression', () => {
      const result = validateExpressionSyntax('fields.age >= 18')
      expect(result).toBe(true)
    })

    test('returns error message for invalid expression', () => {
      const result = validateExpressionSyntax('fields.age >=')
      expect(result).not.toBe(true)
      expect(typeof result).toBe('string')
    })

    test('returns true for complex valid expression', () => {
      const result = validateExpressionSyntax(
        '(isAdult and agreed) or (hasParentConsent and fields.age >= 16)'
      )
      expect(result).toBe(true)
    })

    test('returns error for empty string', () => {
      const result = validateExpressionSyntax('')
      expect(result).not.toBe(true)
    })
  })
})
