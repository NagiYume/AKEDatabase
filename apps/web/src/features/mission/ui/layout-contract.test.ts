import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(
  resolve(process.cwd(), 'apps/web/src/features/mission/ui/MissionPage.vue'),
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

function attributeOrder(document: Document, attribute: string): string[] {
  return [...document.querySelectorAll(`[${attribute}]`)].map(
    (element) => element.getAttribute(attribute) ?? ''
  )
}

describe('mission legacy layout contract', () => {
  it('keeps home/search, filters, summary, and list in legacy order', () => {
    const document = templateDocument()

    expect(attributeOrder(document, 'data-mission-directory-block')).toEqual([
      'search',
      'filters',
      'summary',
      'list'
    ])
    expect(document.querySelector('.mission-home-button')).not.toBeNull()
    expect(document.querySelector('.mission-list-item .mission-importance')).not.toBeNull()
  })

  it('restores the full overview sequence and two-tab detail', () => {
    const document = templateDocument()

    expect(attributeOrder(document, 'data-mission-overview-block')).toEqual([
      'header',
      'stats',
      'types',
      'explanation'
    ])
    expect(attributeOrder(document, 'data-mission-detail-block')).toEqual(['hero', 'tabs'])
    expect(document.querySelectorAll('.mission-tab')).toHaveLength(2)
    expect(source).not.toContain("value: 'rewards'")
  })

  it('keeps rewards inside collapsible quest flow and restores dialogue media', () => {
    const document = templateDocument()

    expect(document.querySelectorAll('.mission-info-grid > div')).toHaveLength(10)
    expect(document.querySelector('.mission-quest')).not.toBeNull()
    expect(source).toContain(':open="questIndex < 3"')
    expect(document.querySelector('.mission-completion-reward')).not.toBeNull()
    expect(document.querySelector('.mission-quest-reward')).not.toBeNull()
    expect(document.querySelector('.mission-dialog-line__avatar')).not.toBeNull()
    expect(source).toContain('line.hint')
    expect(source).toContain('line.audio')
  })

  it('uses the shared mobile drawer, canonical query deep links, and no nested main', () => {
    const document = templateDocument()

    expect(document.querySelector('responsivedrawer')).not.toBeNull()
    expect(document.querySelector('.mission-mobile-list-button')).not.toBeNull()
    expect(document.querySelector('main')).toBeNull()
    expect(source).toContain("name: 'module'")
    expect(source).toContain("params: { moduleId: 'v3_mission' }")
    expect(source).toContain('query: { ...route.query, id: entry.id }')
    expect(document.querySelector('moduleheader')).toBeNull()
    expect(document.querySelector('metricgrid')).toBeNull()
  })
})
