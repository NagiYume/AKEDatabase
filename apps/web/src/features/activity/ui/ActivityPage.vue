<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, type CSSProperties } from 'vue'
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
  SearchToolbar
} from '@ake/ui'
import { LANGUAGE_INFO } from '@ake/r2-contract'
import { useAppContext } from '../../../app/providers/app-context'
import { usePreferencesStore } from '../../../app/stores/preferences'
import { userErrorMessageKey } from '../../../shared/i18n'
import { getActivityRepository } from '../api/repository'
import {
  buildActivityTimeline,
  filterActivities,
  resolveActivityStatus,
  sortActivities,
  type ActivityEntry,
  type ActivityStage,
  type ActivityStatus,
  type ActivityTimelineItem
} from '../model'
import { activityFallback, type ActivityCopyKey } from './copy'

defineOptions({ name: 'ActivityPage' })

const MODULE_ID = 'v3_activity'
const STATUS_VALUES = ['active', 'upcoming', 'ended', 'permanent'] as const
const TIMELINE_DAY_WIDTH = 28
const STATUS_ORDER: Readonly<Record<ActivityStatus, number>> = {
  active: 0,
  upcoming: 1,
  ended: 2,
  permanent: 3
}

const { t, te, locale } = useI18n()
const route = useRoute()
const router = useRouter()
const preferences = usePreferencesStore()
const { client, dataState } = useAppContext()
const repository = getActivityRepository(client)
const search = ref('')
const selectedTags = ref(new Set<string>())
const selectedStatus = ref<ActivityStatus | null>(null)
const mobileDirectoryOpen = ref(false)
const now = ref(Date.now())
let clock: ReturnType<typeof setInterval> | undefined

onMounted(() => {
  clock = setInterval(() => {
    now.value = Date.now()
  }, 1_000)
})

onBeforeUnmount(() => {
  if (clock) clearInterval(clock)
})

function tr(key: ActivityCopyKey): string {
  const globalKey = `modules.activity.${key}`
  return te(globalKey) ? String(t(globalKey)) : activityFallback(key, String(locale.value))
}

function entityParam(): string {
  const value = route.query.id
  return Array.isArray(value) ? (value[0] ?? '') : typeof value === 'string' ? value : ''
}

const selectedId = computed(entityParam)
const {
  data: catalog,
  isPending,
  isError,
  error,
  refetch
} = useQuery({
  queryKey: computed(() => [
    'activity',
    'catalog',
    dataState.value.baseUrl,
    dataState.value.selected.id,
    dataState.value.manifest.sharedRevision,
    dataState.value.locale,
    preferences.showVersionChanges
  ]),
  queryFn: ({ signal }) => repository.catalog(preferences.showVersionChanges, signal)
})

const accessibleEntries = computed(() =>
  (catalog.value?.entries ?? []).filter((entry) => preferences.showHidden || !entry.hidden)
)
const selectedStatusSet = computed<ReadonlySet<ActivityStatus>>(() =>
  selectedStatus.value ? new Set([selectedStatus.value]) : new Set()
)
const visibleEntries = computed(() =>
  sortActivities(
    filterActivities(accessibleEntries.value, {
      search: search.value,
      tags: selectedTags.value,
      statuses: selectedStatusSet.value,
      showHidden: true,
      now: now.value
    }),
    now.value
  )
)
const selectedEntry = computed(() => {
  const id = selectedId.value
  return id ? (accessibleEntries.value.find((entry) => entry.id === id) ?? null) : null
})
const timeline = computed(() => buildActivityTimeline(visibleEntries.value, now.value, 14, 90))
const timelineItems = computed(() =>
  timeline.value.items.filter((item) => Boolean(item.openAt && item.closeAt))
)
const timelineDays = computed(() => {
  const language = LANGUAGE_INFO[dataState.value.locale].htmlLang
  return Array.from({ length: timeline.value.dayCount }, (_, index) => {
    const date = new Date(timeline.value.windowStart + index * 86_400_000)
    return {
      id: date.toISOString(),
      label: new Intl.DateTimeFormat(language, {
        month: date.getDate() === 1 || index === 0 ? 'numeric' : undefined,
        day: '2-digit'
      }).format(date),
      monthStart: date.getDate() === 1 || index === 0
    }
  })
})
const timelineCanvasStyle = computed<CSSProperties>(
  () =>
    ({
      '--activity-timeline-days': timeline.value.dayCount,
      '--activity-timeline-day-width': `${TIMELINE_DAY_WIDTH}px`,
      '--activity-timeline-today': `${
        ((timeline.value.now - timeline.value.windowStart) / 86_400_000) * TIMELINE_DAY_WIDTH
      }px`
    }) as CSSProperties
)
const overviewGroups = computed(() => {
  const groups = new Map<ActivityStatus, ActivityEntry[]>()
  for (const entry of visibleEntries.value) {
    const status = resolveActivityStatus(entry, now.value)
    const entries = groups.get(status) ?? []
    entries.push(entry)
    groups.set(status, entries)
  }
  return [...groups.entries()]
    .sort(([left], [right]) => STATUS_ORDER[left] - STATUS_ORDER[right])
    .map(([status, entries]) => ({ status, entries }))
})

