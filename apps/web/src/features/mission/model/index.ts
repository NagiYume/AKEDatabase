import { asRecord, textValue, type RawRecord, type TableSet } from '@ake/domain'

export interface MissionEnumDefinition {
  value: number
  visible: boolean
}

export const MISSION_TYPES = Object.freeze({
  Main: { value: 0, visible: true },
  Char: { value: 1, visible: true },
  Factory: { value: 2, visible: true },
  Hide: { value: 4, visible: false },
  Misc: { value: 5, visible: true },
  World: { value: 7, visible: true },
  WeekRaid: { value: 8, visible: false },
  FakeMain: { value: 9, visible: true },
  Side: { value: 10, visible: true },
  Activity: { value: 11, visible: true },
  TBCMain: { value: 12, visible: true }
} satisfies Readonly<Record<string, MissionEnumDefinition>>)

export const MISSION_CHAPTERS = Object.freeze({
  None: { value: 0, visible: true },
  ChapterOne: { value: 1, visible: true },
  ChapterTwo: { value: 2, visible: true }
} satisfies Readonly<Record<string, MissionEnumDefinition>>)

export const MISSION_IMPORTANCE = Object.freeze({
  High: { value: 1, visible: true },
  Mid: { value: 2, visible: true },
  Low: { value: 3, visible: true }
} satisfies Readonly<Record<string, MissionEnumDefinition>>)

export const MISSION_QUEST_TYPES = Object.freeze({
  Normal: { value: 0, visible: true },
  Block: { value: 1, visible: true },
  Optional: { value: 2, visible: true }
} satisfies Readonly<Record<string, MissionEnumDefinition>>)

const LEGACY_TYPE_NAMES = Object.fromEntries(
  Object.entries(MISSION_TYPES).map(([name, definition]) => [definition.value, name])
)
const LEGACY_CHAPTER_NAMES = Object.fromEntries(
  Object.entries(MISSION_CHAPTERS).map(([name, definition]) => [definition.value, name])
)
const LEGACY_IMPORTANCE_NAMES = Object.fromEntries(
  Object.entries(MISSION_IMPORTANCE).map(([name, definition]) => [definition.value, name])
)
const LEGACY_QUEST_TYPE_NAMES = Object.fromEntries(
  Object.entries(MISSION_QUEST_TYPES).map(([name, definition]) => [definition.value, name])
)

export interface MissionIndexEntry {
  id: string
  name: string
  contentFile: string
  type: string
  typeValue: number
  chapter: string
  chapterValue: number
  importance: string
  importanceValue: number
  questCount: number
  objectiveCount: number
  priority: number
  hidden: boolean
  searchText: string
  view?: string
  metaContentFile?: string
}

export interface MissionCatalog {
  entries: MissionIndexEntry[]
  missionCount: number
  questCount: number
  objectiveCount: number
  metaCount: number
}

export interface MissionObjective {
  id: string
  description: string
  condition: string
}

export interface MissionRewardItem {
  id: string
  name: string
  count: number
  iconId: string
  probable: boolean
}

export interface MissionReward {
  id: string
  source: string
  items: MissionRewardItem[]
}

export interface MissionQuest {
  id: string
  type: string
  flowIndex: number
  previousIds: string[]
  description: string
  objectives: MissionObjective[]
  requiredItemIds: string[]
  reward: MissionReward | null
}

export type DialogueSpeakerRole = 'named' | 'system' | 'administrator' | 'narrator'

export interface DialogueLine {
  id: string
  speaker: string
  speakerRole: DialogueSpeakerRole
  text: string
  hint: string
  avatar: string
  audio: string
  contentType: number
}

export interface DialogueOption {
  id: string
  text: string
  nextContentId: number | null
}

export interface StandardDialogueGroup {
  kind: 'dialogue'
  id: string
  lines: DialogueLine[]
  options: DialogueOption[]
  summaries: string[]
}

export interface SnsDialogueNode extends DialogueLine {
  contentId: number
  nextContentId: number | null
  optionIds: string[]
}

export interface SnsDialogueGroup {
  kind: 'sns'
  id: string
  chatId: string
  startContentId: number | null
  nodes: Record<string, SnsDialogueNode>
  options: Record<string, DialogueOption>
  missing: boolean
}

