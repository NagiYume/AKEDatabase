import { asRecord, textValue, type RawRecord, type TableSet } from '@ake/domain'

export const BAKER_CHAT_TYPES = Object.freeze({
  1: { order: 2 },
  2: { order: 3 },
  3: { order: 1 }
} satisfies Readonly<Record<number, { order: number }>>)

export interface BakerOption {
  id: string
  text: string
  resourceId: string
  nextContentId: number | null
}

export interface BakerReaction {
  resourceId: string
  people: string[]
  count: number
}

export interface BakerMessage {
  id: string
  contentId: number
  previousContentId: number
  nextContentId: number | null
  speakerId: string
  speakerName: string
  speakerIcon: string
  self: boolean
  contentType: number
  text: string
  contentParams: string
  parameters: string[]
  pictureIds: string[]
  attachmentTitle: string
  attachmentDetail: string
  relatedMissionId: string
  optionIds: string[]
  reactions: BakerReaction[]
}

export interface BakerDialogue {
  id: string
  chatId: string
  relatedMissionId: string
  notice: boolean
  startContentId: number | null
  nodes: Record<string, BakerMessage>
  options: Record<string, BakerOption>
}

export interface BakerEntry {
  id: string
  chatId: string
  name: string
  chatType: number
  avatarIcon: string
  dialogLabel: string
  preview: string
  topicId: string
  topicName: string
  searchText: string
  dialogue: BakerDialogue | null
}

export interface BakerCatalog {
  entries: BakerEntry[]
  totalCount: number
  recordedCount: number
  contactCount: number
  groupCount: number
  operatorCount: number
}

export type BakerTimelineItem =
  | { kind: 'message'; message: BakerMessage }
  | { kind: 'choice'; contentId: number; options: BakerOption[]; selectedId: string }

function stringValue(value: unknown, fallback = ''): string {
  return value === undefined || value === null ? fallback : String(value)
}

function numberValue(value: unknown, fallback = 0): number {
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item) => item !== null && item !== undefined).map(String) : []
}

function naturalCompare(left: string, right: string): number {
  return left.localeCompare(right, 'zh-CN', { numeric: true, sensitivity: 'base' })
}

function typeDefinition(value: unknown): { order: number } {
  const definitions: Readonly<Record<number, { order: number }>> = BAKER_CHAT_TYPES
  return definitions[numberValue(value)] ?? { order: 9 }
}

function fallbackChatType(chatId: string): number {
  if (chatId.startsWith('sns_chr_')) return 3
  if (chatId.startsWith('sns_chat_')) return 2
  return 1
}

function parseJsonRecord(value: string): RawRecord {
  if (!value) return {}
  try {
    return asRecord(JSON.parse(value))
  } catch {
    return {}
  }
}

function reactionList(value: string, chats: Record<string, unknown>): BakerReaction[] {
  if (!value) return []
  try {
    const parsed: unknown = JSON.parse(value)
    if (!Array.isArray(parsed)) return []
    return parsed.map((item): BakerReaction => {
      const reaction = asRecord(item)
      const people = stringList(reaction.npcIds).map((id) => textValue(asRecord(chats[id]).name, id))
      return {
        resourceId: stringValue(reaction.emojiResPath),
        people,
        count: numberValue(reaction.npcCount, people.length)
      }
    })
  } catch {
    return []
  }
}

function speaker(
  chatId: string,
  selectedChat: RawRecord,
  chats: Record<string, unknown>
): { id: string; name: string; icon: string; self: boolean } {
  if (!chatId || chatId === 'endmin' || chatId === 'player')
    return { id: 'endmin', name: '', icon: '', self: true }
  const chat = asRecord(chats[chatId] ?? selectedChat)
  return {
    id: chatId,
    name: textValue(chat.name, chatId),
    icon: stringValue(chat.icon).toLocaleLowerCase(),
    self: false
  }
}

