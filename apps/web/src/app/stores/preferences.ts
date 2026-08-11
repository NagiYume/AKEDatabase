import { defineStore } from 'pinia'
import { LANGUAGE_INFO, type AppLocale } from '@ake/r2-contract'

export type AppTheme = 'light' | 'dark' | 'yellow'

export interface LevelPreferences {
  enabled: boolean
  character: string
  weapon: string
  enemy: string
  skill: readonly number[]
}

interface PersistedPreferences {
  locale: AppLocale
  theme: AppTheme
  showHidden: boolean
  showExport: boolean
  showVersionChanges: boolean
  dataVersion: string
  dataBaseUrl: string
  levels: LevelPreferences
  unlockedTokens: string[]
}

const STORAGE_KEY = 'akedatabase.preferences.v3'

const LEGACY_KEYS = {
  locale: 'akedata-language',
  theme: 'akedata-theme',
  showHidden: 'akedata-showHidden',
  showExport: 'akedata-showExportButtonStable',
  showVersionChanges: 'akedata-showVersionChanges',
  dataVersion: 'akedata-data-version',
  dataBaseUrl: 'akedata-data-base-url',
  levels: 'akedata-levelSettings',
  unlockedTokens: 'akedata-unlockedTokens'
} as const

const defaults: PersistedPreferences = {
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
}

function parseBoolean(value: string | null, fallback: boolean) {
  return value === null ? fallback : value === 'true'
}

function readLegacyPreferences(): PersistedPreferences {
  const localeValue = localStorage.getItem(LEGACY_KEYS.locale)
  const locale = localeValue && localeValue in LANGUAGE_INFO ? (localeValue as AppLocale) : defaults.locale
  const themeValue = localStorage.getItem(LEGACY_KEYS.theme)
  const theme: AppTheme = themeValue === 'dark' || themeValue === 'yellow' ? themeValue : 'light'
  let levels = structuredClone(defaults.levels)

  try {
    const legacy = JSON.parse(localStorage.getItem(LEGACY_KEYS.levels) ?? 'null') as null | {
      enabled?: boolean
      characterLevels?: string
      weaponLevels?: string
      enemyLevels?: string
      skillLevels?: readonly boolean[]
    }
    if (legacy) {
      levels = {
        enabled: legacy.enabled ?? levels.enabled,
        character: legacy.characterLevels ?? levels.character,
        weapon: legacy.weaponLevels ?? levels.weapon,
        enemy: legacy.enemyLevels ?? levels.enemy,
        skill:
          legacy.skillLevels?.length === 12
            ? legacy.skillLevels.flatMap((enabled, index) => (enabled ? [index + 1] : []))
            : levels.skill
      }
    }
  } catch {
    // Malformed legacy preferences are ignored independently of the other settings.
  }

  let unlockedTokens: string[] = []
  try {
    const legacyTokens = JSON.parse(localStorage.getItem(LEGACY_KEYS.unlockedTokens) ?? '[]') as unknown
    if (Array.isArray(legacyTokens)) {
      unlockedTokens = [
        ...new Set(
          legacyTokens
            .filter((token): token is string => typeof token === 'string' && Boolean(token.trim()))
            .map((token) => token.trim())
        )
      ]
    }
  } catch {
    // Malformed token storage does not prevent the other preferences from migrating.
  }

  return {
    locale,
    theme,
    showHidden: parseBoolean(localStorage.getItem(LEGACY_KEYS.showHidden), defaults.showHidden),
    showExport: parseBoolean(localStorage.getItem(LEGACY_KEYS.showExport), defaults.showExport),
    showVersionChanges: parseBoolean(
      localStorage.getItem(LEGACY_KEYS.showVersionChanges),
      defaults.showVersionChanges
    ),
    dataVersion: localStorage.getItem(LEGACY_KEYS.dataVersion) || defaults.dataVersion,
    dataBaseUrl: localStorage.getItem(LEGACY_KEYS.dataBaseUrl) || defaults.dataBaseUrl,
    levels,
    unlockedTokens
  }
}

function normalizePreferences(value: Partial<PersistedPreferences>): PersistedPreferences {
  const locale =
    typeof value.locale === 'string' && value.locale in LANGUAGE_INFO ? value.locale : defaults.locale
  const theme = value.theme === 'dark' || value.theme === 'yellow' ? value.theme : 'light'
  return {
    ...defaults,
    ...value,
    locale,
    theme,
    levels: { ...defaults.levels, ...(value.levels ?? {}) },
    unlockedTokens: Array.isArray(value.unlockedTokens)
      ? [
          ...new Set(
            value.unlockedTokens
              .filter((token): token is string => typeof token === 'string' && Boolean(token.trim()))
              .map((token) => token.trim())
          )
        ]
      : []
  }
}

function readPersisted(): PersistedPreferences {
  if (typeof localStorage === 'undefined') return structuredClone(defaults)
  try {
    const persisted = localStorage.getItem(STORAGE_KEY)
    if (!persisted) return readLegacyPreferences()
    return normalizePreferences(JSON.parse(persisted) as Partial<PersistedPreferences>)
  } catch {
    return readLegacyPreferences()
  }
}

export const usePreferencesStore = defineStore('preferences', {
  state: readPersisted,
  actions: {
    installPersistence() {
      this.$subscribe(
        (_mutation, state) => {
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
          } catch {
            // Preference persistence is allowed to degrade in restricted browsing contexts.
          }
        },
        { detached: true }
      )
    },
    resetDataSource() {
      this.dataBaseUrl = ''
      this.dataVersion = 'latest'
    },
    resetAll() {
      this.$patch(structuredClone(defaults))
    },
    setLocale(locale: AppLocale) {
      this.locale = locale
    },
    setTheme(theme: AppTheme) {
      this.theme = theme
    }
  }
})