export type MissionDialogueGroup = StandardDialogueGroup | SnsDialogueGroup

export interface MissionDetail {
  entry: MissionIndexEntry
  description: string
  levelId: string
  levelName: string
  characterId: string
  characterName: string
  extraInfo: string
  scope: string
  acceptMode: string
  quests: MissionQuest[]
  missionReward: MissionReward | null
  rewards: MissionReward[]
  dialogues: MissionDialogueGroup[]
  radioIds: string[]
}

export type SnsTimelineItem =
  | { kind: 'line'; line: SnsDialogueNode }
  | { kind: 'choice'; contentId: number; options: DialogueOption[]; selectedId: string }

function naturalCompare(left: string, right: string): number {
  return left.localeCompare(right, 'zh-CN', { numeric: true, sensitivity: 'base' })
}

function stringValue(value: unknown, fallback = ''): string {
  return value === undefined || value === null ? fallback : String(value)
}

function numberValue(value: unknown, fallback = 0): number {
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

function recordList(value: unknown): RawRecord[] {
  return Array.isArray(value) ? value.map(asRecord) : []
}

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String) : []
}

function enumName(value: unknown, legacy: Readonly<Record<string, string>>, fallback: string): string {
  const raw = stringValue(value, fallback)
  return legacy[raw] ?? raw
}

function enumDefinition(
  value: unknown,
  definitions: Readonly<Record<string, MissionEnumDefinition>>,
  legacy: Readonly<Record<string, string>>,
  fallback: string
): { name: string; definition: MissionEnumDefinition } {
  const name = enumName(value, legacy, fallback)
  return { name, definition: definitions[name] ?? { value: numberValue(value, -1), visible: true } }
}

function tableText(table: Record<string, unknown>, key: unknown, fallback = ''): string {
  const normalized = stringValue(key)
  if (!normalized) return fallback
  const row = asRecord(table[normalized])
  return textValue(row.text, textValue(row, fallback || normalized))
}

function textKey(value: unknown): string {
  const record = asRecord(value)
  return stringValue(record.key)
}

export function buildMissionCatalog(
  manifest: unknown,
  typeInfo: Record<string, unknown>,
  textTable: Record<string, unknown>
): MissionCatalog {
  const rows = Array.isArray(manifest) ? manifest.map(asRecord) : []
  const metaById = new Map(
    rows
      .filter((row) => stringValue(row.id).endsWith('_meta'))
      .map((row) => [stringValue(row.id).slice(0, -5), stringValue(row.contentFile)] as const)
  )
  const entries = rows
    .filter(
      (row) => stringValue(row.id) && stringValue(row.contentFile) && !stringValue(row.id).endsWith('_meta')
    )
    .map((row): MissionIndexEntry => {
      const id = stringValue(row.id)
      const type = enumDefinition(row.missionType, MISSION_TYPES, LEGACY_TYPE_NAMES, 'Misc')
      const chapter = enumDefinition(
        row.missionChapterBitmask,
        MISSION_CHAPTERS,
        LEGACY_CHAPTER_NAMES,
        'None'
      )
      const importance = enumDefinition(
        row.missionImportance,
        MISSION_IMPORTANCE,
        LEGACY_IMPORTANCE_NAMES,
        'Low'
      )
      const nameKey = textKey(row.missionName)
      const name = tableText(textTable, nameKey, stringValue(row.name, id))
      const typeConfiguration = asRecord(typeInfo[String(type.definition.value)])
      const typeVisible =
        typeConfiguration.isVisible === undefined
          ? type.definition.visible
          : Boolean(typeConfiguration.isVisible)
      const metaContentFile = metaById.get(id)
      return {
        id,
        name,
        contentFile: stringValue(row.contentFile),
        type: type.name,
        typeValue: type.definition.value,
        chapter: chapter.name,
        chapterValue: chapter.definition.value,
        importance: importance.name,
        importanceValue: importance.definition.value,
        questCount: numberValue(row.questCount),
        objectiveCount: numberValue(row.objectiveCount),
        priority: numberValue(row.priority),
        hidden: row.hidden === true || !typeVisible,
        view: stringValue(typeConfiguration.view),
        searchText: [id, name, nameKey, type.name, chapter.name, importance.name]
          .join('\n')
          .toLocaleLowerCase(),
        ...(metaContentFile ? { metaContentFile } : {})
      }
    })
    .toSorted(
      (left, right) =>
        left.typeValue - right.typeValue ||
        left.importanceValue - right.importanceValue ||
        left.priority - right.priority ||
        naturalCompare(left.id, right.id)
    )

  return {
    entries,
    missionCount: entries.length,
    questCount: entries.reduce((total, entry) => total + entry.questCount, 0),
    objectiveCount: entries.reduce((total, entry) => total + entry.objectiveCount, 0),
    metaCount: metaById.size
  }
}