function attachment(
  node: RawRecord,
  items: Record<string, unknown>,
  chats: Record<string, unknown>
): { title: string; detail: string; pictures: string[] } {
  const type = numberValue(node.contentType, 1)
  const parameters = stringList(node.contentParam)
  if (type === 2) return { title: '', detail: '', pictures: parameters }
  if (type === 4) return { title: parameters[1] ?? parameters[0] ?? '', detail: '', pictures: [] }
  if (type === 5)
    return {
      title: textValue(node.content, parameters[0] ?? ''),
      detail: parameters.join(' · '),
      pictures: []
    }
  if (type === 6) {
    const id = parameters[0] ?? ''
    return { title: textValue(asRecord(items[id]).name, id), detail: id, pictures: [] }
  }
  if (type === 8) {
    const id = parameters[0] ?? ''
    return { title: textValue(asRecord(chats[id]).name, id), detail: parameters[1] ?? id, pictures: [] }
  }
  if (type === 10) {
    const archive = parseJsonRecord(stringValue(node.contentParams))
    return { title: stringValue(archive.id), detail: stringValue(archive.phaseId), pictures: [] }
  }
  if (type === 12) {
    const id = stringValue(node.linkMissionId, parameters[0] ?? '')
    return { title: id, detail: '', pictures: [] }
  }
  return { title: '', detail: '', pictures: [] }
}

function buildDialogue(
  id: string,
  row: RawRecord,
  selectedChat: RawRecord,
  chats: Record<string, unknown>,
  optionTable: Record<string, unknown>,
  items: Record<string, unknown>
): BakerDialogue {
  const nodes = Object.fromEntries(
    Object.entries(asRecord(row.dialogContentData))
      .filter(([key]) => numberValue(key, -1) >= 0)
      .map(([key, value]) => {
        const node = asRecord(value)
        const contentId = numberValue(node.contentId, numberValue(key))
        const person = speaker(stringValue(node.speaker), selectedChat, chats)
        const media = attachment(node, items, chats)
        const parsed: BakerMessage = {
          id: `${id}#${contentId}`,
          contentId,
          previousContentId: numberValue(node.preContentId),
          nextContentId: numberValue(node.nextContentId, -1) >= 0 ? numberValue(node.nextContentId) : null,
          speakerId: person.id,
          speakerName: person.name,
          speakerIcon: person.icon,
          self: person.self,
          contentType: numberValue(node.contentType, 1),
          text: textValue(node.content),
          contentParams: stringValue(node.contentParams),
          parameters: stringList(node.contentParam),
          pictureIds: media.pictures,
          attachmentTitle: media.title,
          attachmentDetail: media.detail,
          relatedMissionId: stringValue(node.linkMissionId),
          optionIds: stringList(node.dialogOptionIds),
          reactions: reactionList(stringValue(node.contentParams), chats)
        }
        return [String(contentId), parsed]
      })
  )
  const options: Record<string, BakerOption> = {}
  for (const node of Object.values(nodes)) {
    for (const optionId of node.optionIds) {
      const option = asRecord(optionTable[optionId])
      const next = numberValue(option.optionNextContentId, -1)
      options[optionId] = {
        id: optionId,
        text: textValue(option.optionDesc, stringValue(option.optionResPath, optionId)),
        resourceId: stringValue(option.optionResPath),
        nextContentId: next >= 0 ? next : null
      }
    }
  }
  const startCandidate = Object.values(nodes)
    .filter((node) => node.previousContentId === 0)
    .toSorted((left, right) => left.contentId - right.contentId)[0]
  const first = Object.values(nodes).toSorted((left, right) => left.contentId - right.contentId)[0]
  return {
    id,
    chatId: stringValue(row.chatId),
    relatedMissionId: stringValue(row.relatedMissionId),
    notice: Boolean(row.noticeType),
    startContentId: startCandidate?.contentId ?? first?.contentId ?? null,
    nodes,
    options
  }
}

function preview(dialogue: BakerDialogue): string {
  const nodes = Object.values(dialogue.nodes).toSorted((left, right) => right.contentId - left.contentId)
  const content = nodes.find((node) => node.text)?.text ?? ''
  if (content)
    return content
      .replace(/<[^>]+>/g, '')
      .replace(/\s+/g, ' ')
      .trim()
  return ''
}

