<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { useQuery } from '@tanstack/vue-query'
import { House, List } from '@lucide/vue'
import {
  DirectoryPanel,
  EmptyState,
  ErrorState,
  ImageWithFallback,
  LoadingState,
  ResponsiveDrawer,
  SearchToolbar,
  Select,
  type SelectOption
} from '@ake/ui'
import { useAppContext } from '../../../app/providers/app-context'
import { usePreferencesStore } from '../../../app/stores/preferences'
import { userErrorMessageKey } from '../../../shared/i18n'
import { getMissionRepository } from '../api/repository'
import {
  buildSnsTimeline,
  filterMissions,
  resolveMissionEntry,
  type DialogueLine,
  type MissionDialogueGroup,
  type MissionIndexEntry,
  type MissionReward,
  type SnsDialogueGroup
} from '../model'
import {
  missionAcceptModeCopyKey,
  missionChapterCopyKey,
  missionFallback,
  missionImportanceCopyKey,
  missionQuestTypeCopyKey,
  missionTypeCopyKey,
  type MissionCopyKey,
  type MissionCopyParameters
} from './copy'

defineOptions({ name: 'MissionPage' })

const route = useRoute()
const router = useRouter()
const { t, te, locale } = useI18n()
const preferences = usePreferencesStore()
const { client, dataState } = useAppContext()
const repository = getMissionRepository(client)
const choices = reactive<Record<string, Record<string, string>>>({})
const mobileDirectoryOpen = ref(false)

