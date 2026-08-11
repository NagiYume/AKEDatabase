import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { LANGUAGE_INFO, type AppLocale } from '@ake/r2-contract'

import { APP_MODULE_BY_ID, APP_MODULES, DISABLED_MODULE_IDS, isModuleId } from '../src/app/modules'
import { usePreferencesStore, type AppTheme } from '../src/app/stores/preferences'
import { createAppI18n, loadLocaleMessages } from '../src/shared/i18n'

const expectedModules = [
  { id: 'hidden-example', priority: 9998, sourceOrder: 0, hidden: true },
  { id: 'settings', priority: 9999, sourceOrder: 1, hidden: false },
  { id: 'v3_weapon', priority: 8, sourceOrder: 4, hidden: false },
  { id: 'v3_character', priority: 7, sourceOrder: 7, hidden: false },
  { id: 'v3_enemy', priority: 9, sourceOrder: 10, hidden: false },
  { id: 'v3_equip', priority: 10, sourceOrder: 13, hidden: false },
  { id: 'v3_item', priority: 20, sourceOrder: 16, hidden: false },
  { id: 'v3_shop', priority: 19, sourceOrder: 17, hidden: false },
  { id: 'v3_achievement', priority: 22, sourceOrder: 19, hidden: false },
  { id: 'v3_dungeon', priority: 21, sourceOrder: 22, hidden: false },
  { id: 'research', priority: 25, sourceOrder: 23, hidden: false },
  { id: 'about', priority: 100, sourceOrder: 24, hidden: false },
  { id: 'v3_activity', priority: 11, sourceOrder: 26, hidden: false },
  { id: 'v3_mission', priority: 12, sourceOrder: 27, hidden: true },
  { id: 'baker', priority: 23, sourceOrder: 28, hidden: false },
  { id: 'v3_cc', priority: 24, sourceOrder: 30, hidden: false },
  { id: 'season_tower', priority: 2, sourceOrder: 31, hidden: false },
  { id: 'v3_skill', priority: 10, sourceOrder: 35, hidden: false },
  { id: 'v3_buff', priority: 11, sourceOrder: 36, hidden: false }
].toSorted((left, right) => left.priority - right.priority || left.sourceOrder - right.sourceOrder)

const expectedDisabledIds = [
  'weapon',
  'v2_weapon',
  'character',
  'v2_character',
  'enemy',
  'v2_enemy',
  'equip',
  'v2_equip',
  'item',
  'v2_item',
  'achievement',
  'dungeon',
  'v2_dungeon',
  'activity',
  'v2_cc',
  'buff',
  'skill',
  'skill_v2',
  'spawn'
]

const expectedLanguages = {
  CH: { directory: 'CH', table: 'CN', htmlLang: 'zh-CN' },
  TC: { directory: 'TC', table: 'TC', htmlLang: 'zh-Hant' },
  EN: { directory: 'EN', table: 'EN', htmlLang: 'en' },
  JP: { directory: 'JP', table: 'JP', htmlLang: 'ja' },
  KR: { directory: 'KR', table: 'KR', htmlLang: 'ko' },
  RU: { directory: 'RU', table: 'RU', htmlLang: 'ru' },
  MX: { directory: 'MX', table: 'MX', htmlLang: 'es-MX' },
  BR: { directory: 'BR', table: 'BR', htmlLang: 'pt-BR' },
  DE: { directory: 'DE', table: 'DE', htmlLang: 'de' },
  FR: { directory: 'FR', table: 'FR', htmlLang: 'fr' },
  VN: { directory: 'VN', table: 'VN', htmlLang: 'vi' },
  TH: { directory: 'TH', table: 'TH', htmlLang: 'th' },
  ID: { directory: 'ID', table: 'ID', htmlLang: 'id' },
  IT: { directory: 'IT', table: 'IT', htmlLang: 'it' }
} as const satisfies Record<AppLocale, { directory: string; table: string; htmlLang: string }>

describe('application module registry contract', () => {
  it('contains every active manifest module in stable priority and source order', () => {
    expect(
      APP_MODULES.map((module) => ({
        id: module.id,
        priority: module.priority,
        sourceOrder: module.sourceOrder,
        hidden: module.hidden
      }))
    ).toEqual(expectedModules)
    expect(new Set(APP_MODULES.map((module) => module.id)).size).toBe(APP_MODULES.length)
  })

  it('keeps every disabled manifest module completely outside the active registry', () => {
    expect([...DISABLED_MODULE_IDS]).toEqual(expectedDisabledIds)
    for (const id of expectedDisabledIds) {
      expect(APP_MODULE_BY_ID.has(id as never)).toBe(false)
      expect(isModuleId(id)).toBe(false)
      expect(APP_MODULES.some((module) => module.id === id)).toBe(false)
    }
  })
})

