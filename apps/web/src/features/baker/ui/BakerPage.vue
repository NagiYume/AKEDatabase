<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { useQuery } from '@tanstack/vue-query'
import { List } from '@lucide/vue'
import {
  EmptyState,
  ErrorState,
  ImageWithFallback,
  LoadingState,
  ResponsiveDrawer,
  SearchToolbar
} from '@ake/ui'
import { useAppContext } from '../../../app/providers/app-context'
import { userErrorMessageKey } from '../../../shared/i18n'
import { getBakerRepository } from '../api/repository'
import {
  buildBakerTimeline,
  filterBakerEntries,
  resolveBakerEntry,
  type BakerDialogue,
  type BakerEntry,
  type BakerMessage,
  type BakerReaction
} from '../model'
import {
  bakerChatTypeCopyKey,
  bakerContentTypeCopyKey,
  bakerFallback,
  type BakerCopyKey,
  type BakerCopyParameters
} from './copy'

defineOptions({ name: 'BakerPage' })

const route = useRoute()
const router = useRouter()
const { t, te, locale } = useI18n()
const { client, dataState } = useAppContext()
const repository = getBakerRepository(client)
const choices = reactive<Record<string, Record<string, string>>>({})
const mobileDirectoryOpen = ref(false)

function tr(key: BakerCopyKey, parameters: BakerCopyParameters = {}): string {
  return te(key, String(locale.value))
    ? String(t(key, parameters))
    : bakerFallback(key, String(locale.value), parameters)
}

function queryValue(key: string): string {
  const value = route.query[key]
  return Array.isArray(value) ? (value[0] ?? '') : typeof value === 'string' ? value : ''
}

function updateQuery(key: string, value: string, defaultValue = ''): void {
  void router.replace({
    query: { ...route.query, [key]: value && value !== defaultValue ? value : undefined }
  })
}

function entityParam(): string {
  return queryValue('id')
}

const search = computed({ get: () => queryValue('q'), set: (value: string) => updateQuery('q', value) })
const typeFilter = computed({
  get: () => queryValue('type') || 'all',
  set: (value: string) => updateQuery('type', value, 'all')
})
const {
  data: catalog,
  isPending,
  isError,
  error,
  refetch
} = useQuery({
  queryKey: computed(() => [
    'baker',
    'catalog',
    dataState.value.baseUrl,
    dataState.value.selected.id,
    dataState.value.locale
  ]),
  queryFn: ({ signal }) => repository.catalog(signal)
})
const entries = computed(() =>
  filterBakerEntries(catalog.value?.entries ?? [], { search: search.value, type: typeFilter.value })
)
const selected = computed(() => {
  const entries = catalog.value?.entries ?? []
  const id = entityParam()
  return id ? resolveBakerEntry(entries, id) : (entries.find((entry) => entry.dialogue) ?? entries[0] ?? null)
})
const dialogue = computed(() => selected.value?.dialogue ?? null)
const timeline = computed(() => {
  const value = dialogue.value
  return value ? buildBakerTimeline(value, choices[value.id] ?? {}) : []
})
const topicCount = computed(() => (selected.value?.topicId ? 1 : 0))

function chatTypeLabel(type: number): string {
  return tr(bakerChatTypeCopyKey(type))
}

function entryPreview(entry: BakerEntry): string {
  if (entry.preview) return entry.preview
  const missionId = entry.dialogue?.relatedMissionId
  return missionId
    ? tr('modules.baker.preview.relatedMission', { id: missionId })
    : tr('modules.baker.preview.noMessages')
}

function speakerLabel(message: BakerMessage): string {
  if (message.speakerName) return message.speakerName
  return message.self ? tr('modules.baker.speaker.administrator') : tr('modules.baker.speaker.system')
}

function speakerInitial(message: BakerMessage): string {
  return Array.from(speakerLabel(message))[0] ?? '?'
}

function openEntry(entry: BakerEntry): void {
  mobileDirectoryOpen.value = false
  void router.push({
    name: 'module',
    params: { moduleId: 'baker' },
    query: { ...route.query, id: entry.id }
  })
}

