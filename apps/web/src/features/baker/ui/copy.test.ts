import { describe, expect, it } from 'vitest'
import { BAKER_CHAT_TYPES } from '../model'
import { bakerChatTypeCopyKey, bakerContentTypeCopyKey, bakerFallback } from './copy'

describe('baker copy', () => {
  it('provides Chinese and English labels for every chat and content type', () => {
    for (const value of Object.keys(BAKER_CHAT_TYPES).map(Number)) {
      const key = bakerChatTypeCopyKey(value)
      expect(bakerFallback(key, 'CH')).toBeTruthy()
      expect(bakerFallback(key, 'EN')).toBeTruthy()
    }

    for (const value of [1, 2, 4, 5, 6, 7, 8, 9, 10, 11, 12]) {
      const key = bakerContentTypeCopyKey(value)
      expect(bakerFallback(key, 'CH', { type: value })).toBeTruthy()
      expect(bakerFallback(key, 'EN', { type: value })).toBeTruthy()
    }
  })

  it('falls back to English for locales without module copy and labels unknown enums', () => {
    expect(bakerFallback(bakerChatTypeCopyKey(3), 'KR')).toBe('Operator')
    expect(bakerFallback(bakerChatTypeCopyKey(99), 'CH')).toBe('会话')
    expect(bakerFallback(bakerContentTypeCopyKey(99), 'EN', { type: 99 })).toBe('Message type 99')
  })
})
