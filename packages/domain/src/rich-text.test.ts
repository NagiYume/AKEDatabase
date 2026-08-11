import { describe, expect, it } from 'vitest'
import { parseControlledRichText } from './index'

describe('controlled rich text', () => {
  it('keeps game style text while removing its control tags', () => {
    const tokens = parseControlledRichText('造成<@ba.pd>物理伤害</>，并附着<@ba.key>源石结晶</>。')

    expect(tokens).toEqual([
      { type: 'text', value: '造成' },
      { type: 'text', value: '物理伤害', strong: true },
      { type: 'text', value: '，并附着' },
      { type: 'text', value: '源石结晶', strong: true },
      { type: 'text', value: '。' }
    ])
  })

  it('supports nested semantic markers without leaking closing tags', () => {
    const tokens = parseControlledRichText('<@outer>A<#inner>B</>C</>D')

    expect(tokens.map((token) => token.value).join('')).toBe('ABCD')
    expect(tokens.slice(0, 3).every((token) => token.strong)).toBe(true)
    expect(tokens.at(-1)?.strong).toBeUndefined()
  })
})