function choose(dialog: BakerDialogue, contentId: number, optionId: string): void {
  choices[dialog.id] ??= {}
  choices[dialog.id]![String(contentId)] = optionId
}

function errorMessage(value: unknown): string {
  return String(t(userErrorMessageKey(value)))
}

function avatarUrl(icon: string): string {
  return icon
    ? client.resolveImageUrl(
        `public/images/assets/beyond/dynamicassets/gameplay/ui/sprites/charroundicon/${icon.toLocaleLowerCase()}.png`
      )
    : ''
}

function pictureUrl(id: string): string {
  return client.resolveImageUrl(
    `public/images/assets/beyond/dynamicassets/gameplay/ui/sprites/sns/picture/${id.toLocaleLowerCase()}.png`
  )
}

function stickerUrl(resourceId: string): string {
  const resource = resourceId.toLocaleLowerCase()
  if (/^sns_sticker_\d{3}$/.test(resource)) {
    return client.resolveImageUrl(
      `public/images/assets/beyond/dynamicassets/gameplay/ui/sprites/sns/sticker/${resource}.png`
    )
  }
  const match = resource.match(/^sns_emoji_(\d{3})$/)
  if (!match?.[1]) return ''
  const sizes = [16, 18, 20, 16, 16, 16, 16, 16]
  let index = Number(match[1])
  for (let pack = 0; pack < sizes.length; pack += 1) {
    const size = sizes[pack] ?? 0
    if (index <= size) {
      const folder = String(pack + 1).padStart(2, '0')
      const item = String(index).padStart(2, '0')
      return client.resolveImageUrl(
        `public/images/assets/beyond/dynamicassets/gameplay/ui/sprites/sns/sticker/sns_sticker_${folder}/sns_sticker_${folder}_${item}.png`
      )
    }
    index -= size
  }
  return ''
}

function messageTypeLabel(type: number): string {
  return tr(bakerContentTypeCopyKey(type), { type })
}

function isSystem(message: BakerMessage): boolean {
  return message.contentType === 7
}

function isReaction(message: BakerMessage): boolean {
  return message.contentType === 9
}

function reactionLabel(reaction: BakerReaction): string {
  return reaction.people.join('、') || tr('modules.baker.count.people', { count: reaction.count })
}

function hasAttachment(message: BakerMessage): boolean {
  return Boolean(message.attachmentTitle) || ![1, 2, 7, 9].includes(message.contentType)
}

function showTypeFallback(message: BakerMessage): boolean {
  return !message.text && !hasAttachment(message) && message.pictureIds.length === 0
}
</script>

