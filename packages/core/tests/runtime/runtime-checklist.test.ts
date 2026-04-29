import { describe, expect, test } from 'vitest'
import { para, DraftChecklist, type InferChecklistPayload } from '@/index'

describe('DraftChecklist', () => {
  // ============================================================================
  // Test Helper Functions
  // ============================================================================

  const createBooleanChecklist = () =>
    para.checklist({
      name: 'boolean-checklist',
      version: '1.0.0',
      title: 'Boolean Checklist',
      items: [
        { id: 'task1', title: 'Task 1', status: { kind: 'boolean' } },
        { id: 'task2', title: 'Task 2', status: { kind: 'boolean', default: true } },
        { id: 'task3', title: 'Task 3' }, // Default to boolean
      ],
    })

  const createEnumChecklist = () =>
    para.checklist({
      name: 'enum-checklist',
      version: '1.0.0',
      title: 'Enum Checklist',
      items: [
        {
          id: 'approval',
          title: 'Approval Status',
          status: {
            kind: 'enum',
            options: [
              { value: 'pending', label: 'Pending' },
              { value: 'approved', label: 'Approved' },
              { value: 'rejected', label: 'Rejected' },
            ],
          },
        },
      ],
    })

  const createMixedChecklist = () =>
    para.checklist({
      name: 'mixed-checklist',
      version: '1.0.0',
      title: 'Mixed Checklist',
      items: [
        { id: 'reviewed', title: 'Reviewed', status: { kind: 'boolean' } },
        {
          id: 'approval',
          title: 'Approval',
          status: {
            kind: 'enum',
            options: [
              { value: 'pending', label: 'Pending' },
              { value: 'approved', label: 'Approved' },
            ],
          },
        },
      ],
      layers: {
        html: {
          kind: 'inline',
          mimeType: 'text/html',
          text: '<div>{{#each items}}<p>{{title}}: {{value}}</p>{{/each}}</div>',
        },
      },
      defaultLayer: 'html',
    })

  // ============================================================================
  // fill() Tests
  // ============================================================================

  describe('fill()', () => {
    test('creates DraftChecklist with checklist and data', () => {
      const checklist = createBooleanChecklist()
      const filled = checklist.fill({ task1: true, task2: false, task3: true })

      expect(filled.checklist.name).toBe(checklist.name)
      expect(filled.getItem('task1')).toBe(true)
      expect(filled.getItem('task2')).toBe(false)
      expect(filled.getItem('task3')).toBe(true)
    })

    test('throws error for invalid boolean value', () => {
      const checklist = createBooleanChecklist()

      expect(() => {
        checklist.fill({ task1: 'invalid' as unknown as boolean, task2: false, task3: true })
      }).toThrow('Invalid value for item "task1": expected boolean')
    })

    test('throws error for invalid enum value', () => {
      const checklist = createEnumChecklist()

      expect(() => {
        checklist.fill({ approval: 'invalid' as 'pending' })
      }).toThrow('Invalid value for item "approval": "invalid" is not in')
    })

    test('accepts valid enum value', () => {
      const checklist = createEnumChecklist()
      const filled = checklist.fill({ approval: 'approved' })

      expect(filled.getItem('approval')).toBe('approved')
    })
  })

  // ============================================================================
  // fill() and safeFill() Tests
  // ============================================================================

  describe('fill() and safeFill()', () => {
    test('checklist.fill() creates DraftChecklist', () => {
      const checklist = createBooleanChecklist()
      const filled = checklist.fill({ task1: true, task2: false, task3: true })

      expect(filled).toHaveProperty('phase', 'draft')
      expect(filled.getItem('task1')).toBe(true)
    })

    test('checklist.safeFill() returns success for valid data', () => {
      const checklist = createBooleanChecklist()
      const result = checklist.safeFill({ task1: true, task2: false, task3: true })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toHaveProperty('phase', 'draft')
        expect(result.data.getItem('task1')).toBe(true)
      }
    })

    test('checklist.safeFill() returns failure for invalid data', () => {
      const checklist = createEnumChecklist()
      const result = checklist.safeFill({ approval: 'invalid' as 'pending' })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.message).toContain('invalid')
      }
    })
  })

  // ============================================================================
  // getItem() and getAllItems() Tests
  // ============================================================================

  describe('getItem() and getAllItems()', () => {
    test('getItem() returns value for known item', () => {
      const checklist = createBooleanChecklist()
      const filled = checklist.fill({ task1: true, task2: false, task3: true })

      expect(filled.getItem('task1')).toBe(true)
      expect(filled.getItem('task2')).toBe(false)
    })

    test('getItem() throws for unknown item', () => {
      const checklist = createBooleanChecklist()
      const filled = checklist.fill({ task1: true, task2: false, task3: true })

      expect(() => {
        // Use type assertion to bypass compile-time check for runtime validation test
        filled.getItem('unknown' as 'task1')
      }).toThrow('Unknown item "unknown"')
    })

    test('getAllItems() returns all values', () => {
      const checklist = createBooleanChecklist()
      const filled = checklist.fill({ task1: true, task2: false, task3: true })

      expect(filled.getAllItems()).toEqual({
        task1: true,
        task2: false,
        task3: true,
      })
    })
  })

  // ============================================================================
  // isValid() Tests
  // ============================================================================

  describe('isValid()', () => {
    test('returns true for validated data', () => {
      const checklist = createBooleanChecklist()
      const filled = checklist.fill({ task1: true, task2: false, task3: true })

      expect(filled.isValid()).toBe(true)
    })
  })

  // ============================================================================
  // setItem() Immutability Tests
  // ============================================================================

  describe('setItem() immutability', () => {
    test('setItem() returns new DraftChecklist', () => {
      const checklist = createBooleanChecklist()
      const filled = checklist.fill({ task1: true, task2: false, task3: true })
      const updated = filled.setItem('task1', false)

      expect(updated).not.toBe(filled)
      expect(updated.getItem('task1')).toBe(false)
      expect(filled.getItem('task1')).toBe(true) // Original unchanged
    })

    test('setItem() validates new value', () => {
      const checklist = createEnumChecklist()
      const filled = checklist.fill({ approval: 'pending' })

      expect(() => {
        // Use type assertion to bypass compile-time check for runtime validation test
        filled.setItem('approval', 'invalid' as 'pending')
      }).toThrow()
    })

    test('setItem() throws for unknown item ID', () => {
      const checklist = createBooleanChecklist()
      const filled = checklist.fill({ task1: true, task2: false, task3: true })

      expect(() => {
        // Use type assertion to bypass compile-time check for runtime validation test
        filled.setItem('unknown_item' as 'task1', true)
      }).toThrow('Unknown item "unknown_item"')
    })
  })

  // ============================================================================
  // clone() Tests
  // ============================================================================

  describe('clone()', () => {
    test('clone() creates exact copy', () => {
      const checklist = createBooleanChecklist()
      const filled = checklist.fill({ task1: true, task2: false, task3: true })
      const copy = filled.clone()

      expect(copy).not.toBe(filled)
      expect(copy.getAllItems()).toEqual(filled.getAllItems())
    })
  })

  // ============================================================================
  // toJSON() and toYAML() Tests
  // ============================================================================

  describe('toJSON() and toYAML()', () => {
    test('toJSON() returns serializable object', () => {
      const checklist = createBooleanChecklist()
      const filled = checklist.fill({ task1: true, task2: false, task3: true })
      const json = filled.toJSON()

      expect(json.checklist).toBeDefined()
      expect(json.checklist.name).toBe('boolean-checklist')
      expect(json.items).toEqual({ task1: true, task2: false, task3: true })
    })

    test('toYAML() returns YAML string', () => {
      const checklist = createBooleanChecklist()
      const filled = checklist.fill({ task1: true, task2: false, task3: true })
      const yaml = filled.toYAML()

      expect(typeof yaml).toBe('string')
      expect(yaml).toContain('checklist:')
      expect(yaml).toContain('items:')
    })
  })

  // ============================================================================
  // render() Tests
  // ============================================================================

  describe('render()', () => {
    test('render() throws error when no layers defined', async () => {
      const checklist = createBooleanChecklist() // No layers
      const filled = checklist.fill({ task1: true, task2: false, task3: true })

      await expect(
        filled.render()
      ).rejects.toThrow('Checklist has no layers defined')
    })
  })

  // ============================================================================
  // Type Inference Tests
  // ============================================================================

  describe('InferChecklistPayload type', () => {
    test('infers correct type for boolean checklist', () => {
      const checklist = para.checklist({
        name: 'typed-checklist',
        items: [
          { id: 'task1', title: 'Task 1', status: { kind: 'boolean' as const } },
          { id: 'task2', title: 'Task 2', status: { kind: 'boolean' as const } },
        ],
      })

      type Payload = InferChecklistPayload<typeof checklist>

      // This is a compile-time test - the type should be inferred correctly
      const data: Payload = { task1: true, task2: false }
      const filled = checklist.fill(data)

      expect(filled.getItem('task1')).toBe(true)
    })

    test('infers correct type for enum checklist', () => {
      const checklist = para.checklist({
        name: 'typed-enum-checklist',
        items: [
          {
            id: 'status',
            title: 'Status',
            status: {
              kind: 'enum' as const,
              options: [
                { value: 'open' as const, label: 'Open' },
                { value: 'closed' as const, label: 'Closed' },
              ],
            },
          },
        ],
      })

      type Payload = InferChecklistPayload<typeof checklist>

      // This is a compile-time test
      const data: Payload = { status: 'open' }
      const filled = checklist.fill(data)

      expect(filled.getItem('status')).toBe('open')
    })
  })
})
