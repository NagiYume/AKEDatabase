import { describe, expect, it } from 'vitest'
import type { AppLocale } from '@ake/r2-contract'
import { createAppI18n } from '.'
import { createBuiltinMessages } from './messages'

function searchMessage(i18n: ReturnType<typeof createAppI18n>, locale: AppLocale): unknown {
  const messages = i18n.global.getLocaleMessage(locale) as { common?: { search?: unknown } }
  return messages.common?.search
}

describe('application i18n', () => {
  it('creates an independent message tree for every locale', () => {
    const messages = createBuiltinMessages()
    const localeMessages = Object.values(messages)

    expect(new Set(localeMessages)).toHaveLength(14)
    expect(new Set(localeMessages.map((message) => message.common))).toHaveLength(14)
  })

  it('does not leak merged messages across locales or i18n instances', () => {
    const i18n = createAppI18n('EN')

    i18n.global.mergeLocaleMessage('EN', { common: { search: 'Merged English search' } })
    expect(searchMessage(i18n, 'EN')).toBe('Merged English search')
    expect(searchMessage(i18n, 'DE')).toBe('Search')
    expect(searchMessage(i18n, 'JP')).toBe('Search')

    i18n.global.mergeLocaleMessage('JP', { common: { search: 'Merged Japanese search' } })
    expect(searchMessage(i18n, 'EN')).toBe('Merged English search')
    expect(searchMessage(i18n, 'DE')).toBe('Search')
    expect(searchMessage(i18n, 'JP')).toBe('Merged Japanese search')

    expect(searchMessage(createAppI18n('EN'), 'EN')).toBe('Search')
  })
})