<template>
  <div class="baker-module">
    <aside class="baker-sidebar" :aria-label="tr('modules.baker.directory')">
      <header class="baker-brand" data-baker-directory-block="brand">
        <span class="baker-brand__mark" aria-hidden="true">B</span>
        <div>
          <h1>Baker</h1>
          <p>
            {{ catalog?.totalCount ?? 0 }} {{ tr('modules.baker.metrics.sessions') }} ·
            {{ catalog?.recordedCount ?? 0 }} {{ tr('modules.baker.metrics.recorded') }}
          </p>
        </div>
      </header>

      <div class="baker-search" data-baker-directory-block="search">
        <SearchToolbar
          v-model="search"
          :ariaLabel="tr('modules.baker.search')"
          :clear-label="tr('common.clear')"
          :placeholder="tr('modules.baker.searchPlaceholder')"
        />
      </div>

      <div
        class="baker-segments"
        data-baker-directory-block="segments"
        role="group"
        :aria-label="tr('modules.baker.filters.title')"
      >
        <button type="button" :class="{ active: typeFilter === 'all' }" @click="typeFilter = 'all'">
          {{ tr('modules.baker.filters.all') }}
        </button>
        <button type="button" :class="{ active: typeFilter === '3' }" @click="typeFilter = '3'">
          {{ tr('modules.baker.types.operator') }}
        </button>
        <button type="button" :class="{ active: typeFilter === '1' }" @click="typeFilter = '1'">
          {{ tr('modules.baker.types.contact') }}
        </button>
        <button type="button" :class="{ active: typeFilter === '2' }" @click="typeFilter = '2'">
          {{ tr('modules.baker.types.group') }}
        </button>
      </div>

      <div class="baker-contact-list" data-baker-directory-block="list">
        <LoadingState v-if="isPending" compact :label="tr('modules.baker.loading')" />
        <ErrorState
          v-else-if="isError"
          compact
          :title="tr('modules.baker.error')"
          :description="errorMessage(error)"
          :retry-label="tr('common.retry')"
          @retry="refetch()"
        />
        <EmptyState v-else-if="entries.length === 0" compact :title="tr('modules.baker.empty.matches')" />
        <button
          v-for="entry in entries"
          v-else
          :key="entry.id"
          class="baker-contact"
          :class="{ active: entry.id === selected?.id }"
          type="button"
          @click="openEntry(entry)"
        >
          <ImageWithFallback
            v-if="entry.avatarIcon"
            class="baker-avatar"
            :src="avatarUrl(entry.avatarIcon)"
            :alt="entry.name"
            width="48"
            height="48"
            aspect-ratio="1"
          />
          <span v-else class="baker-avatar baker-avatar--fallback" aria-hidden="true">
            {{ Array.from(entry.name)[0] || '?' }}
          </span>
          <span class="baker-contact__body">
            <strong class="baker-contact__name">{{ entry.name }}</strong>
            <span class="baker-contact__preview">{{ entryPreview(entry) }}</span>
            <small class="baker-contact__id">{{ entry.dialogLabel }}</small>
          </span>
        </button>
      </div>
    </aside>

    <div class="baker-conversation" role="region" :aria-label="tr('modules.baker.title')">
      <LoadingState v-if="isPending" :label="tr('modules.baker.loading')" />
      <ErrorState
        v-else-if="isError"
        :title="tr('modules.baker.error')"
        :description="errorMessage(error)"
        :retry-label="tr('common.retry')"
        @retry="refetch()"
      />
      <ErrorState
        v-else-if="entityParam() && !selected"
        :title="tr('modules.baker.notFound.title')"
        :description="tr('modules.baker.notFound.description')"
      />
      <template v-else-if="selected">
        <header class="baker-chat-header" data-baker-conversation-block="header">
          <ImageWithFallback
            v-if="selected.avatarIcon"
            class="baker-avatar"
            :src="avatarUrl(selected.avatarIcon)"
            :alt="selected.name"
            width="48"
            height="48"
            aspect-ratio="1"
          />
          <span v-else class="baker-avatar baker-avatar--fallback" aria-hidden="true">
            {{ Array.from(selected.name)[0] || '?' }}
          </span>
          <div class="baker-chat-header__identity">
            <h2>{{ selected.name }}</h2>
            <p>{{ selected.id }} · {{ chatTypeLabel(selected.chatType) }}</p>
          </div>
          <div class="baker-chat-header__stats">
            <span class="baker-badge">
              {{ tr('modules.baker.count.dialogues', { count: dialogue ? 1 : 0 }) }}
            </span>
            <span class="baker-badge">
              {{ tr('modules.baker.count.topics', { count: topicCount }) }}
            </span>
          </div>
        </header>

        <div class="baker-thread-list" data-baker-conversation-block="threads">
          <EmptyState
            v-if="!dialogue"
            :title="tr('modules.baker.empty.conversation')"
            :description="selected.chatId"
          />
          <section v-else class="baker-thread">
            <h3 class="baker-thread__heading">
              <strong>{{ selected.topicName || tr('modules.baker.thread') }}</strong>
              <span v-if="selected.topicId">{{ tr('modules.baker.count.dialogues', { count: 1 }) }}</span>
            </h3>
            <section class="baker-dialog">
              <p class="baker-dialog__meta">
                {{
                  [
                    dialogue.id,
                    dialogue.relatedMissionId
                      ? `${tr('modules.baker.relatedMission')} ${dialogue.relatedMissionId}`
                      : '',
                    dialogue.notice ? tr('modules.baker.notice') : ''
                  ]
                    .filter(Boolean)
                    .join(' · ')
                }}
              </p>
              <EmptyState v-if="timeline.length === 0" compact :title="tr('modules.baker.empty.messages')" />
              <div v-else class="baker-messages">
                <template
                  v-for="item in timeline"
                  :key="item.kind === 'message' ? item.message.id : `${dialogue.id}:${item.contentId}`"
                >
                  <div v-if="item.kind === 'message' && isSystem(item.message)" class="baker-system-message">
                    {{
                      item.message.text ||
                      item.message.contentParams ||
                      messageTypeLabel(item.message.contentType)
                    }}
                  </div>
                  <div
                    v-else-if="item.kind === 'message' && isReaction(item.message)"
                    class="baker-reactions"
                  >
                    <span v-if="item.message.reactions.length === 0" class="baker-system-message">
                      {{ messageTypeLabel(item.message.contentType) }}
                    </span>
                    <span
                      v-for="(reaction, reactionIndex) in item.message.reactions"
                      v-else
                      :key="`${item.message.id}:${reaction.resourceId}:${reactionIndex}`"
                      class="baker-reaction"
                    >
                      <ImageWithFallback
                        v-if="stickerUrl(reaction.resourceId)"
                        class="baker-reaction__emoji"
                        :src="stickerUrl(reaction.resourceId)"
                        :alt="reaction.resourceId"
                        width="28"
                        height="28"
                        aspect-ratio="1"
                      />
                      <span v-else class="baker-reaction__fallback">{{ reaction.resourceId || '?' }}</span>
                      <span>{{ reactionLabel(reaction) }}</span>
                    </span>
                  </div>
                  <article
                    v-else-if="item.kind === 'message'"
                    class="baker-message"
                    :class="{ 'is-self': item.message.self }"
                  >
                    <ImageWithFallback
                      v-if="item.message.speakerIcon"
                      class="baker-avatar"
                      :src="avatarUrl(item.message.speakerIcon)"
                      :alt="item.message.speakerName"
                      width="44"
                      height="44"
                      aspect-ratio="1"
                    />
                    <span v-else class="baker-avatar baker-avatar--fallback" aria-hidden="true">
                      {{ speakerInitial(item.message) }}
                    </span>
                    <div class="baker-message__main">
                      <strong class="baker-message__speaker">{{ speakerLabel(item.message) }}</strong>
                      <div class="baker-bubble">
                        <div v-if="item.message.pictureIds.length" class="baker-picture-grid">
                          <ImageWithFallback
                            v-for="picture in item.message.pictureIds"
                            :key="picture"
                            :src="pictureUrl(picture)"
                            :alt="item.message.text || picture"
                          />
                        </div>
                        <div v-if="hasAttachment(item.message)" class="baker-attachment">
                          <span class="baker-attachment__icon" aria-hidden="true">
                            {{ messageTypeLabel(item.message.contentType).slice(0, 1) }}
                          </span>
                          <div>
                            <strong>
                              {{ item.message.attachmentTitle || messageTypeLabel(item.message.contentType) }}
                            </strong>
                            <small>
                              {{ item.message.attachmentDetail || item.message.parameters.join(' · ') }}
                            </small>
                          </div>
                        </div>
                        <p v-if="item.message.text && item.message.contentType !== 5">
                          {{ item.message.text }}
                        </p>
                        <small v-if="showTypeFallback(item.message)">
                          {{ messageTypeLabel(item.message.contentType) }}
                        </small>
                      </div>
                    </div>
                  </article>
                  <div v-else class="baker-options">
                    <button
                      v-for="option in item.options"
                      :key="option.id"
                      type="button"
                      class="baker-option"
                      :class="{
                        selected: option.id === item.selectedId,
                        'baker-option--emoji': Boolean(stickerUrl(option.resourceId))
                      }"
                      :aria-pressed="option.id === item.selectedId"
                      :aria-label="option.text"
                      :title="option.text"
                      @click="choose(dialogue, item.contentId, option.id)"
                    >
                      <ImageWithFallback
                        v-if="stickerUrl(option.resourceId)"
                        :src="stickerUrl(option.resourceId)"
                        :alt="option.text"
                        width="48"
                        height="48"
                        aspect-ratio="1"
                      />
                      <span v-else>{{ option.text }}</span>
                    </button>
                  </div>
                </template>
              </div>
            </section>
          </section>
        </div>
      </template>
    </div>

    <ResponsiveDrawer
      v-model:open="mobileDirectoryOpen"
      side="left"
      :title="tr('modules.baker.directory')"
      :close-label="String(t('common.close'))"
    >
      <template #trigger>
        <button class="baker-mobile-button" type="button" :aria-label="tr('modules.baker.directory')">
          <List :size="18" aria-hidden="true" />
          <span>{{ tr('modules.baker.types.contact') }}</span>
        </button>
      </template>
      <EmptyState v-if="entries.length === 0" compact :title="tr('modules.baker.empty.matches')" />
      <div v-else class="baker-mobile-directory">
        <button
          v-for="entry in entries"
          :key="entry.id"
          type="button"
          :class="{ active: entry.id === selected?.id }"
          @click="openEntry(entry)"
        >
          <strong>{{ entry.name }}</strong
          ><small>{{ entry.dialogLabel }}</small>
        </button>
      </div>
    </ResponsiveDrawer>
  </div>
