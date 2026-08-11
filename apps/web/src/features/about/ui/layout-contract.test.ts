import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(resolve(process.cwd(), 'apps/web/src/features/about/ui/AboutPage.vue'), 'utf8')
const appShellSource = readFileSync(resolve(process.cwd(), 'apps/web/src/app/AppShell.vue'), 'utf8')

function templateDocument(value = source): Document {
  const start = value.indexOf('<template>') + '<template>'.length
  const end = value.lastIndexOf('</template>')
  const html = value
    .slice(start, end)
    .replace(/<\/?template\b[^>]*>/g, '')
    .replace(/<([A-Z][\w]*)\b([^<>]*?)\/>/g, '<$1$2></$1>')
  return new DOMParser().parseFromString(html, 'text/html')
}

describe('about legacy layout contract', () => {
  it('keeps all six legacy sections in exact order', () => {
    const document = templateDocument()
    const sections = [...document.querySelectorAll('[data-about-section]')].map((element) =>
      element.getAttribute('data-about-section')
    )

    expect(sections).toEqual(['introduction', 'features', 'usage', 'partners', 'sponsor', 'contact'])
  })

  it('keeps a static sponsor grid and the version at the end of contact', () => {
    const document = templateDocument()
    const sponsorGrid = document.querySelector('#sponsorGrid')
    const contact = document.querySelector('[data-about-section="contact"]')

    expect(sponsorGrid?.querySelector('.sponsor-card')).not.toBeNull()
    expect(contact?.lastElementChild?.classList.contains('about-contact-version')).toBe(true)
  })

  it('does not reintroduce added headers, metrics, sponsor filters, deep links, or nested main landmarks', () => {
    const document = templateDocument()
    const appShell = templateDocument(appShellSource)

    expect(document.querySelector('main')).toBeNull()
    expect(appShell.querySelectorAll('main')).toHaveLength(1)
    expect(document.querySelector('moduleheader')).toBeNull()
    expect(document.querySelector('metricgrid')).toBeNull()
    expect(document.querySelector('[data-sponsor-filter]')).toBeNull()
    expect(source).not.toContain('selectedSponsor')
    expect(source).not.toContain('route.query.id')
  })
})
