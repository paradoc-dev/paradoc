import type { textRenderer } from '@paradoc/sdk'
import type { ProxyTextRendererConfig } from './config'

type TextRenderer = ReturnType<typeof textRenderer>

/**
 * Create a proxy text renderer that delegates Handlebars compilation
 * to an HTTP service. Avoids `new Function()` restrictions on edge runtimes.
 */
export function proxyTextRenderer(
  config: ProxyTextRendererConfig,
  customFetch?: typeof globalThis.fetch,
): TextRenderer {
  const fetchFn = customFetch ?? globalThis.fetch

  return {
    id: 'proxy-text',
    async render(request): Promise<string> {
      let dataRecord: Record<string, unknown>

      if ('fields' in request.data) {
        const { fields, parties, annexes, defs, ...rest } = request.data as {
          fields?: Record<string, unknown>
          parties?: Record<string, unknown>
          annexes?: Record<string, unknown>
          defs?: Record<string, unknown>
        }

        const fieldsObj = fields as Record<string, unknown> | undefined
        const actualAnnexes = annexes ?? (fieldsObj?.annexes as Record<string, unknown> | undefined)
        const actualParties = parties ?? (fieldsObj?.parties as Record<string, unknown> | undefined)
        const actualDefs = defs ?? (fieldsObj?.defs as Record<string, unknown> | undefined)

        const cleanFields = fieldsObj ? { ...fieldsObj } : undefined
        if (cleanFields) {
          delete cleanFields.annexes
          delete cleanFields.parties
          delete cleanFields.defs
        }

        dataRecord = {
          ...cleanFields,
          ...(actualParties && { parties: actualParties }),
          ...(actualAnnexes && { annexes: actualAnnexes }),
          ...(actualDefs && { defs: actualDefs }),
          ...rest,
        }
      } else {
        dataRecord = request.data as Record<string, unknown>
      }

      const bindings = request.bindings || request.template.bindings

      const body = {
        type: 'text' as const,
        template: request.template.content,
        data: dataRecord,
        form: request.form,
        bindings,
      }

      const res = await fetchFn(`${config.url}/render`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify(body),
      })

      const result = (await res.json()) as { success: boolean; content?: string; error?: string }

      if (!result.success) {
        throw new Error(result.error ?? `Proxy render failed with status ${res.status}`)
      }

      if (result.content == null) {
        throw new Error('Proxy render returned success but no content')
      }

      return result.content
    },
  }
}