function imageUrl(path: string): string {
  return path ? client.resolveImageUrl(path) : ''
}

function statusLabel(status: ActivityStatus): string {
  return tr(status)
}

function errorMessage(value: unknown): string {
  return String(t(userErrorMessageKey(value)))
}

function formatTimestamp(value: number | null, fallback = ''): string {
  if (value === null || !Number.isFinite(value)) return fallback || String(t('common.notAvailable'))
  return new Intl.DateTimeFormat(LANGUAGE_INFO[dataState.value.locale].htmlLang, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).format(value)
}

function scheduleLabel(entry: Pick<ActivityEntry | ActivityStage, 'ranges' | 'openAt' | 'closeAt'>): string {
  const primary = entry.ranges[0]
  const open = formatTimestamp(primary?.openTimestamp ?? null, entry.openAt)
  const close = entry.closeAt ? formatTimestamp(primary?.closeTimestamp ?? null, entry.closeAt) : tr('noEnd')
  return `${open} - ${close}`
}

function duration(value: number): string {
  const seconds = Math.max(0, Math.floor(value / 1_000))
  const days = Math.floor(seconds / 86_400)
  const hours = Math.floor((seconds % 86_400) / 3_600)
  const minutes = Math.floor((seconds % 3_600) / 60)
  const remainder = seconds % 60
  const time = [hours, minutes, remainder].map((part) => String(part).padStart(2, '0')).join(':')
  return days ? `${days}${tr('days')} ${time}` : time
}

function countdownLabel(entry: Pick<ActivityEntry | ActivityStage, 'ranges' | 'openAt' | 'closeAt'>): string {
  const status = resolveActivityStatus(entry, now.value)
  const range = entry.ranges[0]
  if (status === 'upcoming' && range?.openTimestamp !== null && range?.openTimestamp !== undefined) {
    return `${tr('startsIn')} ${duration(range.openTimestamp - now.value)}`
  }
  if (status === 'active' && range?.closeTimestamp !== null && range?.closeTimestamp !== undefined) {
    return `${tr('endsIn')} ${duration(range.closeTimestamp - now.value)}`
  }
  return ''
}

function toggleTag(tagId: string): void {
  const next = new Set(selectedTags.value)
  if (next.has(tagId)) next.delete(tagId)
  else next.add(tagId)
  selectedTags.value = next
}

function selectStatus(status: ActivityStatus | null): void {
  selectedStatus.value = status
}

function openActivity(entry: ActivityEntry): void {
  mobileDirectoryOpen.value = false
  void router.push({
    name: 'module',
    params: { moduleId: MODULE_ID },
    query: { ...route.query, id: entry.id }
  })
}

function showOverview(): void {
  mobileDirectoryOpen.value = false
  void router.push({
    name: 'module',
    params: { moduleId: MODULE_ID },
    query: { ...route.query, id: undefined }
  })
}

function openTimelineItem(item: ActivityTimelineItem): void {
  const entry = catalog.value?.details[item.activityId]
  if (entry) openActivity(entry)
}

function timelineItemStyle(item: ActivityTimelineItem): CSSProperties {
  return {
    '--activity-timeline-left': `${item.offsetDays * TIMELINE_DAY_WIDTH}px`,
    '--activity-timeline-width': `${Math.max(3, item.durationDays * TIMELINE_DAY_WIDTH)}px`
  } as CSSProperties
}
</script>

