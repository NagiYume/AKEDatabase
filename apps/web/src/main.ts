import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import App from './App.vue'
import { createAppRouter } from './app/router'
import { APP_CONTEXT_KEY, createAppContext } from './app/providers/app-context'
import { usePreferencesStore } from './app/stores/preferences'
import type { AppLocale } from '@ake/r2-contract'
import { createAppI18n, loadLocaleMessages } from './shared/i18n'
import { renderStartupError } from './shared/i18n/startup-error'
import '@ake/ui/styles.css'
import './shared/styles/app.css'

let startupLocale: AppLocale = 'CH'

async function start(): Promise<void> {
  const app = createApp(App)
  const pinia = createPinia()
  app.use(pinia)
  const preferences = usePreferencesStore(pinia)
  startupLocale = preferences.locale
  preferences.installPersistence()
  document.documentElement.dataset.theme = preferences.theme

  const i18n = createAppI18n(preferences.locale)
  const context = await createAppContext(preferences)
  await loadLocaleMessages(i18n, context.client, preferences.locale)

  app.provide(APP_CONTEXT_KEY, context)
  app.use(i18n)
  app.use(createAppRouter(preferences))
  app.use(VueQueryPlugin, {
    queryClient: new QueryClient({
      defaultOptions: {
        queries: { staleTime: 5 * 60_000, gcTime: 30 * 60_000, retry: 1, refetchOnWindowFocus: false }
      }
    })
  })
  app.mount('#app')
}

void start().catch((error: unknown) => {
  console.error('AKEData startup failed', error)
  const root = document.querySelector('#app')
  if (!root) return
  renderStartupError(root, startupLocale)
})
