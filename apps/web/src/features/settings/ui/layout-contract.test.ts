import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(
  resolve(process.cwd(), 'apps/web/src/features/settings/ui/SettingsPage.vue'),
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

describe('settings legacy layout contract', () => {
  it('keeps the original settings sections in order', () => {
    const document = templateDocument()
    const sections = [...document.querySelectorAll('[data-settings-section]')].map((element) =>
      element.getAttribute('data-settings-section')
    )

    expect(sections).toEqual(['global', 'data-source', 'levels', 'tokens', 'cache', 'version'])
  })

  it('keeps URL synchronization enabled for canonical shareable routes', () => {
    const document = templateDocument()
    const keepUrlSync = [...document.querySelectorAll('label')].find((label) =>
      label.textContent?.includes("t('settings.keepUrlSync')")
    )
    const input = keepUrlSync?.querySelector('input')

    expect(input?.hasAttribute('checked')).toBe(true)
    expect(input?.hasAttribute('disabled')).toBe(true)
  })

  it('does not introduce a nested main landmark', () => {
    const document = templateDocument()

    expect(document.querySelector('main')).toBeNull()
    expect(document.querySelector('moduleheader')?.hasAttribute(':description')).toBe(false)
  })
})