<template>
  <div class="activity-module">
    <aside class="activity-sidebar">
      <DirectoryPanel :ariaLabel="tr('directory')">
        <template #toolbar>
          <div class="activity-search-row" data-activity-directory-block="search">
            <button
              class="activity-home-button"
              type="button"
              :aria-label="tr('overview')"
              @click="showOverview"
            >
              <House :size="18" aria-hidden="true" />
            </button>
            <SearchToolbar
              v-model="search"
              :ariaLabel="t('common.search')"
              :clear-label="t('common.clear')"
              :placeholder="tr('searchPlaceholder')"
            />
          </div>
          <div
            v-if="catalog?.tags.length"
            class="activity-filter-section"
            data-activity-directory-block="type"
            :aria-label="tr('type')"
          >
            <span class="activity-filter-label">{{ tr('type') }}</span>
            <div class="activity-filter-buttons">
              <button
                v-for="tag in catalog.tags"
                :key="tag.id"
                type="button"
                class="activity-filter-button"
                :aria-pressed="selectedTags.has(tag.id)"
                @click="toggleTag(tag.id)"
              >
                {{ tag.name }}
              </button>
            </div>
          </div>
          <div
            class="activity-filter-section"
            data-activity-directory-block="status"
            :aria-label="tr('statuses')"
          >
            <span class="activity-filter-label">{{ tr('status') }}</span>
            <div class="activity-filter-buttons">
              <button
                type="button"
                class="activity-filter-button"
                :aria-pressed="selectedStatus === null"
                @click="selectStatus(null)"
              >
                {{ t('common.all') }}
              </button>
              <button
                v-for="status in STATUS_VALUES"
                :key="status"
                type="button"
                class="activity-filter-button"
                :aria-pressed="selectedStatus === status"
                @click="selectStatus(status)"
              >
                {{ statusLabel(status) }}
              </button>
            </div>
          </div>
        </template>

        <LoadingState v-if="isPending" compact :label="t('common.loading')" />
        <ErrorState
          v-else-if="isError"
          compact
          :title="t('common.error')"
          :description="errorMessage(error)"
          :retry-label="t('common.retry')"
          @retry="refetch()"
        />
        <EmptyState v-else-if="visibleEntries.length === 0" compact :title="t('common.empty')" />
        <div v-else class="activity-directory" data-activity-directory-block="list">
          <button
            v-for="entry in visibleEntries"
            :key="entry.id"
            type="button"
            class="activity-directory__item"
            :class="{ 'is-active': entry.id === selectedId }"
            :aria-label="`${tr('openActivity')}: ${entry.name}`"
            @click="openActivity(entry)"
          >
            <ImageWithFallback
              class="activity-directory__backdrop"
              :src="imageUrl(entry.image)"
              alt=""
              width="260"
              height="70"
              aspect-ratio="26 / 7"
            />
            <span class="activity-directory__body">
              <strong>{{ entry.name }}</strong>
              <code>{{ entry.id }}</code>
            </span>
            <span class="activity-status" :data-status="resolveActivityStatus(entry, now)">
              {{ statusLabel(resolveActivityStatus(entry, now)) }}
            </span>
          </button>
        </div>
      </DirectoryPanel>
    </aside>

    <div class="activity-detail" role="region" :aria-label="tr('overview')">
      <LoadingState v-if="isPending" :label="t('common.loading')" />
      <ErrorState
        v-else-if="isError"
        :title="t('common.error')"
        :description="errorMessage(error)"
        :retry-label="t('common.retry')"
        @retry="refetch()"
      />
      <ErrorState
        v-else-if="selectedId && !selectedEntry"
        :title="t('errors.notFoundTitle')"
        :description="t('errors.deepLinkMissing')"
      />

      <article v-else-if="selectedEntry" class="activity-detail-container">
        <header class="detail-header" data-activity-block="header">
          <h1 class="detail-name">{{ selectedEntry.name }}</h1>
          <span
            class="activity-status detail-status"
            :data-status="resolveActivityStatus(selectedEntry, now)"
          >
            {{ statusLabel(resolveActivityStatus(selectedEntry, now)) }}
          </span>
        </header>
        <p class="detail-time" data-activity-block="time">{{ scheduleLabel(selectedEntry) }}</p>
        <div v-if="selectedEntry.tags.length" class="activity-tags" data-activity-block="tags">
          <span v-for="tag in selectedEntry.tags" :key="tag.id" class="activity-tag">{{ tag.name }}</span>
        </div>
        <p v-if="countdownLabel(selectedEntry)" class="detail-countdown" data-activity-block="countdown">
          {{ countdownLabel(selectedEntry) }}
        </p>
        <p class="detail-description" data-activity-block="description">
          {{ selectedEntry.description }}
        </p>

        <section
          v-if="selectedEntry.conditions.length"
          class="detail-section"
          data-activity-block="conditions"
        >
          <h2>{{ tr('conditions') }}</h2>
          <ul class="conditions-list">
            <li v-for="condition in selectedEntry.conditions" :key="condition.id">
              {{ condition.description || condition.tips || condition.id }}
            </li>
          </ul>
        </section>

        <section
          v-if="selectedEntry.reward.items.length"
          class="detail-section"
          data-activity-block="rewards"
        >
          <h2>{{ tr('rewards') }}</h2>
          <div class="reward-grid">
            <article
              v-for="item in selectedEntry.reward.items"
              :key="`${item.id}:${item.probable}`"
              class="reward-item"
            >
              <ImageWithFallback
                class="reward-icon"
                :src="imageUrl(item.icon)"
                :alt="item.name"
                width="40"
                height="40"
                aspect-ratio="1"
              />
              <span class="reward-name">{{ item.name }}</span>
              <strong class="reward-count">×{{ item.count }}</strong>
            </article>
          </div>
        </section>

        <section v-if="selectedEntry.stages.length" class="stage-section" data-activity-block="stages">
          <h2>{{ tr('stages') }}</h2>
          <div class="stage-list">
            <article
              v-for="stage in selectedEntry.stages"
              :key="`${stage.kind}:${stage.id}`"
              class="stage-card"
            >
              <h3 class="stage-name">{{ stage.name }}</h3>
              <p v-if="stage.description" class="stage-description">{{ stage.description }}</p>
              <p v-if="stage.openAt" class="stage-time">
                {{ scheduleLabel(stage)
                }}<template v-if="countdownLabel(stage)"> · {{ countdownLabel(stage) }}</template>
              </p>
              <div v-if="stage.reward.items.length" class="stage-rewards">
                <strong class="stage-rewards-title">{{ tr('rewards') }}</strong>
                <div class="reward-grid">
                  <article
                    v-for="item in stage.reward.items"
                    :key="`${stage.id}:${item.id}:${item.probable}`"
                    class="reward-item"
                  >
                    <ImageWithFallback
                      class="reward-icon"
                      :src="imageUrl(item.icon)"
                      :alt="item.name"
                      width="40"
                      height="40"
                      aspect-ratio="1"
                    />
                    <span class="reward-name">{{ item.name }}</span>
                    <strong class="reward-count">×{{ item.count }}</strong>
                  </article>
                </div>
              </div>
            </article>
          </div>
        </section>
      </article>

      <section v-else class="ake-overview activity-overview">
        <header class="ake-overview__header">
          <div class="ake-overview__eyebrow">{{ t('common.count', { count: visibleEntries.length }) }}</div>
          <h1>{{ tr('overview') }}</h1>
          <p>{{ tr('overviewDescription') }}</p>
        </header>

        <section v-if="timelineItems.length" class="activity-timeline" :aria-label="tr('timeline')">
          <div class="activity-timeline__viewport">
            <div class="activity-timeline__canvas" :style="timelineCanvasStyle">
              <div class="activity-timeline__axis" aria-hidden="true">
                <span
                  v-for="day in timelineDays"
                  :key="day.id"
                  class="activity-timeline__tick"
                  :class="{ 'is-month-start': day.monthStart }"
                  >{{ day.label }}</span
                >
              </div>
              <div
                v-for="item in timelineItems"
                :key="`${item.activityId}:${item.start}`"
                class="activity-timeline__row"
              >
                <button
                  type="button"
                  class="activity-timeline__bar"
                  :data-status="item.status"
                  :style="timelineItemStyle(item)"
                  :aria-label="`${tr('openActivity')}: ${item.name}`"
                  @click="openTimelineItem(item)"
                >
                  <span>{{ item.name }}</span>
                  <ImageWithFallback
                    v-if="item.image"
                    class="activity-timeline__image"
                    :src="imageUrl(item.image)"
                    alt=""
                    width="70"
                    height="32"
                    aspect-ratio="35 / 16"
                  />
                </button>
              </div>
              <span class="activity-timeline__today" aria-hidden="true" />
            </div>
          </div>
        </section>

        <EmptyState v-if="visibleEntries.length === 0" compact :title="t('common.empty')" />
        <section v-for="group in overviewGroups" v-else :key="group.status" class="ake-overview__section">
          <h2>
            <span>{{ statusLabel(group.status) }}</span
            ><b>{{ group.entries.length }}</b>
          </h2>
          <div class="ake-overview__grid">
            <button
              v-for="entry in group.entries"
              :key="entry.id"
              type="button"
              class="ake-overview__card"
              :data-status="group.status"
              @click="openActivity(entry)"
            >
              <span class="ake-overview__visual">
                <ImageWithFallback
                  v-if="entry.image"
                  :src="imageUrl(entry.image)"
                  alt=""
                  width="76"
                  height="88"
                  aspect-ratio="19 / 22"
                />
                <span v-else>DATA</span>
              </span>
              <span class="ake-overview__body">
                <strong class="ake-overview__title">{{ entry.name }}</strong>
                <code class="ake-overview__id">{{ entry.id }}</code>
                <span class="ake-overview__tags">
                  <span v-for="tag in entry.tags" :key="tag.id">{{ tag.name }}</span>
                  <span>{{ scheduleLabel(entry) }}</span>
                </span>
              </span>
            </button>
          </div>
        </section>
      </section>
    </div>

    <ResponsiveDrawer
      v-model:open="mobileDirectoryOpen"
      side="left"
      :title="tr('directory')"
      :close-label="t('common.close')"
    >
      <template #trigger>
        <button class="activity-mobile-list-button" type="button" :aria-label="tr('directory')">
          <List :size="18" aria-hidden="true" />
          <span>{{ t('common.list') }}</span>
        </button>
      </template>
      <EmptyState v-if="visibleEntries.length === 0" compact :title="t('common.empty')" />
      <div v-else class="activity-mobile-directory">
        <button
          v-for="entry in visibleEntries"
          :key="entry.id"
          type="button"
          :class="{ 'is-active': entry.id === selectedId }"
          @click="openActivity(entry)"
        >
          <span>{{ entry.name }}</span
          ><code>{{ entry.id }}</code>
        </button>
      </div>
    </ResponsiveDrawer>
  </div>