function tr(key: MissionCopyKey, parameters: MissionCopyParameters = {}): string {
  return te(key, String(locale.value))
    ? String(t(key, parameters))
    : missionFallback(key, String(locale.value), parameters)
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
const chapterFilter = computed({
  get: () => queryValue('chapter') || 'all',
  set: (value: string) => updateQuery('chapter', value, 'all')
})
const activeTab = computed<'dialogue' | 'flow'>({
  get: () => (queryValue('view') === 'flow' ? 'flow' : 'dialogue'),
  set: (value) => updateQuery('view', value, 'dialogue')
})

const {
  data: catalog,
  isPending: catalogPending,
  isError: catalogFailed,
  error: catalogError,
  refetch: refetchCatalog
} = useQuery({
  queryKey: computed(() => [
    'mission',
    'catalog',
    dataState.value.baseUrl,
    dataState.value.selected.id,
    dataState.value.locale,
    dataState.value.manifest.sharedRevision
  ]),
  queryFn: ({ signal }) => repository.catalog(signal)
})

const visibleEntries = computed(() =>
  filterMissions(catalog.value?.entries ?? [], {
    search: search.value,
    type: typeFilter.value,
    chapter: chapterFilter.value,
    showHidden: preferences.showHidden,
    localizedSearchText: (entry) =>
      [
        missionTypeLabel(entry.type),
        missionChapterLabel(entry.chapter),
        missionImportanceLabel(entry.importance)
      ].join('\n')
  })
)
const selectedEntry = computed(() =>
  resolveMissionEntry(catalog.value?.entries ?? [], entityParam(), preferences.showHidden)
)
const {
  data: detail,
  isPending: detailPending,
  isError: detailFailed,
  error: detailError,
  refetch: refetchDetail
} = useQuery({
  queryKey: computed(() => [
    'mission',
    'detail',
    dataState.value.baseUrl,
    dataState.value.selected.id,
    dataState.value.locale,
    selectedEntry.value?.id ?? ''
  ]),
  enabled: computed(() => selectedEntry.value !== null),
  queryFn: ({ signal }) => {
    const entry = selectedEntry.value
    if (!entry) throw new Error(tr('modules.mission.error.notSelected'))
    return repository.detail(entry, signal)
  }
})

const typeOptions = computed<SelectOption[]>(() => [
  { value: 'all', label: tr('modules.mission.filters.allTypes') },
  ...[...new Set((catalog.value?.entries ?? []).map((entry) => entry.type))].map((value) => ({
    value,
    label: missionTypeLabel(value)
  }))
])
const chapterOptions = computed<SelectOption[]>(() => [
  { value: 'all', label: tr('modules.mission.filters.allChapters') },
  ...[...new Set((catalog.value?.entries ?? []).map((entry) => entry.chapter))].map((value) => ({
    value,
    label: missionChapterLabel(value)
  }))
])
const overviewTypes = computed(() => {
  const groups = new Map<string, MissionIndexEntry[]>()
  for (const entry of catalog.value?.entries ?? []) {
    if (!preferences.showHidden && entry.hidden) continue
    const entries = groups.get(entry.type) ?? []
    entries.push(entry)
    groups.set(entry.type, entries)
  }
  return [...groups.entries()]
    .sort(([left], [right]) => missionTypeLabel(left).localeCompare(missionTypeLabel(right)))
    .map(([type, entries]) => ({
      type,
      label: missionTypeLabel(type),
      count: entries.length,
      objectives: entries.reduce((total, entry) => total + entry.objectiveCount, 0),
      visible: entries.some((entry) => !entry.hidden)
    }))
})

function missionTypeLabel(value: string): string {
  return tr(missionTypeCopyKey(value))
}

function missionChapterLabel(value: string): string {
  return tr(missionChapterCopyKey(value))
}

function missionImportanceLabel(value: string): string {
  return tr(missionImportanceCopyKey(value))
}

function missionQuestTypeLabel(value: string): string {
  return tr(missionQuestTypeCopyKey(value))
}

function missionAcceptModeLabel(value: string): string {
  return tr(missionAcceptModeCopyKey(value))
}

function dialogueSpeakerLabel(line: DialogueLine): string {
  if (line.speaker) return line.speaker
  if (line.speakerRole === 'administrator') return tr('modules.mission.dialogue.speaker.administrator')
  if (line.speakerRole === 'narrator') return tr('modules.mission.dialogue.speaker.narrator')
  return tr('modules.mission.dialogue.speaker.system')
}

function openMission(entry: MissionIndexEntry): void {
  mobileDirectoryOpen.value = false
  void router.push({
    name: 'module',
    params: { moduleId: 'v3_mission' },
    query: { ...route.query, id: entry.id }
  })
}

function showOverview(): void {
  mobileDirectoryOpen.value = false
  activeTab.value = 'dialogue'
  void router.push({
    name: 'module',
    params: { moduleId: 'v3_mission' },
    query: { ...route.query, id: undefined, view: undefined }
  })
}

function selectOverviewType(type: string): void {
  typeFilter.value = type
}

function errorMessage(error: unknown): string {
  return String(t(userErrorMessageKey(error)))
}

function itemIcon(iconId: string): string {
  return client.resolveImageUrl(
    `public/images/assets/beyond/dynamicassets/gameplay/ui/sprites/itemiconbig/${iconId}.png`
  )
}

function dialogueAvatar(path: string): string {
  return path ? client.resolveImageUrl(path) : ''
}

function snsTimeline(group: SnsDialogueGroup) {
  return buildSnsTimeline(group, choices[group.id] ?? {})
}

function selectOption(group: SnsDialogueGroup, contentId: number, optionId: string): void {
  choices[group.id] ??= {}
  choices[group.id]![String(contentId)] = optionId
}

function asSns(group: MissionDialogueGroup): SnsDialogueGroup {
  return group as SnsDialogueGroup
}

function contentLabel(type: number): string {
  const keys: Partial<Record<number, MissionCopyKey>> = {
    4: 'modules.mission.content.video',
    5: 'modules.mission.content.voice',
    6: 'modules.mission.content.item',
    7: 'modules.mission.content.system',
    8: 'modules.mission.content.contact',
    10: 'modules.mission.content.archive',
    11: 'modules.mission.content.special',
    12: 'modules.mission.content.relatedMission'
  }
  const key = keys[type]
  return key ? tr(key) : tr('modules.mission.content.unknown', { type })
}

function rewardLabel(reward: MissionReward): string {
  return reward.source === 'mission' ? tr('modules.mission.rewards.completion') : reward.source
}
</script>

<template>
  <div class="mission-module">
    <aside class="mission-sidebar" :aria-label="tr('modules.mission.directory')">
      <DirectoryPanel :ariaLabel="tr('modules.mission.directory')">
        <template #toolbar>
          <div class="mission-sidebar__header" data-mission-directory-block="search">
            <button
              class="mission-home-button"
              type="button"
              :title="tr('modules.mission.overview.title')"
              :aria-label="tr('modules.mission.overview.title')"
              @click="showOverview"
            >
              <House :size="18" aria-hidden="true" />
            </button>
            <SearchToolbar
              v-model="search"
              :ariaLabel="tr('modules.mission.search')"
              :clear-label="tr('common.clear')"
              :placeholder="tr('modules.mission.searchPlaceholder')"
            />
          </div>
          <div class="mission-filters" data-mission-directory-block="filters">
            <Select
              v-model="typeFilter"
              :ariaLabel="tr('modules.mission.filters.type')"
              :options="typeOptions"
            />
            <Select
              v-model="chapterFilter"
              :ariaLabel="tr('modules.mission.filters.chapter')"
              :options="chapterOptions"
            />
            <label class="mission-hidden-toggle">
              <input v-model="preferences.showHidden" type="checkbox" />
              <span>{{ tr('modules.mission.filters.internal') }}</span>
            </label>
          </div>
          <div class="mission-list-summary" data-mission-directory-block="summary">
            {{ visibleEntries.length }} / {{ catalog?.missionCount ?? 0 }} ·
            {{ catalog?.objectiveCount ?? 0 }} {{ tr('modules.mission.metrics.objectives') }}
          </div>
        </template>

        <LoadingState v-if="catalogPending" compact :label="tr('modules.mission.loading')" />
        <ErrorState
          v-else-if="catalogFailed"
          compact
          :title="tr('modules.mission.error.catalog')"
          :description="errorMessage(catalogError)"
          :retry-label="tr('common.retry')"
          @retry="refetchCatalog()"
        />
        <EmptyState
          v-else-if="visibleEntries.length === 0"
          compact
          :title="tr('modules.mission.empty.matches')"
        />
        <div v-else class="mission-list" data-mission-directory-block="list">
          <button
            v-for="entry in visibleEntries"
            :key="entry.id"
            class="mission-list-item"
            :class="{ active: entry.id === selectedEntry?.id }"
            :data-view="entry.view"
            :data-importance="entry.importanceValue"
            type="button"
            @click="openMission(entry)"
          >
            <strong class="mission-list-item__name">{{ entry.name }}</strong>
            <code class="mission-list-item__id">{{ entry.id }}</code>
            <span class="mission-list-item__meta">
              <i class="mission-chip">{{ missionTypeLabel(entry.type) }}</i>
              <i class="mission-chip">{{
                tr('modules.mission.counts.steps', { count: entry.questCount })
              }}</i>
              <i class="mission-chip mission-importance" :data-importance="entry.importanceValue">
                {{ missionImportanceLabel(entry.importance) }}
              </i>
            </span>
          </button>
        </div>
      </DirectoryPanel>
    </aside>

    <div class="mission-detail" role="region" :aria-label="tr('modules.mission.title')">
      <LoadingState v-if="catalogPending" :label="tr('modules.mission.loading')" />
      <ErrorState
        v-else-if="catalogFailed"
        :title="tr('modules.mission.error.catalog')"
        :description="errorMessage(catalogError)"
        :retry-label="tr('common.retry')"
        @retry="refetchCatalog()"
      />
      <ErrorState
        v-else-if="entityParam() && !selectedEntry"
        :title="tr('modules.mission.notFound.title')"
        :description="tr('modules.mission.notFound.description')"
      />
      <template v-else-if="selectedEntry">
        <LoadingState v-if="detailPending" :label="tr('modules.mission.detail.loading')" />
        <ErrorState
          v-else-if="detailFailed"
          :title="tr('modules.mission.error.detail')"
          :description="errorMessage(detailError)"
          :retry-label="tr('common.retry')"
          @retry="refetchDetail()"
        />
        <article v-else-if="detail" class="mission-detail-page">
          <header class="mission-hero" data-mission-detail-block="hero">
            <div>
              <div class="mission-eyebrow">{{ selectedEntry.type }} · {{ selectedEntry.id }}</div>
              <h1>{{ selectedEntry.name }}</h1>
              <p class="mission-subtitle">{{ detail.description || tr('modules.mission.description') }}</p>
              <div class="mission-hero__badges">
                <span class="mission-chip">{{ missionTypeLabel(selectedEntry.type) }}</span>
                <span class="mission-chip">{{ missionChapterLabel(selectedEntry.chapter) }}</span>
                <span
                  class="mission-chip mission-importance"
                  :data-importance="selectedEntry.importanceValue"
                >
                  {{ tr('modules.mission.fields.importance') }}
                  {{ missionImportanceLabel(selectedEntry.importance) }}
                </span>
                <span class="mission-chip">{{ selectedEntry.questCount }} Quest</span>
              </div>
            </div>
            <div class="mission-hero__side">
              <span class="mission-version-note">{{ detail.levelName || tr('common.none') }}</span>
            </div>
          </header>

          <nav
            class="mission-tabs"
            data-mission-detail-block="tabs"
            :aria-label="tr('modules.mission.tabs.title')"
          >
            <button
              class="mission-tab"
              :class="{ active: activeTab === 'dialogue' }"
              type="button"
              :aria-pressed="activeTab === 'dialogue'"
              @click="activeTab = 'dialogue'"
            >
              {{ tr('modules.mission.tabs.dialogue') }}
            </button>
            <button
              class="mission-tab"
              :class="{ active: activeTab === 'flow' }"
              type="button"
              :aria-pressed="activeTab === 'flow'"
              @click="activeTab = 'flow'"
            >
              {{ tr('modules.mission.tabs.flow') }}
            </button>
          </nav>

          <section v-if="activeTab === 'dialogue'" class="mission-panel" data-mission-panel="dialogue">
            <EmptyState
              v-if="detail.dialogues.length === 0 && detail.radioIds.length === 0"
              compact
              :title="tr('modules.mission.empty.dialogue')"
              :description="tr('modules.mission.empty.dialogueHint')"
            />
            <div v-else class="mission-dialogues">
              <section v-for="group in detail.dialogues" :key="group.id" class="mission-dialog-group">
                <h2 class="mission-dialog-group__title">
                  <span class="mission-chip">
                    {{
                      group.kind === 'sns'
                        ? tr('modules.mission.dialogue.social')
                        : tr('modules.mission.dialogue.standard')
                    }}
                  </span>
                  <code>{{ group.id }}</code>
                </h2>
                <template v-if="group.kind === 'dialogue'">
                  <p v-for="summary in group.summaries" :key="summary" class="mission-description">
                    {{ summary }}
                  </p>
                  <article
                    v-for="line in group.lines"
                    :key="line.id"
                    class="mission-dialog-line"
                    :class="{ 'has-avatar': line.avatar }"
                  >
                    <ImageWithFallback
                      v-if="line.avatar"
                      class="mission-dialog-line__avatar"
                      :src="dialogueAvatar(line.avatar)"
                      alt=""
                      width="48"
                      height="48"
                      aspect-ratio="1"
                    />
                    <strong class="mission-dialog-line__speaker">{{ dialogueSpeakerLabel(line) }}</strong>
                    <div class="mission-dialog-line__text">
                      {{ line.text || tr('modules.mission.dialogue.emptyLine') }}
                      <small v-if="line.hint" class="mission-objective__meta">{{ line.hint }}</small>
                    </div>
                    <code class="mission-dialog-line__id">
                      {{ line.id }}<template v-if="line.audio"> · {{ line.audio }}</template>
                    </code>
                  </article>
                  <div v-for="option in group.options" :key="option.id" class="mission-dialog-option">
                    {{ tr('modules.mission.dialogue.choice') }}: {{ option.text }}
                    <small>{{ option.id }}</small>
                  </div>
                </template>
                <template v-else>
                  <EmptyState
                    v-if="group.missing"
                    compact
                    :title="tr('modules.mission.dialogue.missing')"
                    :description="group.id"
                  />
                  <template v-else>
                    <template
                      v-for="item in snsTimeline(asSns(group))"
                      :key="item.kind === 'line' ? item.line.id : `${group.id}:${item.contentId}`"
                    >
                      <article
                        v-if="item.kind === 'line'"
                        class="mission-dialog-line"
                        :class="{ 'has-avatar': item.line.avatar }"
                      >
                        <ImageWithFallback
                          v-if="item.line.avatar"
                          class="mission-dialog-line__avatar"
                          :src="dialogueAvatar(item.line.avatar)"
                          alt=""
                          width="48"
                          height="48"
                          aspect-ratio="1"
                        />
                        <strong class="mission-dialog-line__speaker">{{
                          dialogueSpeakerLabel(item.line)
                        }}</strong>
                        <div class="mission-dialog-line__text">
                          {{ item.line.text || contentLabel(item.line.contentType) }}
                          <small v-if="item.line.hint" class="mission-objective__meta">{{
                            item.line.hint
                          }}</small>
                        </div>
                        <code class="mission-dialog-line__id">
                          {{ item.line.id
                          }}<template v-if="item.line.audio"> · {{ item.line.audio }}</template>
                        </code>
                      </article>
                      <div v-else class="mission-dialog-choice">
                        <strong>{{ tr('modules.mission.dialogue.chooseBranch') }}</strong>
                        <div class="mission-dialog-choice__buttons">
                          <button
                            v-for="option in item.options"
                            :key="option.id"
                            type="button"
                            :aria-pressed="option.id === item.selectedId"
                            :class="{ selected: option.id === item.selectedId }"
                            @click="selectOption(asSns(group), item.contentId, option.id)"
                          >
                            {{ option.text }}
                          </button>
                        </div>
                      </div>
                    </template>
                  </template>
                </template>
              </section>
              <section v-if="detail.radioIds.length" class="mission-dialog-group">
                <h2 class="mission-dialog-group__title">
                  <span class="mission-chip">{{ tr('modules.mission.dialogue.radio') }}</span>
                </h2>
                <p v-for="id in detail.radioIds" :key="id" class="mission-dialog-empty">
                  <code>{{ id }}</code
                  ><br />
                  <small>{{ tr('modules.mission.content.voice') }}</small>
                </p>
              </section>
            </div>
          </section>

          <section v-else class="mission-panel" data-mission-panel="flow">
            <div class="mission-info-grid">
              <div>
                <span>{{ tr('modules.mission.fields.id') }}</span
                ><b>{{ selectedEntry.id }}</b>
              </div>
              <div>
                <span>{{ tr('modules.mission.fields.type') }}</span
                ><b>{{ missionTypeLabel(selectedEntry.type) }} ({{ selectedEntry.typeValue }})</b>
              </div>
              <div>
                <span>{{ tr('modules.mission.fields.view') }}</span
                ><b>{{ selectedEntry.view || tr('common.none') }}</b>
              </div>
              <div>
                <span>{{ tr('modules.mission.fields.importance') }}</span
                ><b>{{ missionImportanceLabel(selectedEntry.importance) }}</b>
              </div>
              <div>
                <span>{{ tr('modules.mission.fields.chapter') }}</span
                ><b>{{ missionChapterLabel(selectedEntry.chapter) }}</b>
              </div>
              <div>
                <span>{{ tr('modules.mission.fields.level') }}</span
                ><b>{{ detail.levelName || detail.levelId || tr('common.none') }}</b>
              </div>
              <div>
                <span>{{ tr('modules.mission.fields.character') }}</span
                ><b>{{ detail.characterName || detail.characterId || tr('common.none') }}</b>
              </div>
              <div>
                <span>{{ tr('modules.mission.fields.acceptMode') }}</span
                ><b>{{ missionAcceptModeLabel(detail.acceptMode) }}</b>
              </div>
              <div>
                <span>{{ tr('modules.mission.fields.reward') }}</span
                ><b>{{ detail.missionReward?.id || tr('common.none') }}</b>
              </div>
              <div>
                <span>{{ tr('modules.mission.fields.extraInfo') }}</span
                ><b>{{ detail.extraInfo || tr('common.none') }}</b>
              </div>
            </div>

            <div v-if="detail.missionReward" class="mission-description mission-completion-reward">
              <strong>{{ rewardLabel(detail.missionReward) }}</strong>
              <div class="mission-reward-list">
                <article
                  v-for="item in detail.missionReward.items"
                  :key="`${item.id}:${item.probable}`"
                  class="mission-reward"
                >
                  <ImageWithFallback
                    :src="itemIcon(item.iconId)"
                    :alt="item.name"
                    width="34"
                    height="34"
                    aspect-ratio="1"
                  />
                  <div>
                    <b>{{ item.name }}</b
                    ><br /><small>× {{ item.count }}</small>
                  </div>
                </article>
              </div>
            </div>

            <EmptyState v-if="detail.quests.length === 0" compact :title="tr('modules.mission.empty.flow')" />
            <div v-else class="mission-quest-list">
              <details
                v-for="(quest, questIndex) in detail.quests"
                :key="quest.id"
                class="mission-quest"
                :open="questIndex < 3"
              >
                <summary>
                  <code class="mission-quest__id">{{ quest.id }}</code>
                  <span class="mission-quest__desc">{{
                    quest.description || tr('modules.mission.flow.descriptionMissing')
                  }}</span>
                  <span class="mission-chip">{{ missionQuestTypeLabel(quest.type) }}</span>
                </summary>
                <div class="mission-quest__body">
                  <div
                    v-for="(objective, index) in quest.objectives"
                    :key="objective.id"
                    class="mission-objective"
                  >
                    <span class="mission-objective__index">{{ index + 1 }}</span>
                    <div>
                      <div class="mission-objective__text">
                        {{ objective.description || tr('modules.mission.flow.objectiveMissing') }}
                      </div>
                      <code class="mission-objective__meta">
                        {{ objective.condition || tr('modules.mission.flow.conditionUnknown') }}
                      </code>
                    </div>
                  </div>
                  <div v-if="quest.reward" class="mission-quest-reward">
                    <strong>{{ rewardLabel(quest.reward) }}</strong>
                    <div class="mission-reward-list">
                      <article
                        v-for="item in quest.reward.items"
                        :key="`${quest.id}:${item.id}:${item.probable}`"
                        class="mission-reward"
                      >
                        <ImageWithFallback
                          :src="itemIcon(item.iconId)"
                          :alt="item.name"
                          width="34"
                          height="34"
                          aspect-ratio="1"
                        />
                        <div>
                          <b>{{ item.name }}</b
                          ><br /><small>× {{ item.count }}</small>
                        </div>
                      </article>
                    </div>
                  </div>
                  <p v-if="quest.requiredItemIds.length" class="mission-objective__meta">
                    {{ tr('modules.mission.flow.requiredItems') }}: {{ quest.requiredItemIds.join(', ') }}
                  </p>
                </div>
              </details>
            </div>
          </section>
        </article>
      </template>

      <section v-else class="mission-overview">
        <header class="mission-overview__header" data-mission-overview-block="header">
          <div>
            <div class="mission-eyebrow">Mission Runtime Database</div>
            <h1>{{ tr('modules.mission.overview.title') }}</h1>
            <p class="mission-subtitle">{{ tr('modules.mission.overview.description') }}</p>
          </div>
          <span class="mission-overview__version">{{ dataState.selected.id }}</span>
        </header>
        <div class="mission-stat-grid" data-mission-overview-block="stats">
          <div class="mission-stat">
            <b>{{ catalog?.missionCount ?? 0 }}</b
            ><span>{{ tr('modules.mission.metrics.missions') }}</span>
          </div>
          <div class="mission-stat">
            <b>{{ catalog?.questCount ?? 0 }}</b
            ><span>{{ tr('modules.mission.metrics.quests') }}</span>
          </div>
          <div class="mission-stat">
            <b>{{ catalog?.objectiveCount ?? 0 }}</b
            ><span>{{ tr('modules.mission.metrics.objectives') }}</span>
          </div>
          <div class="mission-stat">
            <b>{{ catalog?.metaCount ?? 0 }}</b
            ><span>{{ tr('modules.mission.metrics.meta') }}</span>
          </div>
        </div>
        <section class="mission-overview-section" data-mission-overview-block="types">
          <h2><span aria-hidden="true" />{{ tr('modules.mission.overview.types') }}</h2>
          <div class="mission-type-grid">
            <button
              v-for="type in overviewTypes"
              :key="type.type"
              class="mission-type-card"
              type="button"
              @click="selectOverviewType(type.type)"
            >
              <b>{{ type.label }}</b
              ><strong>{{ type.count }}</strong>
              <small>
                {{ type.objectives }} {{ tr('modules.mission.metrics.objectives') }} ·
                {{
                  type.visible
                    ? tr('modules.mission.overview.visibleType')
                    : tr('modules.mission.overview.internalType')
                }}
              </small>
            </button>
          </div>
        </section>
        <section class="mission-overview-section" data-mission-overview-block="explanation">
          <h2><span aria-hidden="true" />{{ tr('modules.mission.overview.explanation') }}</h2>
          <p class="mission-description">{{ tr('modules.mission.overview.explanationText') }}</p>
        </section>
      </section>
    </div>

    <ResponsiveDrawer
      v-model:open="mobileDirectoryOpen"
      side="left"
      :title="tr('modules.mission.directory')"
      :close-label="String(t('common.close'))"
    >
      <template #trigger>
        <button
          class="mission-mobile-list-button"
          type="button"
          :aria-label="tr('modules.mission.directory')"
        >
          <List :size="18" aria-hidden="true" />
          <span>{{ String(t('common.list')) }}</span>
        </button>
      </template>
      <EmptyState v-if="visibleEntries.length === 0" compact :title="tr('modules.mission.empty.matches')" />
      <div v-else class="mission-mobile-directory">
        <button
          v-for="entry in visibleEntries"
          :key="entry.id"
          type="button"
          :class="{ active: entry.id === selectedEntry?.id }"
          @click="openMission(entry)"
        >
          <strong>{{ entry.name }}</strong
          ><code>{{ entry.id }}</code>
        </button>
      </div>
    </ResponsiveDrawer>
  </div>
</template>

<style scoped>
.mission-module {
  --mission-side: #7758a6;
  position: relative;
  display: grid;
  grid-template-columns: 292px minmax(0, 1fr);
  gap: 18px;
  height: 100%;
  min-height: 36.25rem;
  overflow: hidden;
  color: var(--ake-color-text);
}

.mission-sidebar {
  min-width: 0;
  overflow: hidden;
  border: var(--ake-border-width) solid var(--ake-color-border);
  border-radius: var(--ake-radius-lg);
  background: var(--ake-color-surface-muted);
}

.mission-sidebar__header {
  display: flex;
  min-width: 0;
  gap: var(--ake-space-2);
}

.mission-sidebar__header > :deep(.ake-search-toolbar) {
  min-width: 0;
  flex: 1;
}

.mission-home-button {
  display: grid;
  width: 2.375rem;
  height: var(--ake-control-height-md);
  flex: 0 0 2.375rem;
  padding: 0;
  place-items: center;
  border: var(--ake-border-width) solid var(--ake-color-border);
  border-radius: var(--ake-radius-sm);
  color: var(--ake-color-accent);
  background: var(--ake-color-surface);
  cursor: pointer;
}

.mission-filters {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: var(--ake-space-2);
  margin-block-start: var(--ake-space-2);
}

.mission-hidden-toggle {
  grid-column: 1 / -1;
  display: flex;
  align-items: center;
  gap: var(--ake-space-2);
  color: var(--ake-color-text-muted);
  font-size: var(--ake-font-size-xs);
}

.mission-list-summary {
  margin: var(--ake-space-3) calc(-1 * var(--ake-space-3)) calc(-1 * var(--ake-space-3));
  padding: var(--ake-space-2) var(--ake-space-3);
  border-block-start: var(--ake-border-width) solid var(--ake-color-border);
  color: var(--ake-color-text-muted);
  font-size: var(--ake-font-size-xs);
}

.mission-list {
  display: grid;
  gap: var(--ake-space-2);
  padding: var(--ake-space-2);
}

.mission-list-item {
  width: 100%;
  padding: var(--ake-space-3);
  overflow: hidden;
  border: var(--ake-border-width) solid var(--ake-color-border);
  border-inline-start: 4px solid var(--ake-color-text-muted);
  border-radius: var(--ake-radius-md);
  color: var(--ake-color-text);
  background: var(--ake-color-surface);
  text-align: start;
  cursor: pointer;
}

.mission-list-item:hover,
.mission-list-item.active {
  border-color: var(--ake-color-accent);
  background: var(--ake-color-surface-hover);
}

.mission-list-item[data-importance='1'] {
  border-inline-start: 5px solid #d4a72c;
}
.mission-list-item[data-importance='2'] {
  border-inline-start: 5px solid #54a46b;
}
.mission-list-item[data-importance='3'] {
  border-inline-start: 5px solid #4893bf;
}

.mission-list-item__name,
.mission-list-item__id {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mission-list-item__id {
  margin-block-start: var(--ake-space-1);
  color: var(--ake-color-text-muted);
  font-size: var(--ake-font-size-xs);
}

.mission-list-item__meta,
.mission-hero__badges {
  display: flex;
  flex-wrap: wrap;
  gap: var(--ake-space-1);
  margin-block-start: var(--ake-space-2);
}

.mission-chip {
  display: inline-flex;
  width: fit-content;
  padding: 2px var(--ake-space-2);
  border-radius: 999px;
  color: var(--ake-color-text-muted);
  background: var(--ake-color-surface-muted);
  font-size: var(--ake-font-size-xs);
  font-style: normal;
}

.mission-importance[data-importance='1'] {
  color: #72530a;
  background: #f3e2a4;
}
.mission-importance[data-importance='2'] {
  color: #28633c;
  background: #d5f0dc;
}
.mission-importance[data-importance='3'] {
  color: #285f80;
  background: #d8edf8;
}

.mission-detail {
  min-width: 0;
  overflow: auto;
  overscroll-behavior: contain;
  border: var(--ake-border-width) solid var(--ake-color-border);
  border-radius: var(--ake-radius-lg);
  background: var(--ake-color-surface);
}

.mission-overview,
.mission-detail-page {
  padding: var(--ake-space-6);
}

.mission-overview__header,
.mission-hero {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--ake-space-5);
  padding-block-end: var(--ake-space-5);
  border-block-end: var(--ake-border-width) solid var(--ake-color-border);
}

.mission-overview h1,
.mission-hero h1 {
  margin: var(--ake-space-1) 0 var(--ake-space-2);
  font-size: var(--ake-font-size-2xl);
  letter-spacing: 0;
}

.mission-eyebrow {
  color: var(--ake-color-accent);
  font-size: var(--ake-font-size-xs);
  font-weight: 750;
  text-transform: uppercase;
}

.mission-subtitle {
  margin: 0;
  color: var(--ake-color-text-muted);
  line-height: var(--ake-line-height-relaxed);
}

.mission-overview__version,
.mission-version-note {
  padding: var(--ake-space-2) var(--ake-space-3);
  border: var(--ake-border-width) solid var(--ake-color-border);
  border-radius: 999px;
  color: var(--ake-color-text-muted);
  background: var(--ake-color-surface-muted);
  font-size: var(--ake-font-size-xs);
  white-space: nowrap;
}

.mission-stat-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(7.5rem, 1fr));
  gap: var(--ake-space-3);
  margin: var(--ake-space-5) 0;
}