export function filterMissions(
  entries: readonly MissionIndexEntry[],
  options: {
    search?: string
    type?: string
    chapter?: string
    showHidden?: boolean
    localizedSearchText?: (entry: MissionIndexEntry) => string
  }
): MissionIndexEntry[] {
  const search = options.search?.trim().toLocaleLowerCase() ?? ''
  return entries.filter((entry) => {
    if (!options.showHidden && entry.hidden) return false
    if (options.type && options.type !== 'all' && entry.type !== options.type) return false
    if (options.chapter && options.chapter !== 'all' && entry.chapter !== options.chapter) return false
    const localizedSearchText = options.localizedSearchText?.(entry).toLocaleLowerCase() ?? ''
    return !search || entry.searchText.includes(search) || localizedSearchText.includes(search)
  })
}

export function resolveMissionEntry(
  entries: readonly MissionIndexEntry[],
  id: string,
  showHidden = false
): MissionIndexEntry | null {
  if (!id) return null
  return entries.find((entry) => entry.id === id && (showHidden || !entry.hidden)) ?? null
}

function sortedQuests(mission: RawRecord): Array<{ id: string; row: RawRecord }> {
  const entries = Object.entries(asRecord(mission.questDic)).map(([key, value]) => ({
    id: key,
    row: asRecord(value)
  }))
  const byId = new Map(entries.map((entry) => [entry.id, entry]))
  const indegree = new Map(entries.map((entry) => [entry.id, 0]))
  const next = new Map(entries.map((entry) => [entry.id, [] as string[]]))
  for (const entry of entries) {
    for (const previous of stringList(entry.row.prevQuestIdList)) {
      if (!byId.has(previous)) continue
      indegree.set(entry.id, (indegree.get(entry.id) ?? 0) + 1)
      next.get(previous)?.push(entry.id)
    }
  }
  const compare = (left: { id: string; row: RawRecord }, right: { id: string; row: RawRecord }) =>
    numberValue(left.row.flowIndex) - numberValue(right.row.flowIndex) || naturalCompare(left.id, right.id)
  const queue = entries.filter((entry) => indegree.get(entry.id) === 0).toSorted(compare)
  const output: Array<{ id: string; row: RawRecord }> = []
  while (queue.length) {
    const current = queue.shift()
    if (!current) break
    output.push(current)
    for (const id of next.get(current.id) ?? []) {
      indegree.set(id, (indegree.get(id) ?? 1) - 1)
      const nextEntry = byId.get(id)
      if (indegree.get(id) === 0 && nextEntry) queue.push(nextEntry)
    }
    queue.sort(compare)
  }
  const seen = new Set(output.map((entry) => entry.id))
  output.push(...entries.filter((entry) => !seen.has(entry.id)).toSorted(compare))
  return output
}

function rewardById(id: string, source: string, tables: TableSet): MissionReward | null {
  if (!id) return null
  const reward = asRecord(tables.RewardTable?.[id])
  const definite = recordList(reward.itemBundles).map((bundle) => ({ bundle, probable: false }))
  const probable = recordList(reward.probItemBundles).map((bundle) => ({ bundle, probable: true }))
  const items = [...definite, ...probable].map(({ bundle, probable: isProbable }): MissionRewardItem => {
    const itemId = stringValue(bundle.id)
    const item = asRecord(tables.ItemTable?.[itemId])
    return {
      id: itemId,
      name: textValue(item.name, itemId),
      count: numberValue(bundle.count, 1),
      iconId: stringValue(item.iconId, itemId),
      probable: isProbable
    }
  })
  return { id, source, items }
}