</template>

<style scoped>
.activity-module {
  position: relative;
  display: grid;
  grid-template-columns: 260px minmax(0, 1fr);
  gap: 20px;
  width: 100%;
  height: 100%;
  min-height: 31.25rem;
  overflow: hidden;
}

.activity-sidebar {
  min-width: 0;
  overflow: hidden;
  background: var(--ake-color-surface-muted);
}

.activity-search-row {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: var(--ake-space-2);
}

.activity-search-row > :deep(.ake-search-toolbar) {
  min-width: 0;
  flex: 1;
}

.activity-home-button {
  display: grid;
  width: var(--ake-control-height-md);
  height: var(--ake-control-height-md);
  flex: 0 0 auto;
  padding: 0;
  place-items: center;
  border: var(--ake-border-width) solid var(--ake-color-border);
  border-radius: var(--ake-radius-sm);
  color: var(--ake-color-accent);
  background: var(--ake-color-surface);
  cursor: pointer;
}

.activity-filter-section {
  display: flex;
  align-items: flex-start;
  gap: var(--ake-space-2);
  margin-block-start: var(--ake-space-2);
}

.activity-filter-label {
  flex: 0 0 auto;
  padding-block-start: 3px;
  color: var(--ake-color-text-muted);
  font-size: var(--ake-font-size-xs);
}

