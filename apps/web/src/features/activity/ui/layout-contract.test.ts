import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(
  resolve(process.cwd(), 'apps/web/src/features/activity/ui/ActivityPage.vue'),
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

describe('activity legacy layout contract', () => {
  it('keeps desktop controls in search, type, status, list order', () => {
    const document = templateDocument()

    expect(attributeOrder(document, 'data-activity-directory-block')).toEqual([
      'search',
      'type',
      'status',
      'list'
    ])
    expect(source).toContain('grid-template-columns: 260px minmax(0, 1fr)')
  })

  it('keeps the selected activity fields and optional sections in legacy order', () => {
    const document = templateDocument()

    expect(attributeOrder(document, 'data-activity-block')).toEqual([
      'header',
      'time',
      'tags',
      'countdown',
      'description',
      'conditions',
      'rewards',
      'stages'
    ])
    expect(source).toContain('v-if="selectedEntry.conditions.length"')
    expect(source).toContain('v-if="selectedEntry.reward.items.length"')
    expect(source).toContain('v-if="selectedEntry.stages.length"')
  })

  it('removes added primary blocks and uses the shared responsive drawer', () => {
    const document = templateDocument()

    expect(document.querySelector('responsivedrawer')).not.toBeNull()
    expect(document.querySelector('.activity-mobile-list-button')).not.toBeNull()
    expect(document.querySelector('main')).toBeNull()
    expect(document.querySelector('moduleheader')).toBeNull()
    expect(document.querySelector('metricgrid')).toBeNull()
    expect(document.querySelector('rawdatainspector')).toBeNull()
    expect(document.querySelector('datatable')).toBeNull()
    expect(document.querySelector('.activity-facts')).toBeNull()
    expect(document.querySelector('.activity-ranges')).toBeNull()
    expect(document.querySelector('.activity-change-summary')).toBeNull()
  })

  it('places the timeline directly after the legacy overview header', () => {
    const document = templateDocument()
    const overview = document.querySelector('.activity-overview')
    const header = overview?.querySelector('.ake-overview__header')
    const timeline = overview?.querySelector('.activity-timeline')

    expect(header).not.toBeNull()
    expect(timeline).not.toBeNull()
    expect(header?.nextElementSibling).toBe(timeline)
  })
})