interface DialogueReferences {
  dialogue: Set<string>
  sns: Set<string>
  radio: Set<string>
  order: Map<string, number>
}

function walk(value: unknown, visit: (record: RawRecord) => void, seen = new WeakSet<object>()): void {
  if (!value || typeof value !== 'object' || seen.has(value)) return
  seen.add(value)
  if (Array.isArray(value)) {
    for (const child of value) walk(child, visit, seen)
    return
  }
  const record = asRecord(value)
  visit(record)
  for (const child of Object.values(record)) walk(child, visit, seen)
}

function collectDialogueReferences(
  missionId: string,
  mission: RawRecord,
  tables: TableSet
): DialogueReferences {
  const references: DialogueReferences = {
    dialogue: new Set(),
    sns: new Set(),
    radio: new Set(),
    order: new Map()
  }
  let sequence = 0
  const add = (kind: 'dialogue' | 'sns' | 'radio', value: unknown) => {
    const id = stringValue(value)
    if (!id) return
    references[kind].add(id)
    if (!references.order.has(id)) references.order.set(id, sequence++)
  }
  walk(mission, (record) => {
    const dialogId = stringValue(asRecord(record._dialogId).constValue, stringValue(record.dialogId))
    if (dialogId.startsWith('dlg_')) add('dialogue', dialogId)
    if (dialogId.startsWith('sns_')) add('sns', dialogId)
    add('sns', record.snsDialogId)
    add('radio', asRecord(record._radioId).constValue)
  })
  const pattern = new RegExp(`^(dlg_${missionId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}_.+)_\\d{3}$`)
  for (const key of Object.keys(tables.DialogTextTable ?? {})) {
    const match = key.match(pattern)
    if (match?.[1]) references.dialogue.add(match[1])
  }
  for (const [id, value] of Object.entries(tables.SNSDialogTable ?? {})) {
    const row = asRecord(value)
    if (stringValue(row.relatedMissionId) === missionId || id.startsWith(`sns_${missionId}_`))
      references.sns.add(id)
  }
  return references
}

function speaker(value: unknown, tables: TableSet): { name: string; role: DialogueSpeakerRole } {
  const raw = stringValue(value)
  if (!raw) return { name: '', role: 'system' }
  if (raw === 'endmin') return { name: '', role: 'administrator' }
  const id = raw.replace(/^sns_(?:npc|chr)_/, '')
  const chat = asRecord(tables.SNSChatTable?.[raw])
  const npc = asRecord(tables.NpcTable?.[id])
  return { name: textValue(chat.name, textValue(npc.name, id || raw)), role: 'named' }
}

function dialogueAvatar(value: unknown, tables: TableSet): string {
  const raw = stringValue(value).trim()
  if (!raw) return ''
  const alias = raw.replace(/^sns_(?:npc|chr)_/, '').replace(/^chr_\d+_/, '')
  const overrides: Readonly<Record<string, string>> = {
    endmin: 'icon_chr_0003_endminf',
    fiona: 'icon_chr_0102_fiona'
  }
  let iconId = overrides[alias] ?? ''
  if (!iconId) {
    const characterId = Object.keys(tables.CharacterTable ?? {}).find(
      (id) => id === raw || id.endsWith(`_${alias}`)
    )
    if (characterId) iconId = `icon_${characterId}`
  }
  if (!iconId) {
    const direct = asRecord(tables.NpcTable?.[raw] ?? tables.NpcTable?.[alias])
    const matched = Object.values(tables.NpcTable ?? {})
      .map(asRecord)
      .find(
        (npc) =>
          stringValue(npc.npcId) === alias ||
          stringValue(npc.dataKey).toLocaleLowerCase().includes(alias.toLocaleLowerCase())
      )
    const npc = Object.keys(direct).length ? direct : matched
    const headIcon = stringValue(npc?.headIcon)
    if (headIcon && headIcon !== 'icon_default') iconId = headIcon
  }
  return iconId
    ? `/public/images/assets/beyond/dynamicassets/gameplay/ui/sprites/charremoteicon/${iconId}.png`
    : ''
}