.activity-filter-buttons {
  display: flex;
  min-width: 0;
  flex-wrap: wrap;
  gap: var(--ake-space-1);
}

.activity-filter-button {
  padding: 2px var(--ake-space-2);
  border: var(--ake-border-width) solid var(--ake-color-border);
  border-radius: 999px;
  color: var(--ake-color-text);
  background: var(--ake-color-surface);
  font-size: var(--ake-font-size-xs);
  cursor: pointer;
}

.activity-filter-button[aria-pressed='true'] {
  border-color: var(--ake-color-accent);
  color: var(--ake-color-on-accent);
  background: var(--ake-color-accent);
}

.activity-directory {
  display: grid;
  gap: var(--ake-space-2);
  padding: var(--ake-space-3);
}

.activity-directory__item {
  position: relative;
  display: flex;
  min-width: 0;
  min-height: 4.375rem;
  align-items: center;
  justify-content: space-between;
  gap: var(--ake-space-2);
  padding: var(--ake-space-3);
  overflow: hidden;
  border: var(--ake-border-width) solid var(--ake-color-border);
  border-radius: var(--ake-radius-md);
  color: var(--ake-color-text);
  background: var(--ake-color-surface);
  text-align: start;
  cursor: pointer;
}

.activity-directory__item:hover,
.activity-directory__item.is-active {
  background: var(--ake-color-surface-hover);
}

