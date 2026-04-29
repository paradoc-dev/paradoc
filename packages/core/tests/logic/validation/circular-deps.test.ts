import { describe, test, expect } from 'vitest'
import { topologicalSortDefsKeys } from '@/logic/design-time/type-checking/build-type-environment'

/**
 * Tests for topological sort and circular dependency detection.
 */
describe('circular-deps', () => {
  // ============================================================================
  // topologicalSortDefsKeys Tests
  // ============================================================================

  describe('topologicalSortDefsKeys', () => {
    describe('no dependencies', () => {
      test('handles empty logic object', () => {
        const result = topologicalSortDefsKeys({})
        expect(result.sorted).toHaveLength(0)
        expect(result.cyclicKeys).toHaveLength(0)
      })

      test('handles single key with no dependencies', () => {
        const logic = {
          isAdult: 'fields.age >= 18',
        }
        const result = topologicalSortDefsKeys(logic)
        expect(result.sorted).toContain('isAdult')
        expect(result.cyclicKeys).toHaveLength(0)
      })

      test('handles multiple independent keys', () => {
        const logic = {
          isAdult: 'fields.age >= 18',
          hasLicense: 'fields.licenseNumber != ""',
          isAgreed: 'fields.agreed',
        }
        const result = topologicalSortDefsKeys(logic)
        expect(result.sorted).toHaveLength(3)
        expect(result.cyclicKeys).toHaveLength(0)
      })
    })

    describe('linear dependencies', () => {
      test('sorts A → B correctly', () => {
        const logic = {
          canDrive: 'isAdult and fields.hasLicense', // depends on isAdult
          isAdult: 'fields.age >= 18',
        }
        const result = topologicalSortDefsKeys(logic)

        // isAdult should come before canDrive
        const isAdultIndex = result.sorted.indexOf('isAdult')
        const canDriveIndex = result.sorted.indexOf('canDrive')
        expect(isAdultIndex).toBeLessThan(canDriveIndex)
        expect(result.cyclicKeys).toHaveLength(0)
      })

      test('sorts A → B → C correctly', () => {
        const logic = {
          needsParentConsent: 'not isAdult', // depends on isAdult
          canDrive: 'isAdult and hasLicense', // depends on isAdult and hasLicense
          isAdult: 'fields.age >= 18',
          hasLicense: 'fields.licenseNumber != ""',
        }
        const result = topologicalSortDefsKeys(logic)

        // isAdult should come before needsParentConsent
        const isAdultIndex = result.sorted.indexOf('isAdult')
        const needsConsentIndex = result.sorted.indexOf('needsParentConsent')
        expect(isAdultIndex).toBeLessThan(needsConsentIndex)
        expect(result.cyclicKeys).toHaveLength(0)
      })
    })

    describe('diamond dependencies', () => {
      test('handles diamond pattern A → B, A → C, B → D, C → D', () => {
        const logic = {
          canVote: 'isAdult', // depends on isAdult
          canDrive: 'isAdult and hasLicense', // depends on isAdult and hasLicense
          canDoEverything: 'canVote and canDrive', // depends on canVote and canDrive
          isAdult: 'fields.age >= 18',
          hasLicense: 'fields.licenseNumber != ""',
        }
        const result = topologicalSortDefsKeys(logic)

        // All dependencies should be met
        const isAdultIndex = result.sorted.indexOf('isAdult')
        const canVoteIndex = result.sorted.indexOf('canVote')
        const canDriveIndex = result.sorted.indexOf('canDrive')
        const canDoEverythingIndex = result.sorted.indexOf('canDoEverything')

        expect(isAdultIndex).toBeLessThan(canVoteIndex)
        expect(isAdultIndex).toBeLessThan(canDriveIndex)
        expect(canVoteIndex).toBeLessThan(canDoEverythingIndex)
        expect(canDriveIndex).toBeLessThan(canDoEverythingIndex)
        expect(result.cyclicKeys).toHaveLength(0)
      })
    })

    describe('circular dependencies', () => {
      test('detects self-reference A → A', () => {
        const logic = {
          selfRef: 'selfRef', // references itself
        }
        const result = topologicalSortDefsKeys(logic)
        expect(result.cyclicKeys).toContain('selfRef')
      })

      test('detects simple cycle A → B → A', () => {
        const logic = {
          a: 'b', // depends on b
          b: 'a', // depends on a
        }
        const result = topologicalSortDefsKeys(logic)
        expect(result.cyclicKeys.length).toBeGreaterThan(0)
        // At least one of them should be marked cyclic
        expect(result.cyclicKeys.some((k) => k === 'a' || k === 'b')).toBe(true)
      })

      test('detects longer cycle A → B → C → A', () => {
        const logic = {
          a: 'b', // depends on b
          b: 'c', // depends on c
          c: 'a', // depends on a
        }
        const result = topologicalSortDefsKeys(logic)
        expect(result.cyclicKeys.length).toBeGreaterThan(0)
      })

      test('includes cyclic keys in sorted array', () => {
        const logic = {
          a: 'b',
          b: 'a',
        }
        const result = topologicalSortDefsKeys(logic)
        // All keys should be in sorted, even cyclic ones
        expect(result.sorted).toContain('a')
        expect(result.sorted).toContain('b')
      })

      test('handles mixed cyclic and non-cyclic keys', () => {
        const logic = {
          independent: 'fields.age >= 18', // no logic key deps
          cyclic1: 'cyclic2', // cycle
          cyclic2: 'cyclic1', // cycle
        }
        const result = topologicalSortDefsKeys(logic)

        // Independent should not be cyclic
        expect(result.cyclicKeys).not.toContain('independent')
        // At least one cyclic key should be detected
        expect(result.cyclicKeys.length).toBeGreaterThan(0)
      })
    })

    describe('edge cases', () => {
      test('handles key referencing non-existent key', () => {
        const logic = {
          dependsOnMissing: 'missingKey', // missingKey doesn't exist
        }
        const result = topologicalSortDefsKeys(logic)
        // Should still work - missingKey is just a variable, not a logic key
        expect(result.sorted).toContain('dependsOnMissing')
        expect(result.cyclicKeys).toHaveLength(0)
      })

      test('handles expressions referencing field paths (not logic keys)', () => {
        const logic = {
          isAdult: 'fields.age >= 18', // field reference, not logic key
        }
        const result = topologicalSortDefsKeys(logic)
        expect(result.sorted).toContain('isAdult')
        expect(result.cyclicKeys).toHaveLength(0)
      })

      test('distinguishes between logic keys and field paths', () => {
        const logic = {
          checkAge: 'fields.age >= 18', // field path
          checkLogic: 'isAdult and fields.agreed', // logic key + field path
          isAdult: 'fields.birthdate', // field path
        }
        const result = topologicalSortDefsKeys(logic)

        // checkLogic depends on isAdult
        const isAdultIndex = result.sorted.indexOf('isAdult')
        const checkLogicIndex = result.sorted.indexOf('checkLogic')
        expect(isAdultIndex).toBeLessThan(checkLogicIndex)
        expect(result.cyclicKeys).toHaveLength(0)
      })
    })
  })
})