</template>

<style scoped>
.baker-module {
  position: relative;
  display: grid;
  grid-template-columns: 320px minmax(0, 1fr);
  width: 100%;
  height: 100%;
  min-height: 36.25rem;
  overflow: hidden;
  color: var(--ake-color-text);
  background: var(--ake-color-surface-muted);
}

.baker-sidebar {
  display: grid;
  grid-template-rows: auto auto auto minmax(0, 1fr);
  min-width: 0;
  overflow: hidden;
  border-inline-end: var(--ake-border-width) solid var(--ake-color-border);
  background: var(--ake-color-surface);
}

.baker-brand {
  display: flex;
  align-items: center;
  gap: var(--ake-space-3);
  padding: var(--ake-space-4);
  border-block-end: var(--ake-border-width) solid var(--ake-color-border);
}

.baker-brand__mark {
  display: grid;
  width: 2.75rem;
  height: 2.75rem;
  place-items: center;
  border-radius: var(--ake-radius-md);
  color: var(--ake-color-on-accent);
  background: var(--ake-color-accent);
  font-size: var(--ake-font-size-xl);
  font-weight: 800;
}

.baker-brand h1,
.baker-brand p,
.baker-chat-header h2,
.baker-chat-header p {
  margin: 0;
  letter-spacing: 0;
}