.activity-directory__item.is-active {
  border-inline-start: 5px solid var(--ake-color-accent);
}

.activity-directory__backdrop {
  position: absolute;
  z-index: 0;
  inset: 0;
  width: 100%;
  height: 100%;
  opacity: 0.2;
}

.activity-directory__body,
.activity-directory__item > .activity-status {
  position: relative;
  z-index: 1;
}

.activity-directory__body {
  display: grid;
  min-width: 0;
}

.activity-directory__body strong,
.activity-directory__body code {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.activity-directory__body code {
  color: var(--ake-color-text-muted);
  font-size: var(--ake-font-size-xs);
}

.activity-status {
  display: inline-flex;
  width: fit-content;
  flex: 0 0 auto;
  padding: 2px var(--ake-space-2);
  border-radius: 999px;
  color: var(--ake-color-text-muted);
  background: var(--ake-color-surface-muted);
  font-size: var(--ake-font-size-xs);
  white-space: nowrap;
}

.activity-status[data-status='active'],
.ake-overview__card[data-status='active'] {
  --activity-status-color: var(--ake-color-success);
}

.activity-status[data-status='upcoming'],
.ake-overview__card[data-status='upcoming'] {
  --activity-status-color: var(--ake-color-warning);
}

.activity-status[data-status='ended'],
.ake-overview__card[data-status='ended'] {
  --activity-status-color: var(--ake-color-text-muted);
}

.activity-status[data-status='permanent'],
.ake-overview__card[data-status='permanent'] {
  --activity-status-color: var(--ake-color-accent);
}

.activity-status[data-status] {
  color: var(--activity-status-color);
  background: var(--ake-color-surface-muted);
}

.activity-detail {
  min-width: 0;
  padding: var(--ake-space-5);
  overflow: auto;
  overscroll-behavior: contain;
  border: var(--ake-border-width) solid var(--ake-color-border);
  border-radius: var(--ake-radius-lg);
  background: var(--ake-color-surface);
}

.activity-detail-container {
  width: min(100%, 68.75rem);
  margin-inline: auto;
}

.detail-header {
  display: flex;
  align-items: center;
  gap: var(--ake-space-3);
  margin-block-end: var(--ake-space-2);
}

.detail-name {
  margin: 0;
  font-size: var(--ake-font-size-2xl);
  letter-spacing: 0;
}

.detail-time {
  margin: 0 0 var(--ake-space-3);
  color: var(--ake-color-text-muted);
  font-size: var(--ake-font-size-sm);
}

.activity-tags {
  display: flex;
  flex-wrap: wrap;
  gap: var(--ake-space-2);
  margin-block-end: var(--ake-space-2);
}

.activity-tag,
.stage-time {
  width: fit-content;
  padding: var(--ake-space-1) var(--ake-space-2);
  border-radius: 999px;
  color: var(--ake-color-text-muted);
  background: var(--ake-color-surface-muted);
  font-size: var(--ake-font-size-xs);
}

.detail-countdown {
  width: fit-content;
  margin: var(--ake-space-2) 0;
  padding: var(--ake-space-1) var(--ake-space-3);
  border-radius: 999px;
  color: var(--ake-color-accent);
  background: var(--ake-color-accent-soft);
  font-weight: 700;
}

.detail-description {
  margin: var(--ake-space-3) 0 0;
  padding: var(--ake-space-3);
  border: var(--ake-border-width) solid var(--ake-color-border);
  border-radius: var(--ake-radius-sm);
  background: var(--ake-color-surface-muted);
  line-height: var(--ake-line-height-relaxed);
  white-space: pre-wrap;
}

.detail-section,
.stage-section {
  margin-block-start: var(--ake-space-7);
}

.detail-section > h2,
.stage-section > h2 {
  margin: 0 0 var(--ake-space-4);
  padding-block-end: var(--ake-space-2);
  border-block-end: 2px solid var(--ake-color-border);
  font-size: var(--ake-font-size-xl);
  letter-spacing: 0;
}

.conditions-list {
  margin: 0;
  padding-inline-start: var(--ake-space-5);
  color: var(--ake-color-text-muted);
}

.conditions-list li + li {
  margin-block-start: var(--ake-space-2);
}

.reward-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 12.5rem), 1fr));
  gap: var(--ake-space-3);
}