function standardDialogueGroups(references: DialogueReferences, tables: TableSet): StandardDialogueGroup[] {
  return [...references.dialogue].toSorted(naturalCompare).map((id) => {
    const lines = Object.entries(tables.DialogTextTable ?? {})
      .filter(([key]) => key.startsWith(`${id}_`))
      .toSorted(([left], [right]) => naturalCompare(left, right))
      .map(([lineId, value]): DialogueLine => {
        const row = asRecord(value)
        const actorName = textValue(row.actorName, stringValue(row.actorNameId))
        return {
          id: lineId,
          speaker: actorName,
          speakerRole: actorName ? 'named' : 'narrator',
          text: textValue(row.dialogText),
          hint: textValue(row.hint),
          avatar: dialogueAvatar(row.actorNameId, tables),
          audio: stringValue(row.audioOverride),
          contentType: 1
        }
      })
    const options = Object.entries(tables.DialogOptionTable ?? {})
      .filter(([key]) => key.startsWith(`option_${id}_`))
      .toSorted(([left], [right]) => naturalCompare(left, right))
      .map(([optionId, value]): DialogueOption => ({
        id: optionId,
        text: textValue(asRecord(value).optionText, optionId),
        nextContentId: null
      }))
    const prefix = `summary_${id.replace(/^dlg_/, '')}_`
    const summaries = Object.entries(tables.DialogSummaryTable ?? {})
      .filter(([key]) => key.startsWith(prefix))
      .toSorted(([left], [right]) => naturalCompare(left, right))
      .map(([, value]) => textValue(asRecord(value).text))
      .filter(Boolean)
    return { kind: 'dialogue', id, lines, options, summaries }
  })
}

function snsDialogueGroups(references: DialogueReferences, tables: TableSet): SnsDialogueGroup[] {
  return [...references.sns].toSorted(naturalCompare).map((id): SnsDialogueGroup => {
    const row = asRecord(tables.SNSDialogTable?.[id])
    if (!Object.keys(row).length)
      return { kind: 'sns', id, chatId: '', startContentId: null, nodes: {}, options: {}, missing: true }
    const nodes = Object.fromEntries(
      Object.entries(asRecord(row.dialogContentData))
        .filter(([key]) => numberValue(key, -1) >= 0)
        .map(([key, value]) => {
          const node = asRecord(value)
          const contentId = numberValue(node.contentId, numberValue(key))
          const person = speaker(node.speaker, tables)
          const parsed: SnsDialogueNode = {
            id: `${id}#${key}`,
            contentId,
            speaker: person.name,
            speakerRole: person.role,
            text: textValue(node.content),
            hint: '',
            avatar: dialogueAvatar(node.speaker, tables),
            audio: '',
            contentType: numberValue(node.contentType, 1),
            nextContentId: numberValue(node.nextContentId, -1) >= 0 ? numberValue(node.nextContentId) : null,
            optionIds: stringList(node.dialogOptionIds)
          }
          return [String(contentId), parsed]
        })
    )
    const options: Record<string, DialogueOption> = {}
    for (const node of Object.values(nodes)) {
      for (const optionId of node.optionIds) {
        const option = asRecord(tables.SNSDialogOptionTable?.[optionId])
        const next = numberValue(option.optionNextContentId, -1)
        options[optionId] = {
          id: optionId,
          text: textValue(option.optionDesc, optionId),
          nextContentId: next >= 0 ? next : null
        }
      }
    }
    const explicitStart = Object.values(asRecord(row.dialogContentData))
      .map(asRecord)
      .find((node) => numberValue(node.preContentId, -1) === 0 && numberValue(node.contentId, -1) >= 0)
    const first = Object.keys(nodes)
      .map(Number)
      .toSorted((left, right) => left - right)[0]
    return {
      kind: 'sns',
      id,
      chatId: stringValue(row.chatId),
      startContentId: explicitStart ? numberValue(explicitStart.contentId) : (first ?? null),
      nodes,
      options,
      missing: false
    }
  })
}

