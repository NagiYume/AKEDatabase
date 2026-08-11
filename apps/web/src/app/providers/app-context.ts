import { inject, shallowRef, type InjectionKey, type ShallowRef } from 'vue'
import { R2DataClient, type DataClientState } from '@ake/data-client'
import { validateAppVersion, type AppLocale, type AppVersionConfig } from '@ake/r2-contract'
import type { usePreferencesStore } from '../stores/preferences'

type PreferencesStore = ReturnType<typeof usePreferencesStore>

export interface AppContext {
  config: AppVersionConfig
  client: R2DataClient
  dataState: ShallowRef<DataClientState>
  reconfigure(options: { baseUrl?: string; selection?: string; locale?: AppLocale }): Promise<DataClientState>
}

export const APP_CONTEXT_KEY: InjectionKey<AppContext> = Symbol('ake-app-context')

export async function createAppContext(preferences: PreferencesStore): Promise<AppContext> {
  const response = await fetch('/version.json', { cache: 'no-store' })
  if (!response.ok) throw new Error(`Unable to load version.json (HTTP ${response.status})`)
  const config = validateAppVersion(await response.json())
  const client = new R2DataClient({
    baseUrl: preferences.dataBaseUrl || config.dataBaseUrl,
    appAssetBaseUrl: location.origin,
    manifestPath: config.dataManifestPath,
    selection: preferences.dataVersion,
    locale: preferences.locale
  })
  let initial: DataClientState
  try {
    initial = await client.initialize()
  } catch (error) {
    if (!preferences.dataBaseUrl) throw error
    preferences.resetDataSource()
    const fallback = new R2DataClient({
      baseUrl: config.dataBaseUrl,
      appAssetBaseUrl: location.origin,
      manifestPath: config.dataManifestPath,
      selection: 'latest',
      locale: preferences.locale
    })
    initial = await fallback.initialize()
    preferences.dataVersion = initial.selection
    const dataState = shallowRef(initial)
    return {
      config,
      client: fallback,
      dataState,
      async reconfigure(options) {
        dataState.value = await fallback.configure(options)
        preferences.dataVersion = dataState.value.selection
        return dataState.value
      }
    }
  }
  const dataState = shallowRef(initial)
  preferences.dataVersion = initial.selection
  return {
    config,
    client,
    dataState,
    async reconfigure(options) {
      dataState.value = await client.configure(options)
      preferences.dataVersion = dataState.value.selection
      return dataState.value
    }
  }
}

export function useAppContext(): AppContext {
  const context = inject(APP_CONTEXT_KEY)
  if (!context) throw new Error('App context is not available')
  return context
}