.reward-item {
  display: grid;
  grid-template-columns: 2.5rem minmax(0, 1fr) auto;
  min-width: 0;
  align-items: center;
  gap: var(--ake-space-2);
  padding: var(--ake-space-2);
  border: var(--ake-border-width) solid var(--ake-color-border);
  border-radius: var(--ake-radius-md);
  background: var(--ake-color-surface-muted);
}

.reward-icon {
  width: 2.5rem;
  height: 2.5rem;
}

.reward-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.reward-count {
  color: var(--ake-color-accent);
}

.stage-list {
  display: grid;
  gap: var(--ake-space-5);
}

.stage-card {
  padding: var(--ake-space-4);
  border: var(--ake-border-width) solid var(--ake-color-border);
  border-radius: var(--ake-radius-lg);
  background: var(--ake-color-surface-muted);
}

.stage-name,
.stage-description,
.stage-time {
  margin-block-start: 0;
}

.stage-name {
  margin-block-end: var(--ake-space-2);
  letter-spacing: 0;
}

.stage-description {
  margin-block-end: var(--ake-space-3);
  color: var(--ake-color-text-muted);
  font-style: italic;
  white-space: pre-wrap;
}

.stage-rewards {
  margin-block-start: var(--ake-space-4);
}

.stage-rewards-title {
  display: block;
  margin-block-end: var(--ake-space-2);
}

.activity-overview {
  min-height: 100%;
}

.ake-overview__header {
  margin-block-end: var(--ake-space-6);
  padding: var(--ake-space-5);
  border: var(--ake-border-width) solid var(--ake-color-border);
  border-inline-start: 5px solid var(--ake-color-accent);
  border-radius: var(--ake-radius-md);
}

.ake-overview__eyebrow {
  margin-block-end: var(--ake-space-2);
  color: var(--ake-color-accent);
  font-size: var(--ake-font-size-xs);
  font-weight: 800;
  text-transform: uppercase;
}

.ake-overview__header h1,
.ake-overview__header p {
  margin: 0;
  letter-spacing: 0;
}

.ake-overview__header p {
  margin-block-start: var(--ake-space-2);
  color: var(--ake-color-text-muted);
}

.activity-timeline {
  margin: 0 0 var(--ake-space-7);
  border-block: var(--ake-border-width) solid var(--ake-color-border);
}

.activity-timeline__viewport {
  overflow-x: auto;
  overscroll-behavior-inline: contain;
}

.activity-timeline__canvas {
  position: relative;
  width: calc(var(--activity-timeline-days) * var(--activity-timeline-day-width));
  min-width: 100%;
  padding-block-end: var(--ake-space-2);
}

.activity-timeline__axis,
.activity-timeline__row {
  display: grid;
  grid-template-columns: repeat(var(--activity-timeline-days), var(--activity-timeline-day-width));
}

.activity-timeline__axis {
  min-height: 2.375rem;
  border-block-end: var(--ake-border-width) solid var(--ake-color-border);
  background: var(--ake-color-surface-muted);
}

.activity-timeline__tick {
  display: grid;
  place-items: center;
  border-inline-end: var(--ake-border-width) solid var(--ake-color-border);
  color: var(--ake-color-text-muted);
  font-size: var(--ake-font-size-xs);
  white-space: nowrap;
}

.activity-timeline__tick.is-month-start {
  border-inline-start: 2px solid var(--ake-color-accent);
  color: var(--ake-color-text);
  font-weight: 700;
}

.activity-timeline__row {
  position: relative;
  min-height: 2.75rem;
  align-items: center;
  border-block-end: var(--ake-border-width) solid var(--ake-color-border);
}

.activity-timeline__bar {
  position: absolute;
  z-index: 1;
  inset-block-start: 0.375rem;
  left: var(--activity-timeline-left);
  display: flex;
  width: var(--activity-timeline-width);
  height: 2rem;
  min-width: 3px;
  align-items: center;
  gap: var(--ake-space-2);
  padding: 0 var(--ake-space-2);
  overflow: hidden;
  border: var(--ake-border-width) solid var(--activity-status-color, var(--ake-color-accent));
  border-inline-start-width: 4px;
  border-radius: var(--ake-radius-sm);
  color: var(--ake-color-text);
  background: var(--ake-color-surface-muted);
  text-align: start;
  white-space: nowrap;
  cursor: pointer;
}

.activity-timeline__bar > span {
  position: sticky;
  left: 0;
  z-index: 1;
  overflow: hidden;
  text-overflow: ellipsis;
}