describe('locale contract', () => {
  it('defines the exact 14 locale directory, table and HTML language mappings', () => {
    expect(Object.keys(LANGUAGE_INFO)).toEqual(Object.keys(expectedLanguages))
    expect(Object.keys(LANGUAGE_INFO)).toHaveLength(14)
    for (const locale of Object.keys(expectedLanguages) as AppLocale[]) {
      expect(LANGUAGE_INFO[locale]).toMatchObject(expectedLanguages[locale])
    }
  })

  it.each(Object.keys(expectedLanguages) as AppLocale[])(
    'loads $0 from its mapped locale path',
    async (locale) => {
      const client = { getJson: vi.fn().mockResolvedValue({ messages: {} }) }
      const i18n = createAppI18n(locale)

      await loadLocaleMessages(i18n, client as never, locale)

      expect(client.getJson).toHaveBeenCalledOnce()
      expect(client.getJson).toHaveBeenCalledWith({
        kind: 'locale',
        path: `public/${expectedLanguages[locale].directory}/i18n.json`
      })
      expect(document.documentElement.lang).toBe(expectedLanguages[locale].htmlLang)
      expect(i18n.global.locale.value).toBe(locale)
    }
  )
})

describe('preference compatibility', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  it('migrates every supported legacy key without coercing level selections', () => {
    localStorage.setItem('akedata-language', 'JP')
    localStorage.setItem('akedata-theme', 'yellow')
    localStorage.setItem('akedata-showHidden', 'true')
    localStorage.setItem('akedata-showExportButtonStable', 'false')
    localStorage.setItem('akedata-showVersionChanges', 'true')
    localStorage.setItem('akedata-data-version', '1.2.3@456')
    localStorage.setItem('akedata-data-base-url', 'https://example.test/r2')
    localStorage.setItem('akedata-unlockedTokens', JSON.stringify([' cc-test ', 'cc-test', 'cc-extra']))
    localStorage.setItem(
      'akedata-levelSettings',
      JSON.stringify({
        enabled: false,
        characterLevels: '1,90',
        weaponLevels: '20,80',
        enemyLevels: '40,60',
        skillLevels: [true, false, false, false, false, false, false, false, true, false, false, true]
      })
    )

    const preferences = usePreferencesStore()

    expect(preferences.$state).toMatchObject({
      locale: 'JP',
      theme: 'yellow',
      showHidden: true,
      showExport: false,
      showVersionChanges: true,
      dataVersion: '1.2.3@456',
      dataBaseUrl: 'https://example.test/r2',
      levels: {
        enabled: false,
        character: '1,90',
        weapon: '20,80',
        enemy: '40,60',
        skill: [1, 9, 12]
      },
      unlockedTokens: ['cc-test', 'cc-extra']
    })
  })

  it('prefers the v3 record and normalizes unsupported locale and theme values', () => {
    localStorage.setItem('akedata-language', 'JP')
    localStorage.setItem('akedata-theme', 'dark')
    localStorage.setItem(
      'akedatabase.preferences.v3',
      JSON.stringify({ locale: 'unsupported', theme: 'blue', showHidden: true })
    )

    const preferences = usePreferencesStore()

    expect(preferences.locale).toBe('CH')
    expect(preferences.theme).toBe('light')
    expect(preferences.showHidden).toBe(true)
  })

  it.each(['light', 'yellow', 'dark'] satisfies AppTheme[])('accepts the %s application theme', (theme) => {
    const preferences = usePreferencesStore()
    preferences.setTheme(theme)
    expect(preferences.theme).toBe(theme)
  })

  it('restores every legacy setting to the original defaults', () => {
    const preferences = usePreferencesStore()
    preferences.$patch({
      locale: 'JP',
      theme: 'dark',
      showHidden: true,
      showExport: false,
      showVersionChanges: true,
      dataVersion: '1.2.3@456',
      dataBaseUrl: 'https://example.test/r2',
      levels: {
        enabled: false,
        character: '90',
        weapon: '80',
        enemy: '100',
        skill: [12]
      },
      unlockedTokens: ['cc-test']
    })

    preferences.resetAll()

    expect(preferences.$state).toEqual({
      locale: 'CH',
      theme: 'light',
      showHidden: false,
      showExport: true,
      showVersionChanges: false,
      dataVersion: 'latest',
      dataBaseUrl: '',
      levels: {
        enabled: true,
        character: '1,20,40,60,80,90',
        weapon: '1,20,40,60,80,90',
        enemy: '1,20,40,60,80,90',
        skill: [1, 9, 10, 11, 12]
      },
      unlockedTokens: []
    })
  })
})
