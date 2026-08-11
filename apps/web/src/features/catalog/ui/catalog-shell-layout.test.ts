import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const pageSource = readFileSync(
  resolve(process.cwd(), 'apps/web/src/features/catalog/ui/CatalogFeaturePage.vue'),
  'utf8'
)
const directorySource = readFileSync(
  resolve(process.cwd(), 'apps/web/src/features/catalog/ui/CatalogDirectory.vue'),
  'utf8'
)

describe('legacy catalog shell layout', () => {
  it('keeps the achievement directory at 220px and the other legacy directories at 260px', () => {
    expect(pageSource).toContain("props.moduleId === 'v3_achievement' ? '220px' : '260px'")
    expect(pageSource).toContain(':directory-width="directoryWidth"')
  })

  it('keeps the mobile drawer to the legacy list content', () => {
    expect(pageSource).toMatch(/<ResponsiveDrawer[\s\S]*?<CatalogDirectory[\s\S]*?list-only/)
    expect(directorySource).toContain('v-if="!listOnly" #header')
    expect(directorySource).toContain('v-if="!listOnly" #toolbar')
  })

  it('does not append generic data tools to the six specialized legacy details', () => {
    expect(pageSource).toContain('<CatalogTools\n        v-if="!specializedModule"')
  })
})
