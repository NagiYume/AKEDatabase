import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const pageSource = readFileSync(resolve(process.cwd(), 'apps/web/src/features/cc/ui/CcPage.vue'), 'utf8')
const directorySource = readFileSync(
  resolve(process.cwd(), 'apps/web/src/features/cc/ui/CcDirectory.vue'),
  'utf8'
)
const termSource = readFileSync(resolve(process.cwd(), 'apps/web/src/features/cc/ui/CcTermCard.vue'), 'utf8')

function templateDocument(source: string): Document {
  const start = source.indexOf('<template>') + '<template>'.length
  const end = source.lastIndexOf('</template>')
  const html = source
    .slice(start, end)
    .replace(/<\/?template\b[^>]*>/g, '')
    .replace(/<([A-Z][\w]*)\b([^<>]*?)\/>/g, '<$1$2></$1>')
  return new DOMParser().parseFromString(html, 'text/html')
}

function attributeOrder(document: Document, attribute: string): string[] {
  return [...document.querySelectorAll(`[${attribute}]`)].map(
    (element) => element.getAttribute(attribute) ?? ''
  )
}

describe('CC legacy layout contract', () => {
  it('keeps the 260px search-only directory and shared mobile drawer', () => {
    const directory = templateDocument(directorySource)
    const page = templateDocument(pageSource)

    expect(attributeOrder(directory, 'data-cc-directory-block')).toEqual(['search', 'list'])
    expect(pageSource).toContain('grid-template-columns: 260px minmax(0, 1fr)')
    expect(pageSource).toContain('width: 260px')
    expect(page.querySelector('responsivedrawer')).not.toBeNull()
    expect(page.querySelector('.cc-mobile-button')).not.toBeNull()
  })

  it('keeps the seven CC detail sections in exact legacy order', () => {
    const page = templateDocument(pageSource)

    expect(attributeOrder(page, 'data-cc-detail-block')).toEqual([
      'activity-configuration',
      'contract-terms',
      'selected-term-details',
      'dungeon-enemies',
      'level-rewards',
      'shop',
      'tasks'
    ])
    expect(page.querySelector('[data-cc-detail-block="activity-configuration"]')).toHaveProperty(
      'tagName',
      'DETAILS'
    )
  })

  it('keeps base-route overview and writes only canonical module query links after selection', () => {
    expect(pageSource).toContain('v-else-if="!requestedId"')
    expect(pageSource).toContain("['active', 'upcoming', 'ended', 'permanent'] as const")
    expect(pageSource).toContain("params: { moduleId: 'v3_cc' }")
    expect(pageSource).toContain('query: { ...route.query, id: entry.id }')
    expect(pageSource).not.toContain('/module/v3_cc/')
  })

  it('retains interactive score, conflict, reset, and explicit image resolution without generic blocks', () => {
    const page = templateDocument(pageSource)
    const term = templateDocument(termSource)

    expect(page.querySelector('[data-cc-score]')).not.toBeNull()
    expect(term.querySelector('[aria-pressed]')).not.toBeNull()
    expect(pageSource).toContain('recalculateCcCombat(')
    expect(pageSource).toContain('toggleCcTerm(')
    expect(pageSource).toContain('client.resolveImageUrl(')
    expect(termSource).toContain('client.resolveImageUrl(')
    expect(page.querySelector('main')).toBeNull()
    for (const forbidden of ['CatalogFeaturePage', 'ModuleHeader', 'MetricGrid', 'RawDataInspector']) {
      expect(pageSource).not.toContain(forbidden)
    }
  })
})