.mission-stat {
  padding: var(--ake-space-4);
  border: var(--ake-border-width) solid var(--ake-color-border);
  border-radius: var(--ake-radius-md);
  background: var(--ake-color-surface-muted);
}

.mission-stat b,
.mission-stat span {
  display: block;
}

.mission-stat b {
  font-size: var(--ake-font-size-2xl);
}

.mission-stat span {
  color: var(--ake-color-text-muted);
  font-size: var(--ake-font-size-xs);
}

.mission-overview-section {
  margin-block-start: var(--ake-space-6);
}

.mission-overview-section h2 {
  display: flex;
  align-items: center;
  gap: var(--ake-space-2);
  margin: 0 0 var(--ake-space-3);
  font-size: var(--ake-font-size-lg);
  letter-spacing: 0;
}

.mission-overview-section h2 span {
  width: 4px;
  height: 1.125rem;
  border-radius: 5px;
  background: var(--ake-color-accent);
}

.mission-type-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 10.625rem), 1fr));
  gap: var(--ake-space-2);
}

.mission-type-card {
  padding: var(--ake-space-4);
  border: var(--ake-border-width) solid var(--ake-color-border);
  border-radius: var(--ake-radius-md);
  color: var(--ake-color-text);
  background: var(--ake-color-surface);
  text-align: start;
  cursor: pointer;
}

