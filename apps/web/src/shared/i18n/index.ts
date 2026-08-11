import { createI18n, type I18n } from 'vue-i18n'
import type { R2DataClient } from '@ake/data-client'
import { LANGUAGE_INFO, type AppLocale } from '@ake/r2-contract'
import { createBuiltinMessages, type MessageSchema } from './messages'

export { userErrorMessageKey, type UserErrorMessageKey } from './user-error'

export type AppI18n = I18n<
  Record<string, unknown>,
  Record<string, unknown>,
  Record<string, unknown>,
  AppLocale,
  false
>

export function createAppI18n(locale: AppLocale) {
  return createI18n<[MessageSchema], AppLocale, false>({
    legacy: false,
    locale,
    fallbackLocale: ['CH', 'EN'],
    messages: createBuiltinMessages(),
    missingWarn: false,
    fallbackWarn: false
  })
}

export async function loadLocaleMessages(
  i18n: ReturnType<typeof createAppI18n>,
  client: R2DataClient,
  locale: AppLocale
): Promise<void> {
  document.documentElement.lang = LANGUAGE_INFO[locale].htmlLang
  try {
    const payload = await client.getJson<{ messages?: Record<string, unknown> }>({
      kind: 'locale',
      path: `public/${LANGUAGE_INFO[locale].directory}/i18n.json`
    })
    if (payload.messages) i18n.global.mergeLocaleMessage(locale, payload.messages)
  } catch {
    // Built-in messages keep the shell usable if locale data is temporarily unavailable.
  }
  i18n.global.locale.value = locale
}