export function buildMissionDetail(
  entry: MissionIndexEntry,
  missionValue: unknown,
  metaValue: unknown,
  tables: TableSet
): MissionDetail {
  const mission = asRecord(missionValue)
  const meta = asRecord(metaValue)
  const textTable = tables.TextTable ?? {}
  const quests = sortedQuests(mission).map(({ id, row }): MissionQuest => {
    const questType = enumDefinition(row.questType, MISSION_QUEST_TYPES, LEGACY_QUEST_TYPE_NAMES, 'Normal')
    const descriptionOverride = tableText(textTable, textKey(row.descriptionOverride))
    const objectives = recordList(row.objectiveList).map((objective, index): MissionObjective => {
      const condition = asRecord(objective.condition)
      return {
        id: `${id}:${index}`,
        description: tableText(textTable, textKey(objective.description), textKey(objective.description)),
        condition: stringValue(condition.$type)
          .replace(/,.*$/, '')
          .replace(/^Beyond\.Gameplay\./, '')
      }
    })
    const reward = rewardById(stringValue(row.rewardId), id, tables)
    return {
      id,
      type: questType.name,
      flowIndex: numberValue(row.flowIndex),
      previousIds: stringList(row.prevQuestIdList),
      description:
        descriptionOverride ||
        objectives
          .map((objective) => objective.description)
          .filter(Boolean)
          .join(' / '),
      objectives,
      requiredItemIds: stringList(row.needItemIds),
      reward
    }
  })
  const missionReward = rewardById(stringValue(mission.rewardId), 'mission', tables)
  const levelId = stringValue(mission.levelId)
  const level = asRecord(tables.LevelDescTable?.[levelId])
  const characterId = stringValue(mission.charId)
  const character = asRecord(tables.CharacterTable?.[characterId])
  const extra = asRecord(tables.MissionExtraInfoTable?.[entry.id])
  const references = collectDialogueReferences(entry.id, mission, tables)
  const dialogues: MissionDialogueGroup[] = [
    ...standardDialogueGroups(references, tables),
    ...snsDialogueGroups(references, tables)
  ].toSorted((left, right) => {
    const leftOrder = references.order.get(left.id)
    const rightOrder = references.order.get(right.id)
    if (leftOrder !== undefined || rightOrder !== undefined)
      return (leftOrder ?? Number.MAX_SAFE_INTEGER) - (rightOrder ?? Number.MAX_SAFE_INTEGER)
    return naturalCompare(left.id, right.id)
  })
  return {
    entry,
    description: tableText(textTable, textKey(mission.missionDescription)),
    levelId,
    levelName: textValue(level.showName, levelId),
    characterId,
    characterName: textValue(character.name, characterId),
    extraInfo: textValue(extra.extraInfoDesc),
    scope: stringValue(mission.scope),
    acceptMode: stringValue(asRecord(meta.acceptMode).mode),
    quests,
    missionReward,
    rewards: [missionReward, ...quests.map((quest) => quest.reward)].filter(
      (reward): reward is MissionReward => reward !== null
    ),
    dialogues,
    radioIds: [...references.radio]
  }
}

export function buildSnsTimeline(
  group: SnsDialogueGroup,
  choices: Readonly<Record<string, string>>
): SnsTimelineItem[] {
  const output: SnsTimelineItem[] = []
  const visited = new Set<number>()
  let contentId = group.startContentId
  while (contentId !== null && contentId >= 0 && !visited.has(contentId)) {
    visited.add(contentId)
    const node = group.nodes[String(contentId)]
    if (!node) break
    if (node.text || node.contentType !== 1) output.push({ kind: 'line', line: node })
    const options = node.optionIds
      .map((id) => group.options[id])
      .filter((option): option is DialogueOption => Boolean(option))
    if (options.length) {
      const selected = options.find((option) => option.id === choices[String(contentId)]) ?? options[0]
      if (!selected) break
      output.push({ kind: 'choice', contentId, options, selectedId: selected.id })
      contentId = selected.nextContentId
    } else {
      contentId = node.nextContentId
    }
  }
  return output
}