.baker-brand p,
.baker-chat-header p {
  color: var(--ake-color-text-muted);
  font-size: var(--ake-font-size-xs);
}

.baker-search {
  padding: var(--ake-space-3);
  border-block-end: var(--ake-border-width) solid var(--ake-color-border);
}

.baker-segments {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: var(--ake-space-1);
  padding: var(--ake-space-2) var(--ake-space-3);
  border-block-end: var(--ake-border-width) solid var(--ake-color-border);
}

.baker-segments button {
  min-width: 0;
  min-height: var(--ake-control-height-sm);
  padding: var(--ake-space-1);
  border: var(--ake-border-width) solid var(--ake-color-border);
  border-radius: var(--ake-radius-sm);
  color: var(--ake-color-text-muted);
  background: var(--ake-color-surface);
  font-size: var(--ake-font-size-xs);
  cursor: pointer;
}

.baker-segments button.active {
  border-color: var(--ake-color-accent);
  color: var(--ake-color-on-accent);
  background: var(--ake-color-accent);
}

.baker-contact-list {
  min-height: 0;
  overflow: auto;
  overscroll-behavior: contain;
  padding: var(--ake-space-2);
}

.baker-contact {
  display: grid;
  grid-template-columns: 3rem minmax(0, 1fr);
  width: 100%;
  min-width: 0;
  gap: var(--ake-space-3);
  padding: var(--ake-space-3);
  border: 0;
  border-block-end: var(--ake-border-width) solid var(--ake-color-border);
  color: var(--ake-color-text);
  background: transparent;
  text-align: start;
  cursor: pointer;
}

.baker-contact:hover,
.baker-contact.active {
  background: var(--ake-color-surface-hover);
}