.activity-timeline__image {
  position: absolute;
  inset-block: 0;
  right: 0;
  width: auto;
  max-width: 70%;
  height: 100%;
  opacity: 0.34;
}

.activity-timeline__today {
  position: absolute;
  z-index: 2;
  inset-block: 0;
  left: var(--activity-timeline-today);
  width: 2px;
  pointer-events: none;
  background: var(--ake-color-danger);
}

.ake-overview__section {
  margin-block-start: var(--ake-space-7);
}

.ake-overview__section > h2 {
  display: flex;
  align-items: baseline;
  gap: var(--ake-space-2);
  margin: 0 0 var(--ake-space-3);
  font-size: var(--ake-font-size-lg);
  letter-spacing: 0;
}

.ake-overview__section > h2::after {
  height: var(--ake-border-width);
  flex: 1;
  background: var(--ake-color-border);
  content: '';
}

.ake-overview__section > h2 b {
  order: 2;
  padding: 2px var(--ake-space-2);
  border-radius: 999px;
  color: var(--ake-color-text-muted);
  background: var(--ake-color-surface-muted);
  font-size: var(--ake-font-size-xs);
}

.ake-overview__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 12.8125rem), 1fr));
  gap: var(--ake-space-3);
}

.ake-overview__card {
  --activity-status-color: var(--ake-color-accent);
  display: grid;
  grid-template-columns: 4.75rem minmax(0, 1fr);
  min-width: 0;
  min-height: 5.5rem;
  padding: 0;
  overflow: hidden;
  border: 2px solid var(--activity-status-color);
  border-radius: var(--ake-radius-md);
  color: var(--ake-color-text);
  background: var(--ake-color-surface);
  text-align: start;
  cursor: pointer;
}

.ake-overview__visual {
  display: grid;
  min-height: 5.5rem;
  place-items: center;
  overflow: hidden;
  color: var(--ake-color-text-muted);
  background: var(--ake-color-surface-muted);
  font-size: var(--ake-font-size-xs);
  font-weight: 800;
}

.ake-overview__visual > :deep(.ake-image) {
  width: 100%;
  height: 100%;
}

.ake-overview__body {
  display: block;
  min-width: 0;
  padding: var(--ake-space-3);
}

.ake-overview__title,
.ake-overview__id {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ake-overview__id {
  margin-block-start: var(--ake-space-1);
  color: var(--ake-color-text-muted);
  font-size: var(--ake-font-size-xs);
}

.ake-overview__tags {
  display: flex;
  min-width: 0;
  flex-wrap: wrap;
  gap: var(--ake-space-1);
  margin-block-start: var(--ake-space-2);
}

.ake-overview__tags span {
  max-width: 100%;
  padding: 2px var(--ake-space-2);
  overflow: hidden;
  border: var(--ake-border-width) solid var(--ake-color-border);
  border-radius: var(--ake-radius-sm);
  color: var(--ake-color-text-muted);
  font-size: var(--ake-font-size-xs);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.activity-mobile-list-button {
  position: fixed;
  z-index: var(--ake-z-sticky);
  right: var(--ake-space-4);
  bottom: 5rem;
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

.activity-mobile-directory {
  display: grid;
  gap: var(--ake-space-2);
}

.activity-mobile-directory button {
  display: grid;
  gap: var(--ake-space-1);
  padding: var(--ake-space-3);
  border: var(--ake-border-width) solid var(--ake-color-border);
  border-radius: var(--ake-radius-md);
  color: var(--ake-color-text);
  background: var(--ake-color-surface);
  text-align: start;
  cursor: pointer;
}

.activity-mobile-directory button.is-active {
  border-inline-start: 4px solid var(--ake-color-accent);
  background: var(--ake-color-surface-hover);
}

.activity-mobile-directory code {
  color: var(--ake-color-text-muted);
  font-size: var(--ake-font-size-xs);
}

@media (max-width: 62.4375rem) {
  .activity-module {
    grid-template-columns: minmax(0, 1fr);
    gap: 0;
  }

  .activity-sidebar {
    display: none;
  }

  .activity-mobile-list-button {
    display: inline-flex;
  }

  .activity-detail {
    border: 0;
    border-radius: 0;
  }
}

@media (max-width: 34rem) {
  .activity-detail {
    padding: var(--ake-space-3);
  }

  .detail-header {
    align-items: flex-start;
    flex-direction: column;
  }

  .reward-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