.mission-type-card:hover {
  border-color: var(--ake-color-accent);
}

.mission-type-card b,
.mission-type-card strong,
.mission-type-card small {
  display: block;
}

.mission-type-card strong {
  margin-block: var(--ake-space-2);
  font-size: var(--ake-font-size-2xl);
}

.mission-type-card small {
  color: var(--ake-color-text-muted);
}

.mission-hero__side {
  display: flex;
  align-items: flex-end;
  flex-direction: column;
}

.mission-tabs {
  position: sticky;
  z-index: var(--ake-z-sticky);
  top: calc(-1 * var(--ake-space-6));
  display: flex;
  gap: var(--ake-space-2);
  margin: var(--ake-space-5) calc(-1 * var(--ake-space-6)) 0;
  padding: var(--ake-space-3) var(--ake-space-6);
  overflow-x: auto;
  border-block-end: var(--ake-border-width) solid var(--ake-color-border);
  background: var(--ake-color-surface);
  backdrop-filter: blur(8px);
}

.mission-tab {
  padding: var(--ake-space-2) var(--ake-space-3);
  border: var(--ake-border-width) solid var(--ake-color-border);
  border-radius: 999px;
  color: var(--ake-color-text);
  background: var(--ake-color-surface);
  cursor: pointer;
}

