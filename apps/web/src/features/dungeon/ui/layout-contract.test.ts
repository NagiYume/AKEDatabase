import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const pageSource = readFileSync(
  resolve(process.cwd(), 'apps/web/src/features/dungeon/ui/DungeonPage.vue'),
  'utf8'
)
const directorySource = readFileSync(
  resolve(process.cwd(), 'apps/web/src/features/dungeon/ui/DungeonDirectory.vue'),
  'utf8'
)
const waveSource = readFileSync(
  resolve(process.cwd(), 'apps/web/src/features/dungeon/ui/DungeonWavePanel.vue'),
  'utf8'
)

describe('dungeon legacy layout contract', () => {
  it('keeps a 260px search-only directory and shared mobile drawer', () => {
    expect(pageSource).toContain('grid-template-columns: 260px minmax(0, 1fr)')
    expect(pageSource).toContain('<ResponsiveDrawer')
    expect(pageSource).toContain('class="dungeon-mobile-button"')
    expect(directorySource).toContain('type="search"')
    expect(directorySource).not.toContain('<Select')
    expect(pageSource).not.toContain('<CatalogFeaturePage')
  })

  it('keeps base route as grouped overview and writes query id only on explicit selection', () => {
    expect(pageSource).toContain('data-dungeon-view="overview"')
    expect(pageSource).toContain('query: { ...route.query, id: item.id }')
    expect(pageSource).not.toContain('router.replace')
    expect(pageSource).not.toContain('watch(selected')
  })

  it('preserves the legacy series and ordered dungeon-card regions', () => {
    const seriesRegions = [...pageSource.matchAll(/data-dungeon-region="([^"]+)"/g)].map((match) => match[1])
    const cardRegions = [...pageSource.matchAll(/data-dungeon-card-region="([^"]+)"/g)].map(
      (match) => match[1]
    )
    expect(seriesRegions).toEqual(['banner', 'meta', 'description', 'cards'])
    expect(cardRegions).toEqual(['header', 'description', 'goals', 'meta', 'waves', 'rewards', 'enemies'])
  })

  it('keeps the wave map linkage and does not add a nested main landmark', () => {
    expect(waveSource).toContain('data-dungeon-wave-map')
    expect(waveSource).toContain('@mouseenter="highlight')
    expect(waveSource).toContain('@focus="highlight')
    expect(waveSource).toContain("'group-highlight': spotState(enemy).group")
    expect(waveSource).toContain("'target-highlight': spotState(enemy).target")
    expect(pageSource).not.toContain('<main')
  })
})
