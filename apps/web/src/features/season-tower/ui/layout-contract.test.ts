import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const pageSource = readFileSync(
  resolve(process.cwd(), 'apps/web/src/features/season-tower/ui/SeasonTowerPage.vue'),
  'utf8'
)
const combatSource = readFileSync(
  resolve(process.cwd(), 'apps/web/src/features/season-tower/ui/SeasonTowerCombatDetail.vue'),
  'utf8'
)

describe('season tower legacy layout contract', () => {
  it('keeps the old single-detail block order', () => {
    const regions = [...pageSource.matchAll(/data-season-region="([^"]+)"/g)].map((match) => match[1])

    expect(regions).toEqual(['header', 'intro', 'ranks', 'weeks'])
  })

  it('restores the 260px season directory and shared mobile drawer without added overview controls', () => {
    expect(pageSource).toContain('grid-template-columns: 260px minmax(0, 1fr)')
    expect(pageSource).toContain('<ResponsiveDrawer')
    expect(pageSource).toContain('class="st-mobile-button"')
    expect(pageSource).not.toContain('<ModuleShell')
    expect(pageSource).not.toContain('<ModuleHeader')
    expect(pageSource).not.toContain('<MetricGrid')
    expect(pageSource).not.toContain('<SearchToolbar')
    expect(pageSource).not.toContain('<Select')
  })

  it('uses active/latest only as an in-memory fallback and writes id only on explicit selection', () => {
    expect(pageSource).toContain("seasons.find((season) => season.status === 'active') ?? seasons.at(-1)")
    expect(pageSource).toContain('query: { ...route.query, id: season.id }')
    expect(pageSource).not.toContain('watch(selected')
    expect(pageSource).not.toContain('router.replace')
  })

  it('keeps weeks, stages, difficulties, highest-difficulty combat, and the linked wave map', () => {
    expect(pageSource).toContain('class="st-week"')
    expect(pageSource).toContain('class="st-stage"')
    expect(pageSource).toContain('class="st-difficulty"')
    expect(pageSource).toContain("week.status === 'active'")
    expect(pageSource).toContain('difficulty.star === maxDifficultyStar(stage)')
    expect(combatSource).toContain('data-tower-wave-map')
    expect(combatSource).toContain('class="tower-wave-line"')
    expect(combatSource).toContain('class="tower-spawn-map"')
    expect(combatSource).toContain('@mouseenter="highlightEnemy')
    expect(combatSource).toContain('@focus="highlightEnemy')
    expect(combatSource).toContain("'group-highlight': state.group")
    expect(combatSource).toContain("'target-highlight': state.target")
  })
})
