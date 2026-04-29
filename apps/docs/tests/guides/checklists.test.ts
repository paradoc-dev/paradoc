/**
 * Tests for code snippets in guides/checklists.mdx
 */
import { describe, test, expect } from 'vitest'
import { para } from '@paradoc/core'
import { textRenderer } from '@paradoc/renderer-text'

describe('Checklists Guide', () => {
  // ============================================================================
  // Step 1: Define the Checklist (Boolean Status)
  // ============================================================================

  describe('boolean status checklist', () => {
    describe('object pattern', () => {
      const onboarding = para.checklist({
        name: 'employee-onboarding',
        version: '1.0.0',
        title: 'Employee Onboarding Checklist',
        items: [
          { id: 'signed-contract', title: 'Signed Employment Contract', status: { kind: 'boolean' } },
          { id: 'received-equipment', title: 'Received Equipment', status: { kind: 'boolean' } },
          { id: 'completed-training', title: 'Completed Training', status: { kind: 'boolean' } },
        ],
      })

      test('creates checklist with correct properties', () => {
        expect(onboarding.kind).toBe('checklist')
        expect(onboarding.name).toBe('employee-onboarding')
        expect(onboarding.version).toBe('1.0.0')
        expect(onboarding.title).toBe('Employee Onboarding Checklist')
        expect(onboarding.items).toHaveLength(3)
      })
    })

    describe('builder pattern', () => {
      const onboarding = para
        .checklist()
        .name('employee-onboarding')
        .version('1.0.0')
        .title('Employee Onboarding Checklist')
        .items([
          { id: 'signed-contract', title: 'Signed Employment Contract', status: { kind: 'boolean' } },
          { id: 'received-equipment', title: 'Received Equipment', status: { kind: 'boolean' } },
          { id: 'completed-training', title: 'Completed Training', status: { kind: 'boolean' } },
        ])
        .build()

      test('creates checklist with correct properties', () => {
        expect(onboarding.kind).toBe('checklist')
        expect(onboarding.name).toBe('employee-onboarding')
        expect(onboarding.items).toHaveLength(3)
      })
    })
  })

  // ============================================================================
  // Step 2: Use Enum Statuses
  // ============================================================================

  describe('enum status checklist', () => {
    const approvals = para.checklist({
      name: 'approval-workflow',
      version: '1.0.0',
      title: 'Approval Workflow',
      items: [
        {
          id: 'manager-approval',
          title: 'Manager Approval',
          status: {
            kind: 'enum',
            options: [
              { value: 'pending', label: 'Pending' },
              { value: 'approved', label: 'Approved' },
              { value: 'rejected', label: 'Rejected' },
            ],
          },
        },
        {
          id: 'hr-approval',
          title: 'HR Approval',
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

    test('creates enum checklist', () => {
      expect(approvals.kind).toBe('checklist')
      expect(approvals.name).toBe('approval-workflow')
      expect(approvals.items).toHaveLength(2)
    })

    test('fills with enum values', () => {
      const draft = approvals.fill({
        'manager-approval': 'approved',
        'hr-approval': 'pending',
      })

      expect(draft.getItem('manager-approval')).toBe('approved')
      expect(draft.getItem('hr-approval')).toBe('pending')
    })
  })

  // ============================================================================
  // Step 3 & 4: Fill and Update Items
  // ============================================================================

  describe('fill and update items', () => {
    const onboarding = para.checklist({
      name: 'employee-onboarding',
      version: '1.0.0',
      title: 'Employee Onboarding Checklist',
      items: [
        { id: 'signed-contract', title: 'Signed Employment Contract', status: { kind: 'boolean' } },
        { id: 'received-equipment', title: 'Received Equipment', status: { kind: 'boolean' } },
        { id: 'completed-training', title: 'Completed Training', status: { kind: 'boolean' } },
      ],
    })

    test('fills checklist with boolean values', () => {
      const draft = onboarding.fill({
        'signed-contract': true,
        'received-equipment': true,
        'completed-training': false,
      })

      expect(draft.getItem('signed-contract')).toBe(true)
      expect(draft.getAllItems()).toEqual({
        'signed-contract': true,
        'received-equipment': true,
        'completed-training': false,
      })
    })

    test('setItem updates immutably', () => {
      const draft = onboarding.fill({
        'signed-contract': true,
        'received-equipment': true,
        'completed-training': false,
      })

      const updated = draft.setItem('completed-training', true)

      expect(updated.getItem('completed-training')).toBe(true)
      expect(draft.getItem('completed-training')).toBe(false) // original unchanged
    })
  })

  // ============================================================================
  // Step 5 & 6: Add Layer and Render
  // ============================================================================

  describe('checklist with layer and rendering', () => {
    const onboarding = para.checklist({
      name: 'employee-onboarding',
      version: '1.0.0',
      title: 'Employee Onboarding Checklist',
      items: [
        { id: 'signed-contract', title: 'Signed Employment Contract', status: { kind: 'boolean' } },
        { id: 'received-equipment', title: 'Received Equipment', status: { kind: 'boolean' } },
        { id: 'completed-training', title: 'Completed Training', status: { kind: 'boolean' } },
      ],
      defaultLayer: 'markdown',
      layers: {
        markdown: {
          kind: 'inline',
          mimeType: 'text/markdown',
          text: `# {{schema.title}}

{{#each items}}
- [{{#if value}}x{{else}} {{/if}}] {{title}}
{{/each}}`,
        },
      },
    })

    test('renders checklist with filled data', async () => {
      const draft = onboarding.fill({
        'signed-contract': true,
        'received-equipment': true,
        'completed-training': false,
      })

      const output = await draft.render({ renderer: textRenderer() })

      expect(output).toContain('Employee Onboarding Checklist')
      expect(output).toContain('[x] Signed Employment Contract')
      expect(output).toContain('[x] Received Equipment')
      expect(output).toContain('[ ] Completed Training')
    })
  })

  // ============================================================================
  // Step 7: Save the Artifact
  // ============================================================================

  describe('serialization', () => {
    const onboarding = para.checklist({
      name: 'employee-onboarding',
      version: '1.0.0',
      title: 'Employee Onboarding Checklist',
      items: [
        { id: 'signed-contract', title: 'Signed Employment Contract', status: { kind: 'boolean' } },
        { id: 'received-equipment', title: 'Received Equipment', status: { kind: 'boolean' } },
        { id: 'completed-training', title: 'Completed Training', status: { kind: 'boolean' } },
      ],
    })

    test('serializes to JSON', () => {
      const json = onboarding.toJSON()
      expect(json.kind).toBe('checklist')
      expect(json.name).toBe('employee-onboarding')
    })

    test('serializes to YAML', () => {
      const yaml = onboarding.toYAML()
      expect(yaml).toContain('kind: checklist')
      expect(yaml).toContain('name: employee-onboarding')
    })

    test('round-trips through JSON', () => {
      const jsonStr = JSON.stringify(onboarding.toJSON())
      const loaded = para.load(jsonStr)
      expect(loaded.kind).toBe('checklist')
      expect(loaded.name).toBe('employee-onboarding')
    })

    test('round-trips through YAML', () => {
      const yaml = onboarding.toYAML()
      const loaded = para.load(yaml)
      expect(loaded.kind).toBe('checklist')
      expect(loaded.name).toBe('employee-onboarding')
    })
  })
})