.mission-tab.active {
  border-color: var(--ake-color-accent);
  color: var(--ake-color-on-accent);
  background: var(--ake-color-accent);
}

.mission-panel {
  padding-block-start: var(--ake-space-5);
}

.mission-info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 11.25rem), 1fr));
  gap: var(--ake-space-2);
  margin-block-end: var(--ake-space-5);
}

.mission-info-grid > div {
  min-width: 0;
  padding: var(--ake-space-3);
  border: var(--ake-border-width) solid var(--ake-color-border);
  border-radius: var(--ake-radius-md);
  background: var(--ake-color-surface-muted);
}

.mission-info-grid span,
.mission-info-grid b {
  display: block;
  overflow-wrap: anywhere;
}

.mission-info-grid span {
  margin-block-end: var(--ake-space-1);
  color: var(--ake-color-text-muted);
  font-size: var(--ake-font-size-xs);
}

.mission-description {
  padding: var(--ake-space-4);
  border-inline-start: 4px solid var(--ake-color-accent);
  border-radius: 0 var(--ake-radius-md) var(--ake-radius-md) 0;
  background: var(--ake-color-surface-muted);
  line-height: var(--ake-line-height-relaxed);
}

.mission-quest-list {
  display: grid;
  gap: var(--ake-space-3);
  margin-block-start: var(--ake-space-5);
}

