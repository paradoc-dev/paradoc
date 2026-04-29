import { describe, test, expect } from 'vitest'
import { bundle, document, form } from '@/artifacts'
import type { Bundle, BundleContentItem } from '@paradoc/types'

describe('Bundle', () => {
  // ============================================================================
  // Object Pattern Tests
  // ============================================================================

  describe('Object Pattern', () => {
    describe('bundle() - direct validation', () => {
      describe('success cases', () => {
        test('creates valid bundle with minimal required properties', () => {
          const input: Bundle = {
            kind: 'bundle',
            version: '1.0.0',
            name: 'rental-package',
            title: 'Rental Package',
            contents: [],
          }
          const result = bundle(input)
          expect(result.kind).toBe('bundle')
          expect(result.name).toBe('rental-package')
          expect(result.title).toBe('Rental Package')
        })

        test('creates bundle with inline document', () => {
          const input: Bundle = {
            kind: 'bundle',
            version: '1.0.0',
            name: 'disclosure-bundle',
            title: 'Disclosure Bundle',
            contents: [
              {
                type: 'inline',
                key: 'privacy',
                artifact: {
                  kind: 'document',
                  version: '1.0.0',
                  name: 'privacy-policy',
                  title: 'Privacy Policy',
                },
              },
            ],
          }
          const result = bundle(input)
          expect(result.contents).toHaveLength(1)
          expect(result.contents[0]?.type).toBe('inline')
        })

        test('creates bundle with registry reference', () => {
          const input: Bundle = {
            kind: 'bundle',
            version: '1.0.0',
            name: 'form-bundle',
            title: 'Form Bundle',
            contents: [
              {
                type: 'registry',
                key: 'lease',
                slug: '@company/lease-agreement',
              },
            ],
          }
          const result = bundle(input)
          expect(result.contents).toHaveLength(1)
          const item = result.contents[0] as BundleContentItem & { type: 'registry' }
          expect(item.slug).toBe('@company/lease-agreement')
        })

        test('creates bundle with path reference', () => {
          const input: Bundle = {
            kind: 'bundle',
            version: '1.0.0',
            name: 'local-bundle',
            title: 'Local Bundle',
            contents: [
              {
                type: 'path',
                key: 'terms',
                path: '/artifacts/terms.yaml',
              },
            ],
          }
          const result = bundle(input)
          expect(result.contents).toHaveLength(1)
          const item = result.contents[0] as BundleContentItem & { type: 'path' }
          expect(item.path).toBe('/artifacts/terms.yaml')
        })

        test('creates bundle with include condition', () => {
          const input: Bundle = {
            kind: 'bundle',
            version: '1.0.0',
            name: 'conditional-bundle',
            title: 'Conditional Bundle',
            defs: {
              hasPets: { type: 'boolean', value: 'true' },
            },
            contents: [
              {
                type: 'registry',
                key: 'pet-addendum',
                slug: '@company/pet-addendum',
                include: 'hasPets',
              },
            ],
          }
          const result = bundle(input)
          const item = result.contents[0] as BundleContentItem & { type: 'registry' }
          expect(item.include).toBe('hasPets')
        })

        test('creates bundle with logic section', () => {
          const input: Bundle = {
            kind: 'bundle',
            version: '1.0.0',
            name: 'logic-bundle',
            title: 'Logic Bundle',
            defs: {
              isActive: { type: 'boolean', value: 'true' },
              showExtra: { type: 'boolean', value: 'isActive == true' },
            },
            contents: [],
          }
          const result = bundle(input)
          expect(result.defs?.isActive).toEqual({ type: 'boolean', value: 'true' })
          expect(result.defs?.showExtra).toEqual({ type: 'boolean', value: 'isActive == true' })
        })

        test('creates bundle with nested bundle', () => {
          const input: Bundle = {
            kind: 'bundle',
            version: '1.0.0',
            name: 'outer-bundle',
            title: 'Outer Bundle',
            contents: [
              {
                type: 'inline',
                key: 'inner',
                artifact: {
                  kind: 'bundle',
                  version: '1.0.0',
                  name: 'inner-bundle',
                  title: 'Inner Bundle',
                  contents: [],
                },
              },
            ],
          }
          const result = bundle(input)
          expect(result.contents).toHaveLength(1)
          const item = result.contents[0] as BundleContentItem & { type: 'inline' }
          expect(item.artifact.kind).toBe('bundle')
        })

        test('creates bundle with description', () => {
          const input: Bundle = {
            kind: 'bundle',
            version: '1.0.0',
            name: 'described-bundle',
            title: 'Described Bundle',
            description: 'A bundle with a description',
            contents: [],
          }
          const result = bundle(input)
          expect(result.description).toBe('A bundle with a description')
        })

        test('creates bundle with code', () => {
          const input: Bundle = {
            kind: 'bundle',
            version: '1.0.0',
            name: 'coded-bundle',
            title: 'Coded Bundle',
            code: 'BUN-001',
            contents: [],
          }
          const result = bundle(input)
          expect(result.code).toBe('BUN-001')
        })

        test('creates bundle with metadata', () => {
          const input: Bundle = {
            kind: 'bundle',
            version: '1.0.0',
            name: 'metadata-bundle',
            title: 'Metadata Bundle',
            metadata: {
              author: 'Test',
              category: 'Rental',
            },
            contents: [],
          }
          const result = bundle(input)
          expect(result.metadata?.author).toBe('Test')
        })

        test('creates bundle with mixed content types', () => {
          const input: Bundle = {
            kind: 'bundle',
            version: '1.0.0',
            name: 'mixed-bundle',
            title: 'Mixed Bundle',
            contents: [
              {
                type: 'inline',
                key: 'doc',
                artifact: {
                  kind: 'document',
                  version: '1.0.0',
                  name: 'doc',
                  title: 'Doc',
                },
              },
              {
                type: 'registry',
                key: 'ext',
                slug: '@org/form',
              },
              {
                type: 'path',
                key: 'local',
                path: '/local/artifact.yaml',
              },
            ],
          }
          const result = bundle(input)
          expect(result.contents).toHaveLength(3)
        })
      })

      describe('validation failures', () => {
        test('throws error when name is missing', () => {
          const input = {
            kind: 'bundle',
            version: '1.0.0',
            title: 'Test',
            contents: [],
          } as any
          expect(() => bundle(input)).toThrow()
        })

        test('throws error when contents is missing', () => {
          const input = {
            kind: 'bundle',
            version: '1.0.0',
            name: 'test',
            title: 'Test',
          } as any
          expect(() => bundle(input)).toThrow()
        })

        test('throws error when name is empty string', () => {
          const input = {
            kind: 'bundle',
            version: '1.0.0',
            name: '',
            title: 'Test',
            contents: [],
          } as any
          expect(() => bundle(input)).toThrow()
        })

        test('throws error when name has invalid pattern', () => {
          const input = {
            kind: 'bundle',
            version: '1.0.0',
            name: '-invalid',
            title: 'Test',
            contents: [],
          } as any
          expect(() => bundle(input)).toThrow()
        })
      })
    })

    describe('bundle.safeFrom()', () => {
      test('returns success for valid bundle', () => {
        const input = {
          kind: 'bundle',
          version: '1.0.0',
          name: 'test-bundle',
          title: 'Test Bundle',
          contents: [],
        }
        const result = bundle.safeFrom(input)
        expect(result.success).toBe(true)
      })

      test('returns error for invalid input', () => {
        const result = bundle.safeFrom({})
        expect(result.success).toBe(false)
      })
    })
  })

  // ============================================================================
  // Builder Pattern Tests
  // ============================================================================

  describe('Builder Pattern', () => {
    describe('fluent builder API', () => {
      describe('success cases', () => {
        test('builds valid bundle with minimal required properties', () => {
          const result = bundle()
            .name('rental-package')
            .version('1.0.0')
            .title('Rental Package')
            .build()
          expect(result.kind).toBe('bundle')
          expect(result.name).toBe('rental-package')
          expect(result.title).toBe('Rental Package')
          expect(result.contents).toEqual([])
        })

        test('builds bundle with inline document', () => {
          const result = bundle()
            .name('disclosure-bundle')
            .version('1.0.0')
            .title('Disclosure Bundle')
            .inline(
              'privacy',
              document()
                .name('privacy-policy')
                .version('1.0.0')
                .title('Privacy Policy')
                .build()
            )
            .build()
          expect(result.contents).toHaveLength(1)
          expect(result.contents[0]?.type).toBe('inline')
        })

        test('builds bundle with inline form', () => {
          const result = bundle()
            .name('form-bundle')
            .version('1.0.0')
            .title('Form Bundle')
            .inline(
              'contact',
              form()
                .name('contact-form')
                .version('1.0.0')
                .title('Contact Form')
                .build()
            )
            .build()
          expect(result.contents).toHaveLength(1)
          const item = result.contents[0] as any
          expect(item.artifact.kind).toBe('form')
        })

        test('builds bundle with registry reference', () => {
          const result = bundle()
            .name('ext-bundle')
            .version('1.0.0')
            .title('External Bundle')
            .registry('lease', '@company/lease-agreement')
            .build()
          expect(result.contents).toHaveLength(1)
          const item = result.contents[0] as any
          expect(item.type).toBe('registry')
          expect(item.slug).toBe('@company/lease-agreement')
        })

        test('builds bundle with registry reference and include condition', () => {
          const result = bundle()
            .name('conditional-bundle')
            .version('1.0.0')
            .title('Conditional Bundle')
            .def('hasPets', 'true')
            .registry('pet-addendum', '@company/pet-addendum', 'hasPets')
            .build()
          const item = result.contents[0] as any
          expect(item.include).toBe('hasPets')
        })

        test('builds bundle with path reference', () => {
          const result = bundle()
            .name('local-bundle')
            .version('1.0.0')
            .title('Local Bundle')
            .path('terms', '/artifacts/terms.yaml')
            .build()
          expect(result.contents).toHaveLength(1)
          const item = result.contents[0] as any
          expect(item.type).toBe('path')
          expect(item.path).toBe('/artifacts/terms.yaml')
        })

        test('builds bundle with path reference and include condition', () => {
          const result = bundle()
            .name('conditional-path-bundle')
            .version('1.0.0')
            .title('Conditional Path Bundle')
            .path('optional', '/artifacts/optional.yaml', 'includeOptional')
            .build()
          const item = result.contents[0] as any
          expect(item.include).toBe('includeOptional')
        })

        test('builds bundle with logic section', () => {
          const result = bundle()
            .name('logic-bundle')
            .version('1.0.0')
            .title('Logic Bundle')
            .defs({
              isActive: { type: 'boolean', value: 'true' },
              showExtra: { type: 'boolean', value: 'isActive == true' },
            })
            .build()
          expect(result.defs?.isActive).toEqual({ type: 'boolean', value: 'true' })
          expect(result.defs?.showExtra).toEqual({ type: 'boolean', value: 'isActive == true' })
        })

        test('builds bundle with expr() for individual expressions', () => {
          const result = bundle()
            .name('expr-bundle')
            .version('1.0.0')
            .title('Expr Bundle')
            .def('isActive', 'true')
            .def('showForm', 'isActive')
            .build()
          expect(result.defs?.isActive).toEqual({ type: 'boolean', value: 'true' })
          expect(result.defs?.showForm).toEqual({ type: 'boolean', value: 'isActive' })
        })

        test('builds bundle with nested bundle', () => {
          const result = bundle()
            .name('outer')
            .version('1.0.0')
            .title('Outer Bundle')
            .inline(
              'inner',
              bundle()
                .name('inner')
                .version('1.0.0')
                .title('Inner Bundle')
                .build()
            )
            .build()
          const item = result.contents[0] as any
          expect(item.artifact.kind).toBe('bundle')
          expect(item.artifact.name).toBe('inner')
        })

        test('builds bundle with description', () => {
          const result = bundle()
            .name('described-bundle')
            .version('1.0.0')
            .title('Described Bundle')
            .description('A bundle with a description')
            .build()
          expect(result.description).toBe('A bundle with a description')
        })

        test('builds bundle with code', () => {
          const result = bundle()
            .name('coded-bundle')
            .version('1.0.0')
            .title('Coded Bundle')
            .code('BUN-001')
            .build()
          expect(result.code).toBe('BUN-001')
        })

        test('builds bundle with metadata', () => {
          const result = bundle()
            .name('metadata-bundle')
            .version('1.0.0')
            .title('Metadata Bundle')
            .metadata({ author: 'Test' })
            .build()
          expect(result.metadata?.author).toBe('Test')
        })

        test('builds bundle with mixed content types', () => {
          const result = bundle()
            .name('mixed-bundle')
            .version('1.0.0')
            .title('Mixed Bundle')
            .inline(
              'doc',
              document().name('doc').version('1.0.0').title('Doc').build()
            )
            .registry('ext', '@org/form')
            .path('local', '/path/to/artifact.yaml')
            .build()
          expect(result.contents).toHaveLength(3)
        })

        test('builds bundle with all properties', () => {
          const result = bundle()
            .name('complete-bundle')
            .version('1.0.0')
            .title('Complete Bundle')
            .description('A fully configured bundle')
            .code('BUN-001')
            .metadata({ author: 'Test' })
            .defs({ isActive: { type: 'boolean', value: 'true' } })
            .inline(
              'doc',
              document().name('doc').version('1.0.0').title('Doc').build()
            )
            .build()
          expect(result.name).toBe('complete-bundle')
          expect(result.description).toBe('A fully configured bundle')
          expect(result.code).toBe('BUN-001')
          expect(result.defs?.isActive).toEqual({ type: 'boolean', value: 'true' })
          expect(result.contents).toHaveLength(1)
        })

        test('supports method chaining', () => {
          const result = bundle()
            .name('chained')
            .version('1.0.0')
            .title('Chained Bundle')
            .description('Description')
            .code('CODE-001')
            .build()
          expect(result.name).toBe('chained')
          expect(result.title).toBe('Chained Bundle')
        })
      })

      describe('validation failures on build()', () => {
        test('throws error when name is empty string', () => {
          expect(() =>
            bundle()
              .name('')
              .version('1.0.0')
              .title('Test')
              .build()
          ).toThrow()
        })

        test('throws error when title is empty string', () => {
          expect(() =>
            bundle()
              .name('test')
              .version('1.0.0')
              .title('')
              .build()
          ).toThrow()
        })

        test('throws error when name has invalid pattern', () => {
          expect(() =>
            bundle()
              .name('-invalid')
              .version('1.0.0')
              .title('Test')
              .build()
          ).toThrow()
        })
      })

      describe('builder instance behavior', () => {
        test('returns builder instance when called with no arguments', () => {
          const builder = bundle()
          expect(builder).toBeDefined()
          expect(typeof builder.name).toBe('function')
          expect(typeof builder.title).toBe('function')
          expect(typeof builder.inline).toBe('function')
          expect(typeof builder.registry).toBe('function')
          expect(typeof builder.path).toBe('function')
          expect(typeof builder.defs).toBe('function')
          expect(typeof builder.def).toBe('function')
          expect(typeof builder.build).toBe('function')
        })

        test('builder methods return this for chaining', () => {
          const builder = bundle()
          const afterName = builder.name('test').version('1.0.0')
          const afterTitle = afterName.title('Test')
          expect(afterName).toBe(builder)
          expect(afterTitle).toBe(builder)
        })

        test('multiple builders are independent', () => {
          const builder1 = bundle().name('bundle1').version('1.0.0').title('Bundle 1')
          const builder2 = bundle().name('bundle2').version('1.0.0').title('Bundle 2')
          expect(builder1.build().name).toBe('bundle1')
          expect(builder2.build().name).toBe('bundle2')
        })
      })

      describe('common usage patterns', () => {
        test('creates rental package bundle', () => {
          const result = bundle()
            .name('rental-package')
            .version('1.0.0')
            .title('Rental Package')
            .description('Complete rental application package')
            .def('hasPets', 'true')
            .def('hasVehicle', 'false')
            .inline(
              'disclosure',
              document()
                .name('disclosure')
                .version('1.0.0')
                .title('Rental Disclosure')
                .inlineLayer('default', { mimeType: 'text/markdown', text: '# Rental Disclosure' })
                .build()
            )
            .registry('lease', '@company/lease-agreement')
            .registry('pet-addendum', '@company/pet-addendum', 'hasPets')
            .registry('parking-addendum', '@company/parking-addendum', 'hasVehicle')
            .build()

          expect(result.name).toBe('rental-package')
          expect(result.defs?.hasPets).toEqual({ type: 'boolean', value: 'true' })
          expect(result.contents).toHaveLength(4)
        })

        test('creates nested bundle structure', () => {
          const innerBundle = bundle()
            .name('disclosures')
            .version('1.0.0')
            .title('Required Disclosures')
            .inline(
              'privacy',
              document().name('privacy').version('1.0.0').title('Privacy Policy').build()
            )
            .inline(
              'terms',
              document().name('terms').version('1.0.0').title('Terms of Service').build()
            )
            .build()

          const result = bundle()
            .name('main-package')
            .version('1.0.0')
            .title('Main Package')
            .inline('disclosures', innerBundle)
            .registry('main-form', '@company/main-form')
            .build()

          expect(result.contents).toHaveLength(2)
          const disclosures = result.contents[0] as any
          expect(disclosures.artifact.contents).toHaveLength(2)
        })
      })
    })
  })
})
