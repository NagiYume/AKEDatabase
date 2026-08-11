import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const pageSource = readFileSync(
  resolve(process.cwd(), 'apps/web/src/features/combat/ui/CombatPage.vue'),
  'utf8'
)
const directorySource = readFileSync(
  resolve(process.cwd(), 'apps/web/src/features/combat/ui/CombatDirectory.vue'),
  'utf8'
)
const graphSource = readFileSync(
  resolve(process.cwd(), 'apps/web/src/features/combat/ui/CombatGraphViews.vue'),
  'utf8'
)

function orderedRegions(prefix: string): string[] {
  return [...pageSource.matchAll(/data-layout-region="([^"]+)"/g)]
    .map((match) => match[1] ?? '')
    .filter((region) => region.startsWith(prefix))
}

describe('combat legacy layout contract', () => {
  it('keeps the exact Skill detail region order and old top-level tabs', () => {
    expect(orderedRegions('skill-')).toEqual([
      'skill-identity',
      'skill-context',
      'skill-level-config',
      'skill-core',
      'skill-windows',
      'skill-hits',
      'skill-tabs'
    ])
    expect(pageSource).toContain("timeline: '战斗时间轴', logic: '逻辑链', debug: '调试数据'")
  })

  it('keeps the exact Buff detail region order and old top-level tabs', () => {
    expect(orderedRegions('buff-')).toEqual([
      'buff-identity',
      'buff-core',
      'buff-effects',
      'buff-action-data'
    ])
    expect(pageSource).toContain("events: '事件', timeline: '时间轴', links: '关联', technical: '技术详情'")
  })

  it('restores fixed desktop directory widths and a shared mobile drawer', () => {
    expect(pageSource).toContain("domain === 'skill' ? '292px' : '300px'")
    expect(pageSource).toContain('<ResponsiveDrawer')
    expect(pageSource).toContain("drawer: { skill: '技能列表', buff: 'Buff目录' }")
    expect(directorySource).toContain('combat-directory__owner-toggle')
    expect(directorySource).toContain('combat-directory__group-toggle')
    expect(directorySource).toContain('section.itemCount')
  })

  it('embeds all graph capabilities below the legacy tabs', () => {
    expect(pageSource).toContain('<CombatGraphViews')
    expect(graphSource).toContain("['tree', 'flow', 'linear']")
    expect(graphSource).toContain('class="tree-node"')
    expect(graphSource).toContain('class="flow-panel"')
    expect(graphSource).toContain('class="linear-action-button"')
    expect(graphSource).toContain('class="combat-load-more"')
  })
})
