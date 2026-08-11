import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(
  resolve(process.cwd(), 'apps/web/src/features/research/ui/ResearchPage.vue'),
  'utf8'
)
const inlineSource = readFileSync(
  resolve(process.cwd(), 'apps/web/src/features/research/ui/ResearchMarkdownInline.vue'),
  'utf8'
)

function templateDocument(): Document {
  const start = source.indexOf('<template>') + '<template>'.length
  const end = source.lastIndexOf('</template>')
  const html = source
    .slice(start, end)
    .replace(/<\/?template\b[^>]*>/g, '')
    .replace(/<([A-Z][\w]*)\b([^<>]*?)\/>/g, '<$1$2></$1>')
  return new DOMParser().parseFromString(html, 'text/html')
}

describe('research legacy layout contract', () => {
  it('keeps directory, reading surface, and table of contents in legacy order', () => {
    const document = templateDocument()
    const module = document.querySelector('.research-module')
    const regions = ['.research-sidebar', '.research-detail', '.research-toc'].map((selector) =>
      module?.querySelector(selector)
    )

    expect(regions.every(Boolean)).toBe(true)
    expect(
      (regions[0]?.compareDocumentPosition(regions[1] as Node) ?? 0) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
    expect(
      (regions[1]?.compareDocumentPosition(regions[2] as Node) ?? 0) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
    expect(source).toContain('grid-template-columns: 260px minmax(0, 1fr) 210px')
  })

  it('provides both mobile controls and scroll-active contents without new top-level blocks', () => {
    const document = templateDocument()

    expect(document.querySelector('.research-mobile-list-button')).not.toBeNull()
    expect(document.querySelector('responsivedrawer')).not.toBeNull()
    expect(document.querySelector('.research-toc-toggle')).not.toBeNull()
    expect(source).toContain("'is-active': activeTocId === heading.id")
    expect(document.querySelector('main')).toBeNull()
    expect(document.querySelector('moduleheader')).toBeNull()
    expect(document.querySelector('metricgrid')).toBeNull()
    expect(document.querySelector('.research-reading-layout')).toBeNull()
  })

  it('keeps the legacy grouped overview when no document is selected', () => {
    const document = templateDocument()
    const overview = document.querySelector('.ake-overview')

    expect(overview?.querySelector('.ake-overview__header')).not.toBeNull()
    expect(overview?.querySelector('.ake-overview__section')).not.toBeNull()
    expect(overview?.querySelector('.ake-overview__grid')).not.toBeNull()
    expect(overview?.querySelector('.ake-overview__card')).not.toBeNull()
  })

  it('renders the controlled inline AST in quotes, lists, and tables without raw HTML', () => {
    const document = templateDocument()

    expect(document.querySelector('blockquote researchmarkdowninline')).not.toBeNull()
    expect(document.querySelector('li researchmarkdowninline')).not.toBeNull()
    expect(document.querySelector('th researchmarkdowninline')).not.toBeNull()
    expect(document.querySelector('td researchmarkdowninline')).not.toBeNull()
    expect(inlineSource).toContain('v-else-if="node.kind === \'link\'"')
    expect(inlineSource).toContain('rel="noopener noreferrer"')
    expect(source).not.toContain('v-html')
    expect(inlineSource).not.toContain('v-html')
    expect(source).not.toContain('innerHTML')
    expect(inlineSource).not.toContain('innerHTML')
  })
})