export function buildBakerCatalog(tables: TableSet): BakerCatalog {
  const chats = tables.SNSChatTable ?? {}
  const dialogs = tables.SNSDialogTable ?? {}
  const optionTable = tables.SNSDialogOptionTable ?? {}
  const topics = tables.SNSDialogTopicTable ?? {}
  const items = tables.ItemTable ?? {}
  const dialogsByChat = new Map<string, Array<{ id: string; row: RawRecord }>>()
  for (const [id, value] of Object.entries(dialogs)) {
    const row = asRecord(value)
    const chatId = stringValue(row.chatId)
    if (!chatId) continue
    const values = dialogsByChat.get(chatId) ?? []
    values.push({ id, row })
    dialogsByChat.set(chatId, values)
  }
  const topicByDialog = new Map<string, RawRecord>()
  for (const value of Object.values(topics)) {
    const topic = asRecord(value)
    for (const dialogId of stringList(topic.includeDialogIds)) topicByDialog.set(dialogId, topic)
  }

  const chatIds = new Set([...Object.keys(chats), ...dialogsByChat.keys()])
  const entries: BakerEntry[] = []
  for (const chatId of chatIds) {
    const chat = asRecord(chats[chatId])
    const chatType = numberValue(chat.chatType, fallbackChatType(chatId))
    const name = textValue(chat.name, chatId)
    const related = (dialogsByChat.get(chatId) ?? []).toSorted((left, right) =>
      naturalCompare(left.id, right.id)
    )
    const rows: Array<{ id: string; row: RawRecord } | null> = related.length ? related : [null]
    for (const value of rows) {
      const dialogId = value?.id ?? chatId
      const row = value?.row ?? {}
      const topicId = stringValue(row.topicId)
      const topic = asRecord(topics[topicId] ?? topicByDialog.get(dialogId))
      const dialogue = value ? buildDialogue(dialogId, row, chat, chats, optionTable, items) : null
      const topicName = textValue(topic.topicName, textValue(topic.topicStartOptionDesc))
      const dialogLabel = topicName || dialogId
      const summary = dialogue ? preview(dialogue) : ''
      const messageText = dialogue ? Object.values(dialogue.nodes).map((node) => node.text) : []
      const optionText = dialogue ? Object.values(dialogue.options).map((option) => option.text) : []
      entries.push({
        id: dialogId,
        chatId,
        name,
        chatType,
        avatarIcon: stringValue(chat.icon).toLocaleLowerCase(),
        dialogLabel,
        preview: summary,
        topicId: stringValue(topic.topicId, topicId),
        topicName,
        searchText: [chatId, dialogId, name, dialogLabel, summary, ...messageText, ...optionText]
          .filter(Boolean)
          .join('\n')
          .toLocaleLowerCase(),
        dialogue
      })
    }
  }
  entries.sort(
    (left, right) =>
      typeDefinition(left.chatType).order - typeDefinition(right.chatType).order ||
      Number(right.dialogue !== null) - Number(left.dialogue !== null) ||
      naturalCompare(left.name, right.name) ||
      naturalCompare(left.id, right.id)
  )
  return {
    entries,
    totalCount: entries.length,
    recordedCount: entries.filter((entry) => entry.dialogue !== null).length,
    contactCount: entries.filter((entry) => entry.chatType === 1).length,
    groupCount: entries.filter((entry) => entry.chatType === 2).length,
    operatorCount: entries.filter((entry) => entry.chatType === 3).length
  }
}

export function filterBakerEntries(
  entries: readonly BakerEntry[],
  options: { search?: string; type?: string }
): BakerEntry[] {
  const search = options.search?.trim().toLocaleLowerCase() ?? ''
  return entries.filter((entry) => {
    if (options.type && options.type !== 'all' && String(entry.chatType) !== options.type) return false
    return !search || entry.searchText.includes(search)
  })
}

export function resolveBakerEntry(entries: readonly BakerEntry[], id: string): BakerEntry | null {
  if (!id) return null
  return entries.find((entry) => entry.id === id) ?? entries.find((entry) => entry.chatId === id) ?? null
}

export function buildBakerTimeline(
  dialogue: BakerDialogue,
  choices: Readonly<Record<string, string>>
): BakerTimelineItem[] {
  const output: BakerTimelineItem[] = []
  const visited = new Set<number>()
  let contentId = dialogue.startContentId
  while (contentId !== null && contentId >= 0 && !visited.has(contentId) && output.length < 1_000) {
    visited.add(contentId)
    const node = dialogue.nodes[String(contentId)]
    if (!node) break
    output.push({ kind: 'message', message: node })
    const options = node.optionIds
      .map((id) => dialogue.options[id])
      .filter((option): option is BakerOption => Boolean(option))
    if (options.length) {
      const selected = options.find((option) => option.id === choices[String(contentId)]) ?? options[0]
      if (!selected) break
      output.push({ kind: 'choice', contentId, options, selectedId: selected.id })
      contentId = selected.nextContentId
      continue
    }
    if (node.nextContentId !== null && node.nextContentId !== 0) {
      contentId = node.nextContentId
      continue
    }
    const next = Object.values(dialogue.nodes).find(
      (candidate) => candidate.previousContentId === node.contentId && !visited.has(candidate.contentId)
    )
    contentId = next?.contentId ?? null
  }
  return output
}
