import { afterEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia, type Pinia } from 'pinia'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { nextTick, shallowRef } from 'vue'
import type { Router } from 'vue-router'
import type { AppLocale, AppVersionConfig, R2Manifest, R2VersionEntry } from '@ake/r2-contract'
import type { DataClientState, R2DataClient } from '@ake/data-client'

import AppShell from '../src/app/AppShell.vue'
import { createAppRouter } from '../src/app/router'
import { APP_CONTEXT_KEY, type AppContext } from '../src/app/providers/app-context'
import { usePreferencesStore, type AppTheme } from '../src/app/stores/preferences'
import { createAppI18n } from '../src/shared/i18n'

interface MountedShell {
  wrapper: VueWrapper
  pinia: Pinia
  router: Router
}

const mounted: MountedShell[] = []

function appContext(appversion: string, locale: AppLocale): AppContext {
  const selected: R2VersionEntry = {
    id: '1.2.3@456',
    gameVersion: '1.2.3',
    hotfixVersion: '456',
    tableCfgPath: 'versions/1.2.3/456/TableCfg',
    publishedAt: '2026-01-01T00:00:00Z'
  }
  const manifest: R2Manifest = {
    schemaVersion: 1,
    latest: selected.id,
    sharedRevision: 'test-revision',
    updatedAt: '2026-01-01T00:00:00Z',
    versions: [selected]
  }
  const config: AppVersionConfig = {
    appversion,
    dataBaseUrl: 'https://data.example.test',
    dataManifestPath: '/manifest.json'
  }
  const state: DataClientState = {
    baseUrl: config.dataBaseUrl,
    manifestPath: config.dataManifestPath,
    manifest,
    selection: 'latest',
    selected,
    locale,
    source: 'network'
  }
  return {
    config,
    client: {} as R2DataClient,
    dataState: shallowRef(state),
    async reconfigure() {
      return state
    }
  }
}

async function mountShell(appversion: string, locale: AppLocale = 'EN'): Promise<MountedShell> {
  localStorage.clear()
  window.history.replaceState({}, '', '/')
  const pinia = createPinia()
  setActivePinia(pinia)
  const preferences = usePreferencesStore(pinia)
  preferences.setLocale(locale)
  const router = createAppRouter(preferences)
  await router.push('/')
  await router.isReady()
  const wrapper = mount(AppShell, {
    attachTo: document.body,
    global: {
      plugins: [pinia, router, createAppI18n(locale)],
      provide: { [APP_CONTEXT_KEY as symbol]: appContext(appversion, locale) },
      stubs: { RouterView: true }
    }
  })
  const result = { wrapper, pinia, router }
  mounted.push(result)
  return result
}

afterEach(() => {
  for (const item of mounted.splice(0)) {
    item.wrapper.unmount()
    item.router.options.history.destroy()
  }
  delete document.documentElement.dataset.theme
})

describe('AppShell release state', () => {
  it('shows the 30-cell hostname warning watermark and beta brand for any pre version', async () => {
    const { wrapper } = await mountShell('1.2.9-PRE20')
    const watermark = wrapper.get('.beta-watermark')
    const cells = watermark.findAll('.beta-watermark__cell')

    expect(cells).toHaveLength(30)
    expect(cells[0]?.findAll('span')[0]?.text()).toBe(window.location.hostname || 'localhost')
    expect(watermark.text()).toContain('测试版本，仅供参考')
    expect(wrapper.get('.brand small').text()).toBe('beta')
    expect(wrapper.get('.mobile-brand small').text()).toBe('beta')
  })

  it('does not render beta UI for a stable version', async () => {
    const { wrapper } = await mountShell('1.2.9')

    expect(wrapper.find('.beta-watermark').exists()).toBe(false)
    expect(wrapper.get('.brand small').text()).toBe('Wiki')
    expect(wrapper.get('.mobile-brand small').text()).toBe('Wiki')
  })

  it('resolves the stable Wiki brand through i18n while preserving beta semantics', async () => {
    const stable = await mountShell('1.2.9', 'CH')
    expect(stable.wrapper.get('.brand small').text()).toBe('Wiki')
    expect(stable.wrapper.get('.mobile-brand small').text()).toBe('Wiki')

    const prerelease = await mountShell('1.2.9-pre20', 'CH')
    expect(prerelease.wrapper.get('.brand small').text()).toBe('beta')
    expect(prerelease.wrapper.get('.mobile-brand small').text()).toBe('beta')
  })
})

describe('AppShell mobile navigation', () => {
  it('mounts navigation only while open and restores focus after Escape', async () => {
    const { wrapper } = await mountShell('1.2.9')
    const trigger = wrapper.get<HTMLButtonElement>('button[aria-label="Open modules"]')
    trigger.element.focus()

    expect(document.querySelector('.ake-drawer')).toBeNull()
    await trigger.trigger('click')
    await flushPromises()

    const drawer = document.querySelector<HTMLElement>('.ake-drawer')
    expect(drawer).not.toBeNull()
    expect(drawer?.contains(document.activeElement)).toBe(true)

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await flushPromises()

    expect(document.querySelector('.ake-drawer')).toBeNull()
    expect(document.activeElement).toBe(trigger.element)
  })
})

describe('AppShell themes', () => {
  it('applies all three supported themes to the document root', async () => {
    const { pinia } = await mountShell('1.2.9')
    const preferences = usePreferencesStore(pinia)

    for (const theme of ['light', 'yellow', 'dark'] satisfies AppTheme[]) {
      preferences.setTheme(theme)
      await nextTick()
      expect(document.documentElement.dataset.theme).toBe(theme)
    }
  })
})

describe('AppShell legacy export control', () => {
  it('follows the persisted show-export preference', async () => {
    const { wrapper, pinia } = await mountShell('1.2.9')
    const preferences = usePreferencesStore(pinia)

    expect(wrapper.find('.sidebar-footer .export-link').exists()).toBe(true)

    preferences.showExport = false
    await nextTick()
    expect(wrapper.find('.sidebar-footer .export-link').exists()).toBe(false)

    preferences.showExport = true
    await nextTick()
    expect(wrapper.find('.sidebar-footer .export-link').exists()).toBe(true)
  })
})
