import { describe, expect, it } from 'vitest'
import { DataClientError } from '@ake/data-client'
import { createAppI18n, userErrorMessageKey } from '../src/shared/i18n'

describe('localized user error messages', () => {
  it.each([
    ['NETWORK', undefined, 'errors.networkUnavailable'],
    ['NOT_FOUND', 404, 'errors.resourceMissing'],
    ['PARSE', undefined, 'errors.invalidData'],
    ['NOT_READY', undefined, 'errors.notReady'],
    ['ABORTED', undefined, 'errors.requestCancelled'],
    ['HTTP', 403, 'errors.accessDenied'],
    ['HTTP', 429, 'errors.serviceUnavailable'],
    ['HTTP', 503, 'errors.serviceUnavailable'],
    ['HTTP', 418, 'errors.requestFailed']
  ] as const)('maps %s/%s to %s', (code, status, expected) => {
    expect(
      userErrorMessageKey(new DataClientError('technical detail', code, 'https://example.test', status))
    ).toBe(expected)
  })

  it('uses a generic localized message for unknown errors without exposing technical details', () => {
    const error = new Error('database credentials and internal path')
    const key = userErrorMessageKey(error)
    const english = createAppI18n('EN').global.t(key)
    const chinese = createAppI18n('CH').global.t(key)

    expect(key).toBe('errors.unexpected')
    expect(english).not.toContain(error.message)
    expect(chinese).not.toContain(error.message)
    expect(english).not.toBe(chinese)
  })
})