.mission-quest {
  overflow: hidden;
  border: var(--ake-border-width) solid var(--ake-color-border);
  border-radius: var(--ake-radius-md);
  background: var(--ake-color-surface);
}

.mission-quest summary {
  display: flex;
  align-items: center;
  gap: var(--ake-space-2);
  padding: var(--ake-space-3) var(--ake-space-4);
  cursor: pointer;
  list-style: none;
}

.mission-quest summary::before {
  font-size: var(--ake-font-size-xl);
  content: '›';
  transition: transform var(--ake-duration-fast);
}

.mission-quest[open] summary::before {
  transform: rotate(90deg);
}

.mission-quest__id {
  font-weight: 700;
}

.mission-quest__desc {
  min-width: 0;
  flex: 1;
  overflow: hidden;
  color: var(--ake-color-text-muted);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mission-quest__body {
  padding: 0 var(--ake-space-4) var(--ake-space-4);
  border-block-start: var(--ake-border-width) solid var(--ake-color-border);
}

.mission-objective {
  display: grid;
  grid-template-columns: 1.75rem minmax(0, 1fr);
  gap: var(--ake-space-2);
  padding-block: var(--ake-space-3);
  border-block-end: var(--ake-border-width) dashed var(--ake-color-border);
}

.mission-objective__index {
  display: grid;
  width: 1.625rem;
  height: 1.625rem;
  place-items: center;
  border-radius: 50%;
  color: var(--ake-color-on-accent);
  background: var(--ake-color-accent);
  font-size: var(--ake-font-size-xs);
}

.mission-objective__meta {
  display: block;
  margin-block-start: var(--ake-space-1);
  color: var(--ake-color-text-muted);
  font-size: var(--ake-font-size-xs);
  overflow-wrap: anywhere;
}

.mission-dialog-group {
  margin-block-end: var(--ake-space-5);
}

.mission-dialog-group__title {
  display: flex;
  align-items: center;
  gap: var(--ake-space-2);
  margin: 0 0 var(--ake-space-2);
  font-size: var(--ake-font-size-md);
  letter-spacing: 0;
}

.mission-dialog-line {
  display: grid;
  grid-template-columns: minmax(5.625rem, 9.375rem) minmax(0, 1fr);
  gap: var(--ake-space-3);
  padding: var(--ake-space-3);
  margin-block-end: var(--ake-space-2);
  border: var(--ake-border-width) solid var(--ake-color-border);
  border-radius: var(--ake-radius-md);
  background: var(--ake-color-surface);
}

.mission-dialog-line.has-avatar {
  grid-template-columns: 3rem minmax(5.625rem, 9.375rem) minmax(0, 1fr);
}

.mission-dialog-line__avatar {
  grid-row: 1 / span 2;
  width: 3rem;
  height: 3rem;
  border-radius: 50%;
}

.mission-dialog-line__speaker {
  color: var(--ake-color-accent);
  overflow-wrap: anywhere;
}

.mission-dialog-line__text {
  line-height: var(--ake-line-height-relaxed);
  overflow-wrap: anywhere;
}

.mission-dialog-line__id {
  grid-column: 2;
  color: var(--ake-color-text-muted);
  font-size: 0.625rem;
}

.mission-dialog-line.has-avatar .mission-dialog-line__id {
  grid-column: 3;
}

.mission-dialog-option {
  margin: var(--ake-space-2) 0 var(--ake-space-2) var(--ake-space-7);
  padding: var(--ake-space-2) var(--ake-space-3);
  border-inline-start: 3px solid var(--mission-side);
  border-radius: 0 var(--ake-radius-sm) var(--ake-radius-sm) 0;
  background: var(--ake-color-surface-muted);
}

.mission-dialog-empty {
  padding: var(--ake-space-6);
  border: var(--ake-border-width) dashed var(--ake-color-border);
  border-radius: var(--ake-radius-md);
  color: var(--ake-color-text-muted);
  text-align: center;
}

.mission-dialog-choice {
  margin-block: var(--ake-space-3);
  padding: var(--ake-space-3);
  border: var(--ake-border-width) solid var(--ake-color-border);
  border-radius: var(--ake-radius-md);
  background: var(--ake-color-surface-muted);
}

.mission-dialog-choice__buttons {
  display: flex;
  flex-wrap: wrap;
  gap: var(--ake-space-2);
  margin-block-start: var(--ake-space-2);
}

.mission-dialog-choice__buttons button {
  padding: var(--ake-space-2) var(--ake-space-3);
  border: var(--ake-border-width) solid var(--ake-color-border);
  border-radius: var(--ake-radius-sm);
  color: var(--ake-color-text);
  background: var(--ake-color-surface);
  cursor: pointer;
}

.mission-dialog-choice__buttons button.selected {
  border-color: var(--mission-side);
  color: #fff;
  background: var(--mission-side);
}

.mission-reward-list {
  display: flex;
  flex-wrap: wrap;
  gap: var(--ake-space-2);
  margin-block-start: var(--ake-space-3);
}

.mission-reward {
  display: flex;
  align-items: center;
  gap: var(--ake-space-2);
  padding: var(--ake-space-2) var(--ake-space-3);
  border: var(--ake-border-width) solid var(--ake-color-border);
  border-radius: var(--ake-radius-sm);
  background: var(--ake-color-surface);
}

.mission-reward > :deep(.ake-image) {
  width: 2.125rem;
  height: 2.125rem;
}

.mission-quest-reward {
  margin-block-start: var(--ake-space-3);
}

.mission-mobile-list-button {
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

.mission-mobile-directory {
  display: grid;
  gap: var(--ake-space-2);
}

.mission-mobile-directory button {
  display: grid;
  gap: var(--ake-space-1);
  padding: var(--ake-space-3);
  border: var(--ake-border-width) solid var(--ake-color-border);
  border-radius: var(--ake-radius-md);
  color: var(--ake-color-text);
  background: var(--ake-color-surface);
  text-align: start;
}

.mission-mobile-directory button.active {
  border-inline-start: 4px solid var(--ake-color-accent);
  background: var(--ake-color-surface-hover);
}

.mission-mobile-directory code {
  color: var(--ake-color-text-muted);
  font-size: var(--ake-font-size-xs);
}

@media (max-width: 62.4375rem) {
  .mission-module {
    grid-template-columns: minmax(0, 1fr);
    min-height: calc(100dvh - 5.9375rem);
  }

  .mission-sidebar {
    display: none;
  }

  .mission-mobile-list-button {
    display: inline-flex;
  }

  .mission-overview,
  .mission-detail-page {
    padding: var(--ake-space-4);
  }

  .mission-tabs {
    top: calc(-1 * var(--ake-space-4));
    margin-inline: calc(-1 * var(--ake-space-4));
    padding-inline: var(--ake-space-4);
  }

  .mission-stat-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .mission-dialog-line {
    grid-template-columns: minmax(0, 1fr);
  }

  .mission-dialog-line__id {
    grid-column: 1;
  }

  .mission-dialog-line.has-avatar {
    grid-template-columns: 2.75rem minmax(0, 1fr);
  }

  .mission-dialog-line.has-avatar .mission-dialog-line__text,
  .mission-dialog-line.has-avatar .mission-dialog-line__id {
    grid-column: 1 / -1;
  }

  .mission-hero,
  .mission-overview__header {
    flex-direction: column;
  }
}

@media (max-width: 32.5rem) {
  .mission-stat-grid,
  .mission-type-grid,
  .mission-info-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .mission-dialog-choice__buttons button {
    width: 100%;
  }
}
</style>