.baker-contact.active {
  box-shadow: inset 3px 0 var(--ake-color-accent);
}

.baker-avatar {
  width: 3rem;
  height: 3rem;
  border-radius: 50%;
}

.baker-avatar--fallback {
  display: grid;
  place-items: center;
  color: var(--ake-color-on-accent);
  background: var(--ake-color-accent);
  font-weight: 800;
}

.baker-contact__body {
  display: grid;
  min-width: 0;
  align-content: center;
}

.baker-contact__name,
.baker-contact__preview,
.baker-contact__id {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.baker-contact__preview,
.baker-contact__id {
  color: var(--ake-color-text-muted);
  font-size: var(--ake-font-size-xs);
}

.baker-conversation {
  min-width: 0;
  overflow: auto;
  overscroll-behavior: contain;
  background: var(--ake-color-surface);
}

.baker-chat-header {
  position: sticky;
  z-index: var(--ake-z-sticky);
  top: 0;
  display: grid;
  grid-template-columns: 3rem minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--ake-space-3);
  padding: var(--ake-space-4) var(--ake-space-5);
  border-block-end: var(--ake-border-width) solid var(--ake-color-border);
  background: var(--ake-color-surface);
  backdrop-filter: blur(8px);
}

.baker-chat-header__identity {
  min-width: 0;
}

.baker-chat-header__stats {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: var(--ake-space-2);
}

.baker-badge {
  padding: var(--ake-space-1) var(--ake-space-2);
  border-radius: 999px;
  color: var(--ake-color-text-muted);
  background: var(--ake-color-surface-muted);
  font-size: var(--ake-font-size-xs);
}

.baker-thread-list {
  width: min(100%, 68.75rem);
  margin-inline: auto;
  padding: var(--ake-space-5);
}

.baker-thread + .baker-thread {
  margin-block-start: var(--ake-space-7);
}

.baker-thread__heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--ake-space-3);
  margin: 0 0 var(--ake-space-3);
  padding-block-end: var(--ake-space-2);
  border-block-end: var(--ake-border-width) solid var(--ake-color-border);
  letter-spacing: 0;
}

.baker-thread__heading span {
  color: var(--ake-color-text-muted);
  font-size: var(--ake-font-size-xs);
}

.baker-dialog__meta {
  margin: 0 0 var(--ake-space-3);
  color: var(--ake-color-text-muted);
  font-size: var(--ake-font-size-xs);
}

.baker-messages {
  display: grid;
  gap: var(--ake-space-3);
}

.baker-system-message {
  width: fit-content;
  max-width: 80%;
  margin-inline: auto;
  padding: var(--ake-space-1) var(--ake-space-3);
  border-radius: 999px;
  color: var(--ake-color-text-muted);
  background: var(--ake-color-surface-muted);
  font-size: var(--ake-font-size-xs);
  text-align: center;
}

.baker-message {
  display: flex;
  align-items: flex-start;
  gap: var(--ake-space-3);
}

.baker-message.is-self {
  flex-direction: row-reverse;
}

.baker-message__main {
  display: grid;
  min-width: 0;
  max-width: min(78%, 38rem);
  gap: var(--ake-space-1);
}

.baker-message.is-self .baker-message__main {
  justify-items: end;
}

.baker-message__speaker {
  color: var(--ake-color-text-muted);
  font-size: var(--ake-font-size-xs);
}

.baker-bubble {
  min-width: 0;
  padding: var(--ake-space-3);
  border: var(--ake-border-width) solid var(--ake-color-border);
  border-radius: 0 var(--ake-radius-md) var(--ake-radius-md) var(--ake-radius-md);
  background: var(--ake-color-surface-muted);
  overflow-wrap: anywhere;
}

.baker-message.is-self .baker-bubble {
  border-radius: var(--ake-radius-md) 0 var(--ake-radius-md) var(--ake-radius-md);
  background: var(--ake-color-accent-soft);
}

.baker-bubble p {
  margin: 0;
  white-space: pre-wrap;
}

.baker-picture-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(8rem, 1fr));
  gap: var(--ake-space-2);
  margin-block-end: var(--ake-space-2);
}

