import { describe, expect, test } from 'vitest'
import { parseArtifact, toYAML } from '@/index'

describe('parseArtifact', () => {
  const artifacts = [
    {
      kind: 'form',
      name: 'test-form',
      version: '1.0.0',
      title: 'Test Form',
      fields: {
        name: { type: 'text', label: 'Name' },
      },
    },
    {
      kind: 'document',
      name: 'test-document',
      version: '1.0.0',
      title: 'Test Document',
      layers: {
        default: {
          kind: 'inline',
          mimeType: 'text/plain',
          text: 'Hello World',
        },
      },
    },
    {
      kind: 'checklist',
      name: 'test-checklist',
      version: '1.0.0',
      title: 'Test Checklist',
      items: [
        {
          id: 'item1',
          title: 'First Item',
        },
      ],
    },
    {
      kind: 'bundle',
      name: 'test-bundle',
      version: '1.0.0',
      title: 'Test Bundle',
      contents: [],
    },
  ] as const

  test.each(artifacts)('parses a JSON $kind artifact', (artifact) => {
    const parsed = parseArtifact(JSON.stringify(artifact))

    expect(parsed).toMatchObject({ kind: artifact.kind, name: artifact.name })
  })

  test.each(artifacts)('parses a YAML $kind artifact', (artifact) => {
    const yaml = toYAML(artifact, { includeSchema: false })

    const parsed = parseArtifact(yaml)

    expect(parsed).toMatchObject({ kind: artifact.kind, name: artifact.name })
  })

  test('reports readable validation issues with their paths', () => {
    let error: unknown
    try {
      parseArtifact(
        JSON.stringify({
          kind: 'form',
          name: 'invalid-form',
          version: '1.0.0',
          title: 'Invalid Form',
          fields: {
            broken: { type: 'unknown', label: 'Broken' },
          },
        }),
      )
    } catch (caught) {
      error = caught
    }

    expect(error).toBeInstanceOf(Error)
    expect((error as Error).message).toContain('broken')
    expect((error as Error).message).not.toContain('[object Object]')
  })

  test('reports malformed serialized content clearly', () => {
    expect(() => parseArtifact('{ invalid json')).toThrow(
      /Invalid artifact: Unable to detect format/,
    )
  })
})
