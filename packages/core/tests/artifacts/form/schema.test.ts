import { describe, test, expect } from 'vitest'
import { form } from '@/artifacts'
import type { Form, EnumField } from '@paradoc/types'

/**
 * Form Schema Tests
 *
 * Tests for Form artifact validation using both object pattern (direct validation)
 * and builder pattern (fluent API). Both patterns validate against the same
 * underlying JSON Schema.
 */
describe('Form', () => {
  // ==========================================================================
  // OBJECT PATTERN - Direct validation with form(input)
  // ==========================================================================
  describe('Object Pattern', () => {
    describe('form() - direct validation', () => {
      describe('success cases', () => {
        test('creates valid form with minimal required properties', () => {
          const input: Form = {
            kind: 'form',
            version: '1.0.0',
            name: 'contact-form',
            title: 'Contact Form',
          }
          const result = form(input)
          expect(result.kind).toBe('form')
          expect(result.name).toBe('contact-form')
          expect(result.title).toBe('Contact Form')
        })

        test('creates form with fields', () => {
          const input: Form = {
            kind: 'form',
            version: '1.0.0',
            name: 'user-form',
            title: 'User Form',
            fields: {
              name: { type: 'text', label: 'Full Name' },
              email: { type: 'email', label: 'Email' },
            },
          }
          const result = form(input)
          expect(result?.fields?.name?.type).toBe('text')
          expect(result?.fields?.email?.type).toBe('email')
        })

        test('creates form with various field types', () => {
          const input: Form = {
            kind: 'form',
            version: '1.0.0',
            name: 'complex-form',
            title: 'Complex Form',
            fields: {
              textField: { type: 'text', label: 'Text' },
              numberField: { type: 'number', label: 'Number' },
              booleanField: { type: 'boolean', label: 'Boolean' },
              emailField: { type: 'email', label: 'Email' },
              enumField: { type: 'enum', enum: [{ value: 'a' }, { value: 'b' }, { value: 'c' }], label: 'Enum' } as EnumField,
              moneyField: { type: 'money', label: 'Money' },
              addressField: { type: 'address', label: 'Address' },
              phoneField: { type: 'phone', label: 'Phone' },
              coordinateField: { type: 'coordinate', label: 'Coordinate' },
            },
          }
          const result = form(input)
          expect(Object.keys(result.fields || {})).toHaveLength(9)
        })

        test('creates form with nested fieldset', () => {
          const input: Form = {
            kind: 'form',
            version: '1.0.0',
            name: 'nested-form',
            title: 'Nested Form',
            fields: {
              personal: {
                type: 'fieldset',
                label: 'Personal Info',
                fields: {
                  name: { type: 'text', label: 'Name' },
                  age: { type: 'number', label: 'Age' },
                },
              },
            },
          }
          const result = form(input)
          expect(result?.fields?.personal?.type).toBe('fieldset')
          const fields = result?.fields as any
          expect(fields.personal.fields.name.type).toBe('text')
        })

        test('creates form with deeply nested fieldsets', () => {
          const input: Form = {
            kind: 'form',
            version: '1.0.0',
            name: 'deeply-nested',
            title: 'Deeply Nested',
            fields: {
              level1: {
                type: 'fieldset',
                label: 'Level 1',
                fields: {
                  level2: {
                    type: 'fieldset',
                    label: 'Level 2',
                    fields: {
                      level3: {
                        type: 'fieldset',
                        label: 'Level 3',
                        fields: {
                          name: { type: 'text', label: 'Name' },
                        },
                      },
                    },
                  },
                },
              },
            },
          }
          const result = form(input)
          const fields = result.fields as any
          expect(fields.level1.fields.level2.fields.level3.fields.name.type).toBe('text')
        })

        test('creates form with inline template', () => {
          const input: Form = {
            kind: 'form',
            version: '1.0.0',
            name: 'form-with-template',
            title: 'Form with Template',
            layers: {
              default: {
                kind: 'inline',
                mimeType: 'text/markdown',
                text: '# Welcome\n\nPlease fill out this form.',
              },
            },
            defaultLayer: 'default',
          }
          const result = form(input)
          expect(result.layers?.default?.kind).toBe('inline')
          if (result.layers?.default?.kind === 'inline') {
            expect(result.layers.default.text).toBe('# Welcome\n\nPlease fill out this form.')
          }
        })

        test('creates form with file template', () => {
          const input: Form = {
            kind: 'form',
            version: '1.0.0',
            name: 'form-with-file-template',
            title: 'Form with File Template',
            layers: {
              pdf: {
                kind: 'file',
                mimeType: 'application/pdf',
                path: './template.pdf',
              },
            },
            defaultLayer: 'pdf',
          }
          const result = form(input)
          expect(result.layers?.pdf?.kind).toBe('file')
          if (result.layers?.pdf?.kind === 'file') {
            expect(result.layers.pdf.path).toBe('./template.pdf')
          }
        })

        test('creates form with annexes', () => {
          const input: Form = {
            kind: 'form',
            version: '1.0.0',
            name: 'form-with-annexes',
            title: 'Form with Annexes',
            annexes: {
              terms: {
                title: 'Terms and Conditions',
              },
            },
          }
          const result = form(input)
          expect(Object.keys(result.annexes || {})).toHaveLength(1)
          expect(result?.annexes?.terms?.title).toBe('Terms and Conditions')
        })

        test('creates form with multiple annexes', () => {
          const input: Form = {
            kind: 'form',
            version: '1.0.0',
            name: 'form-with-multiple-annexes',
            title: 'Form with Multiple Annexes',
            annexes: {
              terms: { title: 'Terms and Conditions' },
              privacy: { title: 'Privacy Policy' },
              agreement: { title: 'Agreement' },
            },
          }
          const result = form(input)
          expect(Object.keys(result.annexes || {})).toHaveLength(3)
        })

        test('creates form with description', () => {
          const input: Form = {
            kind: 'form',
            version: '1.0.0',
            name: 'described-form',
            title: 'Described Form',
            description: 'This is a detailed description of the form.',
          }
          const result = form(input)
          expect(result.description).toBe('This is a detailed description of the form.')
        })

        test('creates form with code', () => {
          const input: Form = {
            kind: 'form',
            version: '1.0.0',
            name: 'coded-form',
            title: 'Coded Form',
            code: 'FORM-001',
          }
          const result = form(input)
          expect(result.code).toBe('FORM-001')
        })

        test('creates form with source language', () => {
          const input: Form = {
            kind: 'form',
            version: '1.0.0',
            name: 'spanish-form',
            title: 'Spanish Form',
            language: 'es',
          }
          const result = form(input)
          expect(result.language).toBe('es')
        })

        test('creates form with metadata', () => {
          const input: Form = {
            kind: 'form',
            version: '1.0.0',
            name: 'metadata-form',
            title: 'Metadata Form',
            metadata: {
              version: '1.0',
              author: 'John Doe',
              category: 'HR',
            },
          }
          const result = form(input)
          expect(result.metadata?.version).toBe('1.0')
          expect(result.metadata?.author).toBe('John Doe')
        })

        test('creates form with inline instructions', () => {
          const input: Form = {
            kind: 'form',
            version: '1.0.0',
            name: 'form-inline-instructions',
            title: 'Form with Inline Instructions',
            instructions: {
              kind: 'inline',
              text: 'Complete all fields before submitting. Refer to IRS Publication 15 for guidance.',
            },
          }
          const result = form(input)
          expect(result.instructions?.kind).toBe('inline')
          if (result.instructions?.kind === 'inline') {
            expect(result.instructions.text).toContain('IRS Publication 15')
          }
        })

        test('creates form with file instructions', () => {
          const input: Form = {
            kind: 'form',
            version: '1.0.0',
            name: 'form-file-instructions',
            title: 'Form with File Instructions',
            instructions: {
              kind: 'file',
              path: './instructions/w9-instructions.pdf',
              mimeType: 'application/pdf',
              title: 'W-9 Instructions',
              description: 'Official IRS instructions for Form W-9',
              checksum: 'sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
            },
          }
          const result = form(input)
          expect(result.instructions?.kind).toBe('file')
          if (result.instructions?.kind === 'file') {
            expect(result.instructions.path).toBe('./instructions/w9-instructions.pdf')
            expect(result.instructions.mimeType).toBe('application/pdf')
            expect(result.instructions.title).toBe('W-9 Instructions')
            expect(result.instructions.checksum).toMatch(/^sha256:[a-f0-9]{64}$/)
          }
        })

        test('creates form with inline agentInstructions', () => {
          const input: Form = {
            kind: 'form',
            version: '1.0.0',
            name: 'form-inline-agent',
            title: 'Form with Agent Instructions',
            agentInstructions: {
              kind: 'inline',
              text: 'Ask for SSN first, then name. Group address fields together. Use formal tone.',
            },
          }
          const result = form(input)
          expect(result.agentInstructions?.kind).toBe('inline')
          if (result.agentInstructions?.kind === 'inline') {
            expect(result.agentInstructions.text).toContain('formal tone')
          }
        })

        test('creates form with file agentInstructions', () => {
          const input: Form = {
            kind: 'form',
            version: '1.0.0',
            name: 'form-file-agent',
            title: 'Form with File Agent Instructions',
            agentInstructions: {
              kind: 'file',
              path: './prompts/agent-guide.md',
              mimeType: 'text/markdown',
            },
          }
          const result = form(input)
          expect(result.agentInstructions?.kind).toBe('file')
          if (result.agentInstructions?.kind === 'file') {
            expect(result.agentInstructions.path).toBe('./prompts/agent-guide.md')
            expect(result.agentInstructions.mimeType).toBe('text/markdown')
          }
        })

        test('creates form with both instructions and agentInstructions', () => {
          const input: Form = {
            kind: 'form',
            version: '1.0.0',
            name: 'form-both-instructions',
            title: 'Form with Both Instruction Types',
            instructions: {
              kind: 'file',
              path: './instructions/regulatory-guide.pdf',
              mimeType: 'application/pdf',
            },
            agentInstructions: {
              kind: 'inline',
              text: 'Present fields in order: identification, contact, financial.',
            },
          }
          const result = form(input)
          expect(result.instructions?.kind).toBe('file')
          expect(result.agentInstructions?.kind).toBe('inline')
        })

        test('creates form with all properties (except releaseDate)', () => {
          const input: Form = {
            kind: 'form',
            version: '1.0.0',
            name: 'complete-form',
            title: 'Complete Form',
            description: 'A fully configured form',
            code: 'COMPLETE-001',
            metadata: { version: '1.0' },
            fields: {
              name: { type: 'text', label: 'Name', required: true },
              email: { type: 'email', label: 'Email', required: true },
            },
            layers: {
              default: {
                kind: 'inline',
                mimeType: 'text/markdown',
                text: '# Instructions\n\nPlease complete all required fields.',
              },
            },
            defaultLayer: 'default',
            annexes: { guide: { title: 'User Guide' } },
          }
          const result = form(input)
          expect(result.toJSON({ includeSchema: false })).toEqual({ ...input, allowAdditionalAnnexes: false })
        })

        test('creates form with valid name patterns', () => {
          const validNames = [
            'simple',
            'with-dash',
            'PascalCase',
            'camelCase',
            'with-multiple-dashes',
            '123numeric',
            'abc123def',
            'a',
            'A',
            '1',
          ]

          for (const name of validNames) {
            const input: Form = {
              kind: 'form',
              version: '1.0.0',
              name,
              title: 'Test Form',
            }
            const result = form(input)
            expect(result.name).toBe(name)
          }
        })

        test('creates form with long valid name', () => {
          const input: Form = {
            kind: 'form',
            version: '1.0.0',
            name: 'a'.repeat(128),
            title: 'Test Form',
          }
          const result = form(input)
          expect(result.name).toHaveLength(128)
        })

        test('creates form with long valid title', () => {
          const input: Form = {
            kind: 'form',
            version: '1.0.0',
            name: 'test',
            title: 'T'.repeat(200),
          }
          const result = form(input)
          expect(result.title).toHaveLength(200)
        })

        test('creates form with long valid description', () => {
          const input: Form = {
            kind: 'form',
            version: '1.0.0',
            name: 'test',
            title: 'Test',
            description: 'D'.repeat(2000),
          }
          const result = form(input)
          expect(result.description).toHaveLength(2000)
        })

        test('creates form with many fields', () => {
          const fields: Form['fields'] = {}
          for (let i = 0; i < 50; i++) {
            fields[`field${i}`] = { type: 'text', label: `Field ${i}` }
          }
          const input: Form = {
            kind: 'form',
            version: '1.0.0',
            name: 'many-fields',
            title: 'Many Fields',
            fields,
          }
          const result = form(input)
          expect(Object.keys(result.fields || {})).toHaveLength(50)
        })
      })

      describe('validation failures', () => {
        test('corrects kind when incorrect value is provided', () => {
          const input = {
            kind: 'invalid',
            version: '1.0.0',
            name: 'test',
            title: 'Test',
          } as any
          const result = form(input)
          expect(result.kind).toBe('form')
        })

        test('throws error when name is missing', () => {
          const input = { kind: 'form', version: '1.0.0', title: 'Test' } as any
          expect(() => form(input)).toThrow()
        })

        test('throws error when name is empty string', () => {
          const input = { kind: 'form', version: '1.0.0', name: '', title: 'Test' } as any
          expect(() => form(input)).toThrow()
        })

        test('throws error when title is empty string', () => {
          const input = { kind: 'form', version: '1.0.0', name: 'test', title: '' } as any
          expect(() => form(input)).toThrow()
        })

        test('throws error when name exceeds maxLength', () => {
          const input = { kind: 'form', version: '1.0.0', name: 'a'.repeat(129), title: 'Test' } as any
          expect(() => form(input)).toThrow()
        })

        test('throws error when title exceeds maxLength', () => {
          const input = { kind: 'form', version: '1.0.0', name: 'test', title: 'T'.repeat(201) } as any
          expect(() => form(input)).toThrow()
        })

        test('throws error when description exceeds maxLength', () => {
          const input = {
            kind: 'form',
            version: '1.0.0',
            name: 'test',
            title: 'Test',
            description: 'D'.repeat(2001),
          } as any
          expect(() => form(input)).toThrow()
        })

        test('throws error when code is empty string', () => {
          const input = { kind: 'form', version: '1.0.0', name: 'test', title: 'Test', code: '' } as any
          expect(() => form(input)).toThrow()
        })

        test('throws error when language has invalid format', () => {
          const input = { kind: 'form', version: '1.0.0', name: 'test', title: 'Test', language: 'english' } as any
          expect(() => form(input)).toThrow()
        })

        test('throws error when name has invalid pattern (starts with dash)', () => {
          const input = { kind: 'form', version: '1.0.0', name: '-invalid', title: 'Test' } as any
          expect(() => form(input)).toThrow()
        })

        test('throws error when name has invalid pattern (ends with dash)', () => {
          const input = { kind: 'form', version: '1.0.0', name: 'invalid-', title: 'Test' } as any
          expect(() => form(input)).toThrow()
        })

        test('throws error when name has invalid pattern (consecutive dashes)', () => {
          const input = { kind: 'form', version: '1.0.0', name: 'invalid--name', title: 'Test' } as any
          expect(() => form(input)).toThrow()
        })

        test('throws error when name has invalid pattern (underscore)', () => {
          const input = { kind: 'form', version: '1.0.0', name: 'invalid_name', title: 'Test' } as any
          expect(() => form(input)).toThrow()
        })

        test('throws error when name has invalid pattern (special chars)', () => {
          const input = { kind: 'form', version: '1.0.0', name: 'invalid@name', title: 'Test' } as any
          expect(() => form(input)).toThrow()
        })

        test('throws error when releaseDate has invalid format', () => {
          const input = {
            kind: 'form',
            version: '1.0.0',
            name: 'test',
            title: 'Test',
            releaseDate: 'invalid-date',
          } as any
          expect(() => form(input)).toThrow()
        })

        test('throws error when field definition is invalid', () => {
          const input = {
            kind: 'form',
            version: '1.0.0',
            name: 'test',
            title: 'Test',
            fields: { invalid: { type: 'invalid-type' } },
          } as any
          expect(() => form(input)).toThrow()
        })

        test('throws error when annex is invalid', () => {
          const input = {
            kind: 'form',
            version: '1.0.0',
            name: 'test',
            title: 'Test',
            annexes: {
              test: { description: '' }, // empty description should fail
            },
          } as any
          expect(() => form(input)).toThrow()
        })

        test('rejects additional properties (strict validation)', () => {
          const input = {
            kind: 'form',
            version: '1.0.0',
            name: 'test',
            title: 'Test',
            extra: 'should be removed',
          } as any
          expect(() => form(input)).toThrow()
        })

        test('throws error when input is null', () => {
          expect(() => form(null as any)).toThrow()
        })

        test('throws error when input is a string', () => {
          expect(() => form('not an object' as any)).toThrow()
        })

        test('throws error when input is a number', () => {
          expect(() => form(123 as any)).toThrow()
        })

        test('throws error when input is an array', () => {
          expect(() => form([{ kind: 'form', name: 'test', title: 'Test' }] as any)).toThrow()
        })
      })
    })

    describe('form.from()', () => {
      describe('success cases', () => {
        test('parses valid form and returns FormInstance', () => {
          const input = { kind: 'form', version: '1.0.0', name: 'test-form', title: 'Test Form' }
          const result = form.from(input)
          expect(result.toJSON({ includeSchema: false })).toEqual({ ...input, allowAdditionalAnnexes: false })
        })

        test('parses form with fields', () => {
          const input = {
            kind: 'form',
            version: '1.0.0',
            name: 'user-form',
            title: 'User Form',
            fields: { name: { type: 'text', label: 'Name' } },
          }
          const result = form.from(input)
          expect(result.fields?.name!.type).toBe('text')
        })

        test('parses form with template', () => {
          const input = {
            kind: 'form',
            version: '1.0.0',
            name: 'form-with-template',
            title: 'Form with Template',
            layers: {
              default: { kind: 'inline', mimeType: 'text/plain', text: 'Content here' },
            },
          }
          const result = form.from(input)
          expect(result.layers?.default?.kind).toBe('inline')
          if (result.layers?.default?.kind === 'inline') {
            expect(result.layers.default.text).toBe('Content here')
          }
        })

        test('parses form with annexes', () => {
          const input = {
            kind: 'form',
            version: '1.0.0',
            name: 'form-with-annexes',
            title: 'Form with Annexes',
            annexes: { annex1: { title: 'Annex 1' } },
          }
          const result = form.from(input)
          expect(Object.keys(result.annexes || {})).toHaveLength(1)
        })
      })

      describe('validation failures', () => {
        test('throws error for missing name', () => {
          expect(() => form.from({ kind: 'form', title: 'Test' })).toThrow()
        })

        test('throws error for null input', () => {
          expect(() => form.from(null)).toThrow()
        })

        test('throws error for undefined input', () => {
          expect(() => form.from(undefined)).toThrow()
        })

        test('throws error for invalid input type', () => {
          expect(() => form.from('string')).toThrow()
        })
      })
    })

    describe('form.safeFrom()', () => {
      describe('success cases', () => {
        test('returns success for valid form', () => {
          const input = { kind: 'form', version: '1.0.0', name: 'test-form', title: 'Test Form' }
          const result = form.safeFrom(input)
          expect(result.success).toBe(true)
          if (result.success) {
            expect(result.data.toJSON({ includeSchema: false })).toEqual({ ...input, allowAdditionalAnnexes: false })
          }
        })

        test('returns success for form with all properties', () => {
          const input = {
            kind: 'form',
            version: '1.0.0',
            name: 'complete-form',
            title: 'Complete Form',
            description: 'Description',
            code: 'CODE-001',
            metadata: { version: '1.0' },
            fields: { name: { type: 'text', label: 'Name' } },
            layers: { default: { kind: 'inline', mimeType: 'text/plain', text: 'Content' } },
            annexes: { annex1: { title: 'Annex 1' } },
          }
          const result = form.safeFrom(input)
          expect(result.success).toBe(true)
        })
      })

      describe('failure cases', () => {
        test('returns error for missing name', () => {
          const result = form.safeFrom({ kind: 'form', title: 'Test' })
          expect(result.success).toBe(false)
          if (!result.success) {
            expect(result.error).toBeInstanceOf(Error)
          }
        })

        test('returns error for empty name', () => {
          const result = form.safeFrom({ kind: 'form', name: '', title: 'Test' })
          expect(result.success).toBe(false)
        })

        test('returns error for empty title', () => {
          const result = form.safeFrom({ kind: 'form', name: 'test', title: '' })
          expect(result.success).toBe(false)
        })

        test('returns error for null input', () => {
          const result = form.safeFrom(null)
          expect(result.success).toBe(false)
        })

        test('returns error for undefined input', () => {
          const result = form.safeFrom(undefined)
          expect(result.success).toBe(false)
        })

        test('returns error for invalid input type', () => {
          const result = form.safeFrom('string')
          expect(result.success).toBe(false)
        })

        test('returns error for invalid name pattern', () => {
          const result = form.safeFrom({ kind: 'form', name: '-invalid', title: 'Test' })
          expect(result.success).toBe(false)
        })

        test('returns error for name too long', () => {
          const result = form.safeFrom({ kind: 'form', name: 'a'.repeat(129), title: 'Test' })
          expect(result.success).toBe(false)
        })

        test('rejects additional properties (strict validation)', () => {
          const input = { kind: 'form', version: '1.0.0', name: 'test', title: 'Test', extra: 'removed' }
          const result = form.safeFrom(input)
          expect(result.success).toBe(false)
        })
      })
    })
  })

  // ==========================================================================
  // BUILDER PATTERN - Fluent API with form().name().title().build()
  // ==========================================================================
  describe('Builder Pattern', () => {
    describe('fluent builder API', () => {
      describe('success cases', () => {
        test('builds valid form with minimal required properties', () => {
          const result = form().name('contact-form').version('1.0.0').title('Contact Form').build()
          expect(result.kind).toBe('form')
          expect(result.name).toBe('contact-form')
          expect(result.title).toBe('Contact Form')
        })

        test('builds form with single field using field()', () => {
          const result = form()
            .name('user-form')
            .version('1.0.0')
            .title('User Form')
            .field('name', { type: 'text', label: 'Full Name' })
            .build()
          expect(result.fields).toBeDefined()
          const fields = result.fields as any
          expect(fields.name.type).toBe('text')
          expect(fields.name.label).toBe('Full Name')
        })

        test('builds form with multiple fields using field()', () => {
          const result = form()
            .name('profile-form')
            .version('1.0.0')
            .title('Profile Form')
            .field('name', { type: 'text', label: 'Name' })
            .field('email', { type: 'email', label: 'Email' })
            .field('age', { type: 'number', label: 'Age' })
            .build()
          expect(Object.keys(result.fields || {})).toHaveLength(3)
        })

        test('builds form with fields using fields()', () => {
          const result = form()
            .name('bulk-form')
            .version('1.0.0')
            .title('Bulk Form')
            .fields({
              name: { type: 'text', label: 'Name' },
              email: { type: 'email', label: 'Email' },
              subscribe: { type: 'boolean', label: 'Subscribe' },
            })
            .build()
          expect(Object.keys(result.fields || {})).toHaveLength(3)
        })

        test('builds form with various field types', () => {
          const result = form()
            .name('complex-form')
            .version('1.0.0')
            .title('Complex Form')
            .fields({
              textField: { type: 'text', label: 'Text' },
              numberField: { type: 'number', label: 'Number', min: 0, max: 100 },
              booleanField: { type: 'boolean', label: 'Boolean' },
              emailField: { type: 'email', label: 'Email' },
              enumField: { type: 'enum', enum: [{ value: 'a' }, { value: 'b' }, { value: 'c' }], label: 'Enum' },
              moneyField: { type: 'money', label: 'Money' },
              addressField: { type: 'address', label: 'Address' },
              phoneField: { type: 'phone', label: 'Phone' },
              coordinateField: { type: 'coordinate', label: 'Coordinate' },
            })
            .build()
          expect(Object.keys(result.fields || {})).toHaveLength(9)
        })

        test('builds form with nested fieldset', () => {
          const result = form()
            .name('nested-form')
            .version('1.0.0')
            .title('Nested Form')
            .field('personal', {
              type: 'fieldset',
              label: 'Personal Info',
              fields: {
                name: { type: 'text', label: 'Name' },
                age: { type: 'number', label: 'Age' },
              },
            })
            .build()
          expect(result.fields).toBeDefined()
          const fields = result.fields as any
          expect(fields.personal.type).toBe('fieldset')
          expect(fields.personal.fields.name.type).toBe('text')
        })

        test('builds form with deeply nested fieldsets', () => {
          const result = form()
            .name('deeply-nested')
            .version('1.0.0')
            .title('Deeply Nested')
            .field('level1', {
              type: 'fieldset',
              label: 'Level 1',
              fields: {
                level2: {
                  type: 'fieldset',
                  label: 'Level 2',
                  fields: {
                    level3: {
                      type: 'fieldset',
                      label: 'Level 3',
                      fields: { name: { type: 'text', label: 'Name' } },
                    },
                  },
                },
              },
            })
            .build()
          expect(result.fields).toBeDefined()
          const fields = result.fields as any
          expect(fields.level1.fields.level2.fields.level3.fields.name.type).toBe('text')
        })

        test('builds form with inline template', () => {
          const result = form()
            .name('form-with-template')
            .version('1.0.0')
            .title('Form with Template')
            .inlineLayer('default', { mimeType: 'text/markdown', text: '# Welcome\n\nPlease fill out this form.' })
            .defaultLayer('default')
            .build()
          expect(result.layers).toBeDefined()
          expect(result.layers?.default?.kind).toBe('inline')
          if (result.layers?.default?.kind === 'inline') {
            expect(result.layers.default.text).toBe('# Welcome\n\nPlease fill out this form.')
          }
        })

        test('builds form with file template', () => {
          const result = form()
            .name('form-with-file-template')
            .version('1.0.0')
            .title('Form with File Template')
            .fileLayer('pdf', { mimeType: 'application/pdf', path: './template.pdf' })
            .defaultLayer('pdf')
            .build()
          expect(result.layers).toBeDefined()
          expect(result.layers?.pdf?.kind).toBe('file')
          if (result.layers?.pdf?.kind === 'file') {
            expect(result.layers.pdf.path).toBe('./template.pdf')
          }
        })

        test('builds form with single annex using annex()', () => {
          const result = form()
            .name('form-with-annex')
            .version('1.0.0')
            .title('Form with Annex')
            .annex('terms', { title: 'Terms and Conditions' })
            .build()
          expect(Object.keys(result.annexes || {})).toHaveLength(1)
          // Note: singular .annex() doesn't track types; cast to access
          const annexes = result.annexes as unknown as Record<string, { title: string }>
          expect(annexes.terms?.title).toBe('Terms and Conditions')
        })

        test('builds form with multiple annexes using annex()', () => {
          const result = form()
            .name('form-with-annexes')
            .version('1.0.0')
            .title('Form with Annexes')
            .annex('terms', { title: 'Terms and Conditions' })
            .annex('privacy', { title: 'Privacy Policy' })
            .build()
          expect(Object.keys(result.annexes || {})).toHaveLength(2)
        })

        test('builds form with annexes using annexes()', () => {
          const result = form()
            .name('form-with-bulk-annexes')
            .version('1.0.0')
            .title('Form with Bulk Annexes')
            .annexes({
              terms: { title: 'Terms and Conditions' },
              privacy: { title: 'Privacy Policy' },
            })
            .build()
          expect(Object.keys(result.annexes || {})).toHaveLength(2)
        })

        test('builds form with description', () => {
          const result = form()
            .name('described-form')
            .version('1.0.0')
            .title('Described Form')
            .description('This is a detailed description.')
            .build()
          expect(result.description).toBe('This is a detailed description.')
        })

        test('builds form with code', () => {
          const result = form()
            .name('coded-form')
            .version('1.0.0')
            .title('Coded Form')
            .code('FORM-001')
            .build()
          expect(result.code).toBe('FORM-001')
        })

        test('builds form with source language', () => {
          const result = form()
            .name('spanish-form')
            .version('1.0.0')
            .title('Spanish Form')
            .language('es')
            .build()
          expect(result.language).toBe('es')
        })

        test('builds form with metadata', () => {
          const result = form()
            .name('metadata-form')
            .version('1.0.0')
            .title('Metadata Form')
            .metadata({ version: '1.0', author: 'John Doe', category: 'HR' })
            .build()
          expect(result.metadata?.version).toBe('1.0')
          expect(result.metadata?.author).toBe('John Doe')
        })

        test('builds form with inline instructions', () => {
          const result = form()
            .name('form-inline-instructions')
            .version('1.0.0')
            .title('Form with Inline Instructions')
            .instructions({
              kind: 'inline',
              text: 'Complete all fields before submitting. Refer to IRS Publication 15 for guidance.',
            })
            .build()
          expect(result.instructions?.kind).toBe('inline')
          if (result.instructions?.kind === 'inline') {
            expect(result.instructions.text).toContain('IRS Publication 15')
          }
        })

        test('builds form with file instructions', () => {
          const result = form()
            .name('form-file-instructions')
            .version('1.0.0')
            .title('Form with File Instructions')
            .instructions({
              kind: 'file',
              path: './instructions/w9-instructions.pdf',
              mimeType: 'application/pdf',
              title: 'W-9 Instructions',
              description: 'Official IRS instructions for Form W-9',
              checksum: 'sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
            })
            .build()
          expect(result.instructions?.kind).toBe('file')
          if (result.instructions?.kind === 'file') {
            expect(result.instructions.path).toBe('./instructions/w9-instructions.pdf')
            expect(result.instructions.mimeType).toBe('application/pdf')
            expect(result.instructions.title).toBe('W-9 Instructions')
            expect(result.instructions.checksum).toMatch(/^sha256:[a-f0-9]{64}$/)
          }
        })

        test('builds form with inline agentInstructions', () => {
          const result = form()
            .name('form-inline-agent')
            .version('1.0.0')
            .title('Form with Agent Instructions')
            .agentInstructions({
              kind: 'inline',
              text: 'Ask for SSN first, then name. Group address fields together. Use formal tone.',
            })
            .build()
          expect(result.agentInstructions?.kind).toBe('inline')
          if (result.agentInstructions?.kind === 'inline') {
            expect(result.agentInstructions.text).toContain('formal tone')
          }
        })

        test('builds form with file agentInstructions', () => {
          const result = form()
            .name('form-file-agent')
            .version('1.0.0')
            .title('Form with File Agent Instructions')
            .agentInstructions({
              kind: 'file',
              path: './prompts/agent-guide.md',
              mimeType: 'text/markdown',
            })
            .build()
          expect(result.agentInstructions?.kind).toBe('file')
          if (result.agentInstructions?.kind === 'file') {
            expect(result.agentInstructions.path).toBe('./prompts/agent-guide.md')
            expect(result.agentInstructions.mimeType).toBe('text/markdown')
          }
        })

        test('builds form with both instructions and agentInstructions', () => {
          const result = form()
            .name('form-both-instructions')
            .version('1.0.0')
            .title('Form with Both Instruction Types')
            .instructions({
              kind: 'file',
              path: './instructions/regulatory-guide.pdf',
              mimeType: 'application/pdf',
            })
            .agentInstructions({
              kind: 'inline',
              text: 'Present fields in order: identification, contact, financial.',
            })
            .build()
          expect(result.instructions?.kind).toBe('file')
          expect(result.agentInstructions?.kind).toBe('inline')
        })

        test('builds form with all properties (except releaseDate)', () => {
          const result = form()
            .name('complete-form')
            .version('1.0.0')
            .title('Complete Form')
            .description('A fully configured form')
            .code('COMPLETE-001')
            .metadata({ version: '1.0', author: 'Jane Smith' })
            .fields({
              name: { type: 'text', label: 'Name', required: true },
              email: { type: 'email', label: 'Email', required: true },
            })
            .inlineLayer('default', { mimeType: 'text/markdown', text: '# Instructions\n\nComplete all required fields.' })
            .defaultLayer('default')
            .annexes({ guide: { title: 'User Guide' } })
            .build()
          expect(result.name).toBe('complete-form')
          expect(result.title).toBe('Complete Form')
          expect(result.description).toBe('A fully configured form')
          expect(result.code).toBe('COMPLETE-001')
          expect(result.metadata?.version).toBe('1.0')
          expect(Object.keys(result.fields || {})).toHaveLength(2)
          expect(result.layers).toBeDefined()
          expect(result.layers?.default?.kind).toBe('inline')
          expect(Object.keys(result.annexes || {})).toHaveLength(1)
        })

        test('supports method chaining', () => {
          const result = form()
            .name('chained')
            .version('1.0.0')
            .title('Chained Form')
            .description('Description')
            .code('CODE-001')
            .build()
          expect(result.name).toBe('chained')
          expect(result.title).toBe('Chained Form')
        })

        test('allows overwriting name', () => {
          const result = form().name('original').version('1.0.0').name('updated').title('Test').build()
          expect(result.name).toBe('updated')
        })

        test('allows overwriting title', () => {
          const result = form().name('test').version('1.0.0').title('Original').title('Updated').build()
          expect(result.title).toBe('Updated')
        })

        test('allows overwriting description', () => {
          const result = form()
            .name('test')
            .version('1.0.0')
            .title('Test')
            .description('Original')
            .description('Updated')
            .build()
          expect(result.description).toBe('Updated')
        })

        test('field() is overwritten by fields()', () => {
          const result = form()
            .name('mixed')
            .version('1.0.0')
            .title('Mixed')
            .field('field1', { type: 'text', label: 'Field 1' })
            .fields({
              field2: { type: 'number', label: 'Field 2' },
              field3: { type: 'boolean', label: 'Field 3' },
            })
            .field('field4', { type: 'email', label: 'Field 4' })
            .build()
          expect(Object.keys(result.fields || {})).toHaveLength(3)
          const fields = result.fields as any
          expect(fields.field2).toBeDefined()
          expect(fields.field3).toBeDefined()
          expect(fields.field4).toBeDefined()
        })

        test('annexes() overwrites previous annexes', () => {
          const result = form()
            .name('mixed-annexes')
            .version('1.0.0')
            .title('Mixed Annexes')
            .annex('annex1', { title: 'Annex 1' })
            .annexes({ annex2: { title: 'Annex 2' } })
            .annex('annex3', { title: 'Annex 3' })
            .build()
          expect(Object.keys(result.annexes || {})).toHaveLength(2)
          // Note: singular .annex() after .annexes() adds at runtime but not in types
          const annexes = result.annexes as Record<string, { title: string }>
          expect(annexes.annex2).toBeDefined()
          expect(annexes.annex3).toBeDefined()
        })

        test('builds form with valid name patterns', () => {
          const validNames = [
            'simple',
            'with-dash',
            'PascalCase',
            'camelCase',
            'with-multiple-dashes',
            '123numeric',
            'abc123def',
            'a',
            'A',
            '1',
          ]

          for (const name of validNames) {
            const result = form().name(name).version('1.0.0').title('Test').build()
            expect(result.name).toBe(name)
          }
        })

        test('builds form with long valid name', () => {
          const result = form().name('a'.repeat(128)).version('1.0.0').title('Test').build()
          expect(result.name).toHaveLength(128)
        })

        test('builds form with long valid title', () => {
          const result = form().name('test').version('1.0.0').title('T'.repeat(200)).build()
          expect(result.title).toHaveLength(200)
        })

        test('builds form with long valid description', () => {
          const result = form().name('test').version('1.0.0').title('Test').description('D'.repeat(2000)).build()
          expect(result.description).toHaveLength(2000)
        })

        test('builds form with many fields', () => {
          const builder = form().name('many-fields').version('1.0.0').title('Many Fields')
          for (let i = 0; i < 50; i++) {
            builder.field(`field${i}`, { type: 'text', label: `Field ${i}` })
          }
          const result = builder.build()
          expect(Object.keys(result.fields || {})).toHaveLength(50)
        })
      })

      describe('validation failures on build()', () => {
        test('throws error when name is empty string', () => {
          expect(() => form().name('').version('1.0.0').title('Test').build()).toThrow()
        })

        test('throws error when title is empty string', () => {
          expect(() => form().name('test').version('1.0.0').title('').build()).toThrow()
        })

        test('throws error when name exceeds maxLength', () => {
          expect(() => form().name('a'.repeat(129)).version('1.0.0').title('Test').build()).toThrow()
        })

        test('throws error when title exceeds maxLength', () => {
          expect(() => form().name('test').version('1.0.0').title('T'.repeat(201)).build()).toThrow()
        })

        test('throws error when description exceeds maxLength', () => {
          expect(() =>
            form().name('test').version('1.0.0').title('Test').description('D'.repeat(2001)).build()
          ).toThrow()
        })

        test('throws error when code is empty string', () => {
          expect(() => form().name('test').version('1.0.0').title('Test').code('').build()).toThrow()
        })

        test('throws error when language has invalid format', () => {
          expect(() => form().name('test').version('1.0.0').title('Test').language('english').build()).toThrow()
        })

        test('throws error when name has invalid pattern (starts with dash)', () => {
          expect(() => form().name('-invalid').version('1.0.0').title('Test').build()).toThrow()
        })

        test('throws error when name has invalid pattern (ends with dash)', () => {
          expect(() => form().name('invalid-').version('1.0.0').title('Test').build()).toThrow()
        })

        test('throws error when name has invalid pattern (consecutive dashes)', () => {
          expect(() => form().name('invalid--name').version('1.0.0').title('Test').build()).toThrow()
        })

        test('throws error when name has invalid pattern (underscore)', () => {
          expect(() => form().name('invalid_name').version('1.0.0').title('Test').build()).toThrow()
        })

        test('throws error when name has invalid pattern (special chars)', () => {
          expect(() => form().name('invalid@name').version('1.0.0').title('Test').build()).toThrow()
        })

        test('throws error when releaseDate has invalid format', () => {
          expect(() =>
            form().name('test').version('1.0.0').title('Test').releaseDate('invalid-date').build()
          ).toThrow()
        })

        test('throws error when field definition is invalid', () => {
          expect(() =>
            form()
              .name('test')
              .version('1.0.0')
              .title('Test')
              .field('invalid', { type: 'invalid-type' } as any)
              .build()
          ).toThrow()
        })

        test('throws error when annex is invalid', () => {
          expect(() =>
            form()
              .name('test')
              .version('1.0.0')
              .title('Test')
              .annex('valid-id', { description: '' } as any) // empty description should fail
              .build()
          ).toThrow()
        })

        test('throws error when template is invalid', () => {
          expect(() =>
            form()
              .name('test')
              .version('1.0.0')
              .title('Test')
              .layer('default', { kind: 'inline', mimeType: 'text/plain', text: '' })
              .build()
          ).toThrow()
        })
      })

      describe('builder instance behavior', () => {
        test('returns builder instance when called with no arguments', () => {
          const builder = form()
          expect(builder).toBeDefined()
          expect(typeof builder.name).toBe('function')
          expect(typeof builder.title).toBe('function')
          expect(typeof builder.field).toBe('function')
          expect(typeof builder.fields).toBe('function')
          expect(typeof builder.build).toBe('function')
        })

        test('builder methods return this for chaining', () => {
          const builder = form()
          const afterName = builder.name('test').version('1.0.0')
          const afterTitle = afterName.title('Test')
          expect(afterName).toBe(builder)
          expect(afterTitle).toBe(builder)
        })

        test('multiple builders are independent', () => {
          const builder1 = form().name('form1').version('1.0.0').title('Form 1')
          const builder2 = form().name('form2').version('1.0.0').title('Form 2')
          expect(builder1.build().name).toBe('form1')
          expect(builder2.build().name).toBe('form2')
        })

        test('builder can be reused after build', () => {
          const builder = form().name('test').version('1.0.0').title('Test')
          const result1 = builder.build()
          const result2 = builder.build()
          // Compare form definitions (instances have different function references)
          expect(result1._data).toEqual(result2._data)
          expect(result1.name).toEqual(result2.name)
          expect(result1.version).toEqual(result2.version)
          expect(result1.title).toEqual(result2.title)
        })

        test('modifying builder after build affects subsequent builds', () => {
          const builder = form().name('original').version('1.0.0').title('Original')
          const result1 = builder.build()
          builder.name('modified')
          const result2 = builder.build()
          expect(result1.name).toBe('original')
          expect(result2.name).toBe('modified')
        })
      })

      describe('builder pattern vs object pattern comparison', () => {
        test('builder pattern produces equivalent result as object pattern', () => {
          const builderResult = form()
            .name('test-form')
            .version('1.0.0')
            .title('Test Form')
            .description('Description')
            .fields({ name: { type: 'text', label: 'Name' } })
            .build()

          const objectResult = form({
            kind: 'form',
            version: '1.0.0',
            name: 'test-form',
            title: 'Test Form',
            description: 'Description',
            fields: { name: { type: 'text', label: 'Name' } },
          })

          expect(builderResult.kind).toEqual(objectResult.kind)
          expect(builderResult.name).toEqual(objectResult.name)
          expect(builderResult.title).toEqual(objectResult.title)
          expect(builderResult.description).toEqual(objectResult.description)
          expect(builderResult.fields).toEqual(objectResult.fields)
        })

        test('builder validates on build(), object validates immediately', () => {
          const builder = form().name('test').title('')
          expect(() => builder.build()).toThrow()

          expect(() =>
            form({
              kind: 'form',
              name: 'test',
              title: '',
            } as any)
          ).toThrow()
        })
      })

      describe('common usage patterns', () => {
        test('creates contact form', () => {
          const result = form()
            .name('contact-form')
            .version('1.0.0')
            .title('Contact Us')
            .description('Get in touch with our team')
            .fields({
              name: { type: 'text', label: 'Full Name', required: true },
              email: { type: 'email', label: 'Email Address', required: true },
              message: { type: 'text', label: 'Message', required: true },
            })
            .build()

          expect(result.name).toBe('contact-form')
          expect(Object.keys(result.fields || {})).toHaveLength(3)
        })

        test('creates lease agreement form with layers and annexes', () => {
          const result = form()
            .name('lease-agreement')
            .version('1.0.0')
            .title('Residential Lease Agreement')
            .code('LEASE-2024')
            .inlineLayer('default', { mimeType: 'text/markdown', text: '# Lease Agreement\n\nPlease review and complete the following.' })
            .defaultLayer('default')
            .fields({
              tenantName: { type: 'text', label: 'Tenant Name', required: true },
              rentAmount: { type: 'money', label: 'Monthly Rent', required: true },
            })
            .annex('terms', { title: 'Terms and Conditions' })
            .annex('rules', { title: 'House Rules' })
            .build()

          expect(result.name).toBe('lease-agreement')
          expect(result.layers).toBeDefined()
          expect(result.layers?.default?.kind).toBe('inline')
          expect(Object.keys(result.annexes || {})).toHaveLength(2)
        })

        test('creates employee onboarding form with nested fieldsets', () => {
          const result = form()
            .name('employee-onboarding')
            .version('1.0.0')
            .title('Employee Onboarding Form')
            .description('Complete this form for new employee setup')
            .field('personal', {
              type: 'fieldset',
              label: 'Personal Information',
              fields: {
                firstName: { type: 'text', label: 'First Name', required: true },
                lastName: { type: 'text', label: 'Last Name', required: true },
                email: { type: 'email', label: 'Email', required: true },
                phone: { type: 'phone', label: 'Phone Number' },
              },
            })
            .field('address', {
              type: 'fieldset',
              label: 'Address',
              fields: {
                street: { type: 'text', label: 'Street Address', required: true },
                city: { type: 'text', label: 'City', required: true },
                state: { type: 'text', label: 'State', required: true },
                zip: { type: 'text', label: 'ZIP Code', required: true },
              },
            })
            .build()

          expect(result.fields).toBeDefined()
          const fields = result.fields as any
          expect(fields.personal.type).toBe('fieldset')
          expect(fields.address.type).toBe('fieldset')
        })
      })
    })
  })
})
