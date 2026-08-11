import { describe, expect, it } from 'vitest'
import { buildBakerCatalog, filterBakerEntries, resolveBakerEntry, type BakerEntry } from './index'

function entry(overrides: Partial<BakerEntry> = {}): BakerEntry {
  return {
    id: 'dialog-target',
    chatId: 'chat-target',
    name: 'Target contact',
    chatType: 1,
    avatarIcon: '',
    dialogLabel: 'Target conversation',
    preview: '',
    topicId: '',
    topicName: '',
    searchText: 'dialog-target\nchat-target\ntarget contact',
    dialogue: null,
    ...overrides
  }
}

describe('baker entity resolution', () => {
  it('restores a dialogue or chat entity independently of display filters', () => {
    const target = entry()
    const other = entry({
      id: 'dialog-other',
      chatId: 'chat-other',
      name: 'Other group',
      chatType: 2,
      searchText: 'dialog-other\nchat-other\nother group'
    })
    const entries = [target, other]

    expect(filterBakerEntries(entries, { search: 'other', type: '2' })).toEqual([other])
    expect(resolveBakerEntry(entries, target.id)).toBe(target)
    expect(resolveBakerEntry(entries, target.chatId)).toBe(target)
  })

  it('parses legacy reaction participants and counts from type 9 messages', () => {
    const catalog = buildBakerCatalog({
      SNSChatTable: {
        chat_target: { name: 'Target', chatType: 1 },
        npc_alice: { name: 'Alice' }
      },
      SNSDialogTable: {
        dialog_target: {
          chatId: 'chat_target',
          dialogContentData: {
            1: {
              contentId: 1,
              preContentId: 0,
              contentType: 9,
              contentParams: JSON.stringify([
                { emojiResPath: 'sns_emoji_001', npcIds: ['npc_alice'], npcCount: 1 }
              ])
            }
          }
        }
      }
    })

    expect(
      catalog.entries.find((value) => value.id === 'dialog_target')?.dialogue?.nodes['1']?.reactions
    ).toEqual([{ resourceId: 'sns_emoji_001', people: ['Alice'], count: 1 }])
  })
})
