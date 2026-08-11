import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(resolve(process.cwd(), 'apps/web/src/features/baker/ui/BakerPage.vue'), 'utf8')

function templateDocument(): Document {
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

describe('baker legacy layout contract', () => {
  it('keeps brand, search, four-way segments, and contacts in legacy order', () => {
    const document = templateDocument()

    expect(attributeOrder(document, 'data-baker-directory-block')).toEqual([
      'brand',
      'search',
      'segments',
      'list'
    ])
    expect(document.querySelector('.baker-brand__mark')?.textContent).toBe('B')
    expect(document.querySelectorAll('.baker-segments button')).toHaveLength(4)
  })

  it('restores the sticky chat header before topic threads and metadata', () => {
    const document = templateDocument()

    expect(attributeOrder(document, 'data-baker-conversation-block')).toEqual(['header', 'threads'])
    expect(document.querySelector('.baker-chat-header__stats')).not.toBeNull()
    expect(document.querySelector('.baker-thread__heading')).not.toBeNull()
    expect(document.querySelector('.baker-dialog__meta')).not.toBeNull()
  })

  it('renders type 9 as structured reactions rather than a system message', () => {
    const document = templateDocument()

    expect(document.querySelector('.baker-reactions')).not.toBeNull()
    expect(document.querySelector('.baker-reaction__emoji')).not.toBeNull()
    expect(source).toContain('message.contentType === 7')
    expect(source).not.toContain('message.contentType === 7 || message.contentType === 9')
  })

  it('uses the first recorded session as a local fallback without adding an ID', () => {
    const document = templateDocument()

    expect(source).toContain('entries.find((entry) => entry.dialogue) ?? entries[0] ?? null')
    expect(source).not.toContain('id: first.id')
    expect(document.querySelector('responsivedrawer')).not.toBeNull()
    expect(document.querySelector('.baker-mobile-button')).not.toBeNull()
    expect(document.querySelector('main')).toBeNull()
    expect(document.querySelector('moduleheader')).toBeNull()
    expect(document.querySelector('metricgrid')).toBeNull()
  })

  it('writes an ID only after the user selects a conversation', () => {
    expect(source).toContain("params: { moduleId: 'baker' }")
    expect(source).toContain('query: { ...route.query, id: entry.id }')
  })
})