.baker-picture-grid > :deep(.ake-image) {
  max-width: 100%;
}

.baker-attachment {
  display: grid;
  grid-template-columns: 2.5rem minmax(0, 1fr);
  gap: var(--ake-space-2);
  align-items: center;
}

.baker-attachment__icon {
  display: grid;
  width: 2.5rem;
  height: 2.5rem;
  place-items: center;
  border-radius: var(--ake-radius-sm);
  color: var(--ake-color-on-accent);
  background: var(--ake-color-accent);
  font-weight: 800;
}

.baker-attachment div {
  display: grid;
  min-width: 0;
}

.baker-attachment small {
  color: var(--ake-color-text-muted);
  overflow-wrap: anywhere;
}

.baker-reactions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: var(--ake-space-2);
}

.baker-reaction {
  display: inline-flex;
  align-items: center;
  gap: var(--ake-space-2);
  padding: var(--ake-space-1) var(--ake-space-3);
  border: var(--ake-border-width) solid var(--ake-color-border);
  border-radius: 999px;
  color: var(--ake-color-text-muted);
  background: var(--ake-color-surface);
  font-size: var(--ake-font-size-xs);
}

.baker-reaction__emoji,
.baker-reaction__fallback {
  width: 1.75rem;
  height: 1.75rem;
}

.baker-reaction__fallback {
  display: grid;
  place-items: center;
  overflow: hidden;
  border-radius: 50%;
  background: var(--ake-color-surface-muted);
  text-overflow: ellipsis;
}

.baker-options {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: var(--ake-space-2);
  padding-inline-end: 3.75rem;
}

.baker-option {
  min-height: var(--ake-control-height-md);
  padding: var(--ake-space-2) var(--ake-space-3);
  border: var(--ake-border-width) solid var(--ake-color-border);
  border-radius: var(--ake-radius-sm);
  color: var(--ake-color-text);
  background: var(--ake-color-surface);
  cursor: pointer;
}

.baker-option--emoji {
  display: grid;
  width: 3.5rem;
  height: 3.5rem;
  padding: var(--ake-space-1);
  place-items: center;
}

.baker-option.selected {
  border-color: var(--ake-color-accent);
  background: var(--ake-color-accent-soft);
}

.baker-mobile-button {
  position: fixed;
  z-index: var(--ake-z-sticky);
  right: var(--ake-space-4);
  bottom: 4.875rem;
  display: none;
  min-height: var(--ake-control-height-md);
  align-items: center;
  gap: var(--ake-space-2);
  padding: var(--ake-space-2) var(--ake-space-4);
  border: 0;
  border-radius: 999px;
  color: var(--ake-color-on-accent);
  background: var(--ake-color-accent);
  box-shadow: var(--ake-shadow-dialog);
  cursor: pointer;
}

.baker-mobile-directory {
  display: grid;
  gap: var(--ake-space-2);
}

.baker-mobile-directory button {
  display: grid;
  gap: var(--ake-space-1);
  padding: var(--ake-space-3);
  border: var(--ake-border-width) solid var(--ake-color-border);
  border-radius: var(--ake-radius-md);
  color: var(--ake-color-text);
  background: var(--ake-color-surface);
  text-align: start;
}

.baker-mobile-directory button.active {
  border-inline-start: 4px solid var(--ake-color-accent);
  background: var(--ake-color-surface-hover);
}

.baker-mobile-directory small {
  color: var(--ake-color-text-muted);
}

@media (max-width: 47.5rem) {
  .baker-module {
    grid-template-columns: minmax(0, 1fr);
  }

  .baker-sidebar {
    display: none;
  }

  .baker-mobile-button {
    display: inline-flex;
  }

  .baker-chat-header {
    grid-template-columns: 3rem minmax(0, 1fr);
  }

  .baker-chat-header__stats {
    display: none;
  }

  .baker-thread-list {
    padding: var(--ake-space-3);
  }

  .baker-message__main {
    max-width: calc(100% - 3.75rem);
  }

  .baker-options {
    padding-inline-end: 0;
  }
}
</style>
