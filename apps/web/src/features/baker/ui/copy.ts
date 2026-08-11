export const BAKER_COPY = {
  'common.clear': { en: 'Clear', zh: '清除' },
  'common.retry': { en: 'Retry', zh: '重试' },
  'modules.baker.title': { en: 'Baker', zh: 'Baker' },
  'modules.baker.description': {
    en: 'Contacts, group chats and Baker conversations',
    zh: '联系人、群聊与 Baker 对话'
  },
  'modules.baker.eyebrow': { en: 'Conversation archive', zh: '会话档案' },
  'modules.baker.directory': { en: 'Baker conversation directory', zh: 'Baker 会话目录' },
  'modules.baker.search': { en: 'Search Baker conversations', zh: '搜索 Baker 会话' },
  'modules.baker.searchPlaceholder': { en: 'Contact, conversation or message', zh: '联系人、对话或消息' },
  'modules.baker.filters.title': { en: 'Conversation type', zh: '会话类型' },
  'modules.baker.filters.type': { en: 'Conversation type', zh: '会话类型' },
  'modules.baker.filters.all': { en: 'All conversations', zh: '全部会话' },
  'modules.baker.types.operator': { en: 'Operator', zh: '干员' },
  'modules.baker.types.contact': { en: 'Contact', zh: '联系人' },
  'modules.baker.types.group': { en: 'Group chat', zh: '群聊' },
  'modules.baker.types.session': { en: 'Conversation', zh: '会话' },
  'modules.baker.metrics.sessions': { en: 'Conversations', zh: '会话' },
  'modules.baker.metrics.recorded': { en: 'With messages', zh: '有记录' },
  'modules.baker.count.dialogues': { en: '{count} conversations', zh: '{count} 段对话' },
  'modules.baker.count.topics': { en: '{count} topics', zh: '{count} 个话题' },
  'modules.baker.count.people': { en: '{count} people', zh: '{count} 人' },
  'modules.baker.content.text': { en: 'Text message', zh: '文本消息' },
  'modules.baker.content.picture': { en: 'Picture message', zh: '图片消息' },
  'modules.baker.content.video': { en: 'Video message', zh: '视频消息' },
  'modules.baker.content.voice': { en: 'Voice message', zh: '语音消息' },
  'modules.baker.content.item': { en: 'Item attachment', zh: '物品附件' },
  'modules.baker.content.system': { en: 'System message', zh: '系统消息' },
  'modules.baker.content.contact': { en: 'Contact card', zh: '联系人名片' },
  'modules.baker.content.reaction': { en: 'Reaction', zh: '表情回应' },
  'modules.baker.content.archive': { en: 'Archive entry', zh: '档案条目' },
  'modules.baker.content.special': { en: 'Special message', zh: '特殊消息' },
  'modules.baker.content.mission': { en: 'Related mission', zh: '关联任务' },
  'modules.baker.content.unknown': { en: 'Message type {type}', zh: '消息类型 {type}' },
  'modules.baker.loading': { en: 'Loading Baker conversations', zh: '正在读取 Baker 会话' },
  'modules.baker.error': { en: 'Baker data could not be loaded', zh: 'Baker 数据加载失败' },
  'modules.baker.empty.matches': {
    en: 'No conversations match the current filters',
    zh: '没有符合条件的会话'
  },
  'modules.baker.notFound.title': { en: 'Conversation not found', zh: '未找到会话' },
  'modules.baker.notFound.description': {
    en: 'The requested conversation or contact does not exist in this version.',
    zh: '当前版本中不存在对应会话或联系人。'
  },
  'modules.baker.recorded': { en: 'Messages available', zh: '有对话记录' },
  'modules.baker.noRecord': { en: 'No messages', zh: '暂无记录' },
  'modules.baker.empty.conversation': {
    en: 'This contact has no readable conversations yet',
    zh: '该联系人暂时没有可读取的对话'
  },
  'modules.baker.thread': { en: 'Baker conversation', zh: 'Baker 对话' },
  'modules.baker.relatedMission': { en: 'Mission', zh: '任务' },
  'modules.baker.notice': { en: 'Notice', zh: '通知' },
  'modules.baker.empty.messages': {
    en: 'This conversation has no displayable messages',
    zh: '该段对话没有可显示内容'
  },
  'modules.baker.chooseBranch': { en: 'Choose a reply branch', zh: '选择回复分支' },
  'modules.baker.overview.title': { en: 'Baker conversation overview', zh: 'Baker 会话概览' },
  'modules.baker.overview.description': {
    en: 'Select a contact or conversation to view its option-aware message timeline.',
    zh: '选择左侧联系人或对话，查看按选项分支恢复的消息时间线。'
  },
  'modules.baker.preview.noMessages': { en: 'No conversation content', zh: '暂无对话内容' },
  'modules.baker.preview.relatedMission': { en: 'Related mission {id}', zh: '关联任务 {id}' },
  'modules.baker.speaker.administrator': { en: 'Administrator', zh: '管理员' },
  'modules.baker.speaker.system': { en: 'System', zh: '系统' }
} as const

export type BakerCopyKey = keyof typeof BAKER_COPY
export type BakerCopyParameters = Readonly<Record<string, string | number>>

function interpolate(value: string, parameters: BakerCopyParameters): string {
  return value.replace(/\{([^}]+)\}/g, (match, key: string) =>
    Object.prototype.hasOwnProperty.call(parameters, key) ? String(parameters[key]) : match
  )
}

export function bakerFallback(
  key: BakerCopyKey,
  locale: string,
  parameters: BakerCopyParameters = {}
): string {
  const copy = BAKER_COPY[key]
  return interpolate(locale === 'CH' ? copy.zh : copy.en, parameters)
}

const BAKER_CHAT_TYPE_KEYS: Readonly<Record<number, BakerCopyKey>> = {
  1: 'modules.baker.types.contact',
  2: 'modules.baker.types.group',
  3: 'modules.baker.types.operator'
}

const BAKER_CONTENT_TYPE_KEYS: Readonly<Record<number, BakerCopyKey>> = {
  1: 'modules.baker.content.text',
  2: 'modules.baker.content.picture',
  4: 'modules.baker.content.video',
  5: 'modules.baker.content.voice',
  6: 'modules.baker.content.item',
  7: 'modules.baker.content.system',
  8: 'modules.baker.content.contact',
  9: 'modules.baker.content.reaction',
  10: 'modules.baker.content.archive',
  11: 'modules.baker.content.special',
  12: 'modules.baker.content.mission'
}

export function bakerChatTypeCopyKey(value: number): BakerCopyKey {
  return BAKER_CHAT_TYPE_KEYS[value] ?? 'modules.baker.types.session'
}

export function bakerContentTypeCopyKey(value: number): BakerCopyKey {
  return BAKER_CONTENT_TYPE_KEYS[value] ?? 'modules.baker.content.unknown'
}
