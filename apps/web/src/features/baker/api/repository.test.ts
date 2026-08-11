import { describe, expect, it, vi } from 'vitest'
import { DataClientError, type R2DataClient } from '@ake/data-client'
import type { RawTable } from '@ake/domain'
import type { R2VersionEntry } from '@ake/r2-contract'
import { BakerRepository } from './repository'

const VERSION: R2VersionEntry = {
  id: '1.2.0-h1',
  gameVersion: '1.2.0',
  hotfixVersion: '1',
  tableCfgPath: 'TableCfg/1.2.0-h1',
  publishedAt: '2026-08-01T00:00:00Z'
}

describe('BakerRepository locale fallback', () => {
  it('uses the Chinese base text when the selected locale entry is empty', async () => {
    const getTable = vi.fn(async (name: string): Promise<RawTable> => {
      if (name === 'I18nTextTable_CN') return { chat_name: '中文联系人' }
      if (name === 'I18nTextTable_EN') return { chat_name: '' }
      if (name === 'SNSChatTable') {
        return {
          chat: {
            name: { id: 'chat_name', text: '' },
            chatType: 1
          }
        }
      }
      return {}
    })
    const client = {
      state: {
        baseUrl: 'https://data.example.test',
        selected: VERSION,
        locale: 'EN'
      },
      getTable
    } as unknown as R2DataClient

    const catalog = await new BakerRepository(client).catalog()

    expect(catalog.entries[0]?.name).toBe('中文联系人')
    expect(getTable).toHaveBeenCalledWith('I18nTextTable_CN', expect.anything(), VERSION)
    expect(getTable).toHaveBeenCalledWith('I18nTextTable_EN', expect.anything(), VERSION)
  })

  it('evicts transient translation and dependent table failures before retrying', async () => {
    let englishAttempts = 0
    const getTable = vi.fn(async (name: string): Promise<RawTable> => {
      if (name === 'I18nTextTable_CN') return { chat_name: '中文联系人' }
      if (name === 'I18nTextTable_EN') {
        englishAttempts += 1
        if (englishAttempts === 1) throw new DataClientError('translation timeout', 'NETWORK', name)
        return { chat_name: 'English contact' }
      }
      if (name === 'SNSChatTable') {
        return { chat: { name: { id: 'chat_name', text: '' }, chatType: 1 } }
      }
      return {}
    })
    const client = {
      state: { baseUrl: 'https://data.example.test', selected: VERSION, locale: 'EN' },
      getTable
    } as unknown as R2DataClient
    const repository = new BakerRepository(client)

    await expect(repository.catalog()).rejects.toMatchObject({ code: 'NETWORK' })
    await expect(repository.catalog()).resolves.toMatchObject({
      entries: [expect.objectContaining({ name: 'English contact' })]
    })

    expect(englishAttempts).toBe(2)
    expect(getTable.mock.calls.filter(([name]) => name === 'SNSChatTable')).toHaveLength(2)
  })

  it('degrades only typed missing tables and translations to the Chinese fallback', async () => {
    const getTable = vi.fn(async (name: string): Promise<RawTable> => {
      if (name === 'I18nTextTable_CN') return { chat_name: '中文联系人' }
      if (name === 'I18nTextTable_EN' || name === 'SNSDialogTable') {
        throw new DataClientError('missing table', 'NOT_FOUND', name, 404)
      }
      if (name === 'SNSChatTable') {
        return { chat: { name: { id: 'chat_name', text: '' }, chatType: 1 } }
      }
      return {}
    })
    const client = {
      state: { baseUrl: 'https://data.example.test', selected: VERSION, locale: 'EN' },
      getTable
    } as unknown as R2DataClient

    await expect(new BakerRepository(client).catalog()).resolves.toMatchObject({
      entries: [expect.objectContaining({ name: '中文联系人' })]
    })
  })
})
