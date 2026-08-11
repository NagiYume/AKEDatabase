import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import type { Router } from 'vue-router'

import { createAppRouter } from '../src/app/router'
import { usePreferencesStore } from '../src/app/stores/preferences'

let activeRouter: Router | null = null

beforeEach(() => {
  localStorage.clear()
  window.history.replaceState({}, '', '/')
  setActivePinia(createPinia())
})

afterEach(() => {
  activeRouter?.options.history.destroy()
  activeRouter = null
})

function routerWithHiddenPreference(showHidden: boolean): Router {
  const preferences = usePreferencesStore()
  preferences.showHidden = showHidden
  activeRouter = createAppRouter(preferences)
  return activeRouter
}

describe('module route guards', () => {
  it('blocks hidden modules by default with an explicit hidden result', async () => {
    const router = routerWithHiddenPreference(false)
    await router.push('/module/hidden-example/internal-id')

    expect(router.currentRoute.value.name).toBe('not-found')
    expect(router.currentRoute.value.query).toEqual({ hidden: '1' })
  })

  it('redirects hidden-module entity paths to canonical query IDs when enabled', async () => {
    const router = routerWithHiddenPreference(true)
    await router.push('/module/v3_mission/900719925474099312345')

    expect(router.currentRoute.value.name).toBe('module')
    expect(router.currentRoute.value.path).toBe('/module/v3_mission')
    expect(router.currentRoute.value.params).toEqual({ moduleId: 'v3_mission' })
    expect(router.currentRoute.value.query).toEqual({ id: '900719925474099312345' })
    expect(router.currentRoute.value.matched.at(-1)?.path).toBe('/module/:moduleId')
  })

  it.each(['skill', 'v2_weapon', 'spawn', 'not-a-module'])(
    'keeps disabled or unknown module %s unreachable',
    async (moduleId) => {
      const router = routerWithHiddenPreference(true)
      await router.push(`/module/${moduleId}/legacy-id`)

      expect(router.currentRoute.value.name).toBe('not-found')
      expect(router.currentRoute.value.query.hidden).toBeUndefined()
    }
  )
})

describe('legacy deep links', () => {
  it('redirects to the module route without changing a large entity ID or unrelated query state', async () => {
    const router = routerWithHiddenPreference(false)
    const entityId = '900719925474099312345'
    await router.push({
      path: '/',
      query: { plugin: 'v3_skill', id: entityId, level: '12', tab: 'logic' }
    })

    expect(router.currentRoute.value.name).toBe('module')
    expect(router.currentRoute.value.path).toBe('/module/v3_skill')
    expect(router.currentRoute.value.params).toEqual({ moduleId: 'v3_skill' })
    expect(router.currentRoute.value.query).toEqual({ id: entityId, level: '12', tab: 'logic' })
  })

  it('applies the hidden guard after redirecting a legacy hidden-module link', async () => {
    const router = routerWithHiddenPreference(false)
    await router.push({ path: '/', query: { plugin: 'v3_mission', id: 'mission_001' } })

    expect(router.currentRoute.value.name).toBe('not-found')
    expect(router.currentRoute.value.query).toEqual({ hidden: '1' })
  })

  it('rejects disabled legacy plugin IDs instead of creating a compatibility route', async () => {
    const router = routerWithHiddenPreference(true)
    await router.push({ path: '/', query: { plugin: 'skill', id: 'legacy_skill' } })

    expect(router.currentRoute.value.name).toBe('not-found')
  })
})

describe('canonical entity links', () => {
  it.each(['/module/v3_skill/MiXeD_900719925474099312345', '/m/v3_skill/MiXeD_900719925474099312345'])(
    'redirects %s without changing the entity text or unrelated query',
    async (path) => {
      const router = routerWithHiddenPreference(true)
      await router.push(`${path}?id=stale&level=12&tab=logic`)

      expect(router.currentRoute.value.path).toBe('/module/v3_skill')
      expect(router.currentRoute.value.params).toEqual({ moduleId: 'v3_skill' })
      expect(router.currentRoute.value.query).toEqual({
        id: 'MiXeD_900719925474099312345',
        level: '12',
        tab: 'logic'
      })
      expect(router.currentRoute.value.matched.at(-1)?.path).toBe('/module/:moduleId')
    }
  )

  it('keeps a canonical query ID byte-for-byte as parsed and coexists with filters', async () => {
    const router = routerWithHiddenPreference(true)
    const entityId = 'Skill_CASE_900719925474099312345'
    await router.push({
      path: '/module/v3_skill',
      query: { id: entityId, level: '12', view: 'flow', q: 'Damage' }
    })

    expect(router.currentRoute.value.path).toBe('/module/v3_skill')
    expect(router.currentRoute.value.query).toEqual({
      id: entityId,
      level: '12',
      view: 'flow',
      q: 'Damage'
    })
  })

  it('redirects the legacy short module route even when no entity is selected', async () => {
    const router = routerWithHiddenPreference(true)
    await router.push('/m/about?rarity=5')

    expect(router.currentRoute.value.path).toBe('/module/about')
    expect(router.currentRoute.value.query).toEqual({ rarity: '5' })
  })
})
