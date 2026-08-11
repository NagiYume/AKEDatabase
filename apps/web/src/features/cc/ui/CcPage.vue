<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { useQuery } from '@tanstack/vue-query'
import { List, RotateCcw, ShieldAlert } from '@lucide/vue'
import { EmptyState, ErrorState, ImageWithFallback, LoadingState, ResponsiveDrawer } from '@ake/ui'
import { LANGUAGE_INFO, type AppLocale } from '@ake/r2-contract'
import { useAppContext } from '../../../app/providers/app-context'
import { usePreferencesStore } from '../../../app/stores/preferences'
import { userErrorMessageKey } from '../../../shared/i18n'
import { getCcRepository } from '../api/repository'
import {
  availableCcKeys,
  ccSelectionScore,
  ccTermAvailability,
  filterCcEntries,
  toggleCcTerm,
  type CcActivityField,
  type CcCatalogEntry,
  type CcContractTerm,
  type CcStatus
} from '../model'
import { recalculateCcCombat } from '../model/combat'
import CcCombatSection from './CcCombatSection.vue'
import CcDirectory from './CcDirectory.vue'
import CcTermCard from './CcTermCard.vue'
import { ccCopy, type CcCopyKey } from './copy'

defineOptions({ name: 'CcPage' })

const { client, dataState } = useAppContext()
const preferences = usePreferencesStore()
const repository = getCcRepository(client)
const route = useRoute()
const router = useRouter()
const { locale, t, te } = useI18n()

const search = ref('')
const mobileDirectoryOpen = ref(false)
const selectedTermIds = ref<Set<string>>(new Set())

function tr(key: CcCopyKey, params: Readonly<Record<string, string | number>> = {}): string {
  const path = `modules.cc.${key}`
  return te(path) ? String(t(path, params)) : ccCopy(locale.value as AppLocale, key, params)
}

const requestedId = computed(() => {
  const id = route.query.id
  return Array.isArray(id) ? (id[0] ?? '') : typeof id === 'string' ? id : ''
})

const catalogQuery = useQuery({
  queryKey: computed(() => [
    'cc-catalog',
    dataState.value.baseUrl,
    dataState.value.selected.id,
    dataState.value.manifest.sharedRevision,
    dataState.value.locale,
    preferences.showHidden
  ]),
  queryFn: ({ signal }) => repository.catalog({ showHidden: preferences.showHidden }, signal)
})

const entries = computed(() => catalogQuery.data.value?.entries ?? [])
const visibleEntries = computed(() => filterCcEntries(entries.value, search.value))
const selectedEntry = computed(() => entries.value.find((entry) => entry.id === requestedId.value) ?? null)

const detailQuery = useQuery({
  queryKey: computed(() => [
    'cc-detail',
    dataState.value.baseUrl,
    dataState.value.selected.id,
    dataState.value.manifest.sharedRevision,
    dataState.value.locale,
    selectedEntry.value?.id ?? ''
  ]),
  enabled: computed(() => Boolean(selectedEntry.value)),
  queryFn: ({ signal }) => {
    const entry = selectedEntry.value
    if (!entry) throw new Error('CC_ENTRY_NOT_SELECTED')
    return repository.detail(entry, signal)
  }
})

watch(
  () => selectedEntry.value?.id,
  () => {
    selectedTermIds.value = new Set()
  }
)

const detail = computed(() => detailQuery.data.value ?? null)
const heldKeys = computed(() => availableCcKeys(selectedTermIds.value, detail.value?.terms ?? {}))
const selectionScore = computed(() => ccSelectionScore(selectedTermIds.value, detail.value?.terms ?? {}))
const selectedTerms = computed(() =>
  [...selectedTermIds.value].flatMap((id) => {
    const term = detail.value?.terms[id]
    return term ? [term] : []
  })
)
const combatStages = computed(() =>
  detail.value ? recalculateCcCombat(detail.value.combat, selectedTermIds.value, detail.value.terms) : []
)

const catalogError = computed(() =>
  catalogQuery.isError.value ? String(t(userErrorMessageKey(catalogQuery.error.value))) : ''
)
const detailError = computed(() =>
  detailQuery.isError.value ? String(t(userErrorMessageKey(detailQuery.error.value))) : ''
)

function openEntry(entry: CcCatalogEntry): void {
  mobileDirectoryOpen.value = false
  void router.push({
    name: 'module',
    params: { moduleId: 'v3_cc' },
    query: { ...route.query, id: entry.id }
  })
}

function statusLabel(status: CcStatus): string {
  return tr(`statuses.${status}` as CcCopyKey)
}

function activityImage(id: string): string {
  return client.resolveImageUrl(
    `public/images/assets/beyond/dynamicassets/gameplay/ui/sprites/activity/${id}.png`
  )
}

function itemImage(id: string): string {
  return client.resolveImageUrl(
    `public/images/assets/beyond/dynamicassets/gameplay/ui/sprites/itemiconbig/${id}.png`
  )
}

function taskGroupImage(id: string): string {
  return client.resolveImageUrl(
    `public/images/assets/beyond/dynamicassets/gameplay/ui/sprites/contingencycontract/${id}.png`
  )
}

function parseTime(value: string): Date | null {
  if (!value) return null
  const match = value.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})\s+(\d{1,2}):(\d{1,2}):(\d{1,2})$/)
  const normalized = match
    ? `${match[1]}-${String(match[2]).padStart(2, '0')}-${String(match[3]).padStart(2, '0')}T${String(match[4]).padStart(2, '0')}:${String(match[5]).padStart(2, '0')}:${String(match[6]).padStart(2, '0')}+08:00`
    : value
  const date = new Date(normalized)
  return Number.isNaN(date.getTime()) ? null : date
}

function formatTime(value: string): string {
  const date = parseTime(value)
  if (!date) return ''
  return new Intl.DateTimeFormat(LANGUAGE_INFO[locale.value as AppLocale].htmlLang, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(date)
}

function fieldLabel(key: CcActivityField['key']): string {
  return tr(`activityInfo.${key}` as CcCopyKey)
}

function availability(term: CcContractTerm) {
  return ccTermAvailability(term.id, selectedTermIds.value, detail.value?.terms ?? {})
}

function conflictWith(term: CcContractTerm): string {
  return (
    [...selectedTermIds.value].find(
      (id) => id !== term.id && detail.value?.terms[id]?.conflictId === term.conflictId
    ) ?? ''
  )
}

function toggleTerm(id: string): void {
  if (!detail.value) return
  const result = toggleCcTerm(selectedTermIds.value, id, detail.value.terms)
  if (result.changed) selectedTermIds.value = result.selected
}

function resetTerms(): void {
  selectedTermIds.value = new Set()
}

function rewardNames(rewards: readonly { name: string; count: number }[]): string {
  return rewards.map((reward) => `${reward.name}×${reward.count}`).join(tr('rewards.separator'))
}

function levelDescription(level: {
  level: number
  score: number | null
  rewards: readonly { name: string; count: number }[]
}): string {
  const params = { level: level.level, rewards: rewardNames(level.rewards) || tr('rewards.none') }
  return level.score === null
    ? tr('rewards.allCompletedLevel', params)
    : tr('rewards.scoreLevel', { ...params, score: level.score })
}
</script>

<template>
  <div class="cc-module">
    <aside class="cc-sidebar" :aria-label="tr('directory.aria')">
      <CcDirectory
        v-model:search="search"
        :entries="visibleEntries"
        :selected-id="selectedEntry?.id ?? ''"
        :search-label="tr('search')"
        :directory-label="tr('directory.aria')"
        :empty-label="tr('noMatches')"
        :loading-label="tr('loading')"
        :error-title="tr('loadFailed')"
        :error-description="catalogError"
        :retry-label="tr('common.retry')"
        :loading="catalogQuery.isPending.value"
        :error="catalogQuery.isError.value"
        @select="openEntry"
        @retry="catalogQuery.refetch()"
      />
    </aside>

    <div class="cc-content">
      <LoadingState v-if="catalogQuery.isPending.value" :label="tr('loading')" />
      <ErrorState
        v-else-if="catalogQuery.isError.value"
        :title="tr('loadFailed')"
        :description="catalogError"
        :retry-label="tr('common.retry')"
        @retry="catalogQuery.refetch()"
      />
      <ErrorState
        v-else-if="requestedId && !selectedEntry"
        :title="t('errors.notFoundTitle')"
        :description="t('errors.deepLinkMissing')"
      />

      <section v-else-if="!requestedId" class="cc-overview" :aria-label="tr('overview.aria')">
        <header>
          <h1>{{ tr('overview.title') }}</h1>
          <p>{{ tr('overview.description') }}</p>
        </header>
        <section
          v-for="status in ['active', 'upcoming', 'ended', 'permanent'] as const"
          :key="status"
          class="cc-overview-group"
          :data-status-group="status"
        >
          <h2>{{ statusLabel(status) }}</h2>
          <div class="cc-overview-grid">
            <button
              v-for="entry in entries.filter((item) => item.status === status)"
              :key="entry.id"
              type="button"
              class="cc-overview-card"
              :data-game-id="entry.id"
              @click="openEntry(entry)"
            >
              <ImageWithFallback
                v-if="entry.imageId"
                class="cc-overview-image"
                :src="activityImage(entry.imageId)"
                :alt="entry.name"
                width="96"
                height="60"
              >
                <template #fallback><ShieldAlert :size="24" aria-hidden="true" /></template>
              </ImageWithFallback>
              <span class="cc-overview-copy">
                <b>{{ entry.name }}</b>
                <code>{{ entry.activityId }}</code>
                <small>{{ tr('counts.indicatorGroups', { count: entry.groupCount }) }}</small>
                <small>{{ tr('counts.terms', { count: entry.termCount }) }}</small>
                <small>{{ entry.dungeonName }}</small>
              </span>
            </button>
          </div>
        </section>
      </section>

      <LoadingState v-else-if="detailQuery.isPending.value" :label="tr('loading')" />
      <ErrorState
        v-else-if="detailQuery.isError.value"
        :title="tr('loadFailed')"
        :description="detailError"
        :retry-label="tr('common.retry')"
        @retry="detailQuery.refetch()"
      />
      <div v-else-if="detail" class="cc-detail">
        <header class="cc-detail-header">
          <ImageWithFallback
            v-if="detail.entry.imageId"
            class="cc-detail-image"
            :src="activityImage(detail.entry.imageId)"
            :alt="detail.entry.name"
            width="56"
            height="56"
            loading="eager"
          >
            <template #fallback><ShieldAlert :size="26" aria-hidden="true" /></template>
          </ImageWithFallback>
          <div>
            <h1>{{ detail.entry.name }}</h1>
            <p>
              {{
                tr('detail.subtitle', {
                  activityId: detail.entry.activityId,
                  gameId: detail.entry.id
                })
              }}
            </p>
            <div class="cc-detail-time">
              <b :data-status="detail.entry.status">{{ statusLabel(detail.entry.status) }}</b>
              <span v-if="detail.entry.openTime">{{ formatTime(detail.entry.openTime) }}</span>
              <span v-if="detail.entry.closeTime">{{ formatTime(detail.entry.closeTime) }}</span>
            </div>
          </div>
        </header>

        <details class="cc-section cc-configuration" data-cc-detail-block="activity-configuration">
          <summary>{{ tr('sections.activityConfiguration') }}</summary>
          <dl class="cc-info-grid">
            <div v-for="field in detail.configuration" :key="field.key">
              <dt>{{ fieldLabel(field.key) }}</dt>
              <dd>{{ field.value }}</dd>
            </div>
          </dl>
        </details>

        <section class="cc-section" data-cc-detail-block="contract-terms">
          <h2>{{ tr('sections.contractTerms') }}</h2>
          <div class="cc-score-panel">
            <div>
              <span>{{ tr('score.label') }}</span>
              <strong data-cc-score>{{ selectionScore }}</strong>
              <small>{{ tr('score.selected', { count: selectedTermIds.size }) }}</small>
            </div>
            <button type="button" :disabled="selectedTermIds.size === 0" @click="resetTerms">
              <RotateCcw :size="15" aria-hidden="true" />
              <span>{{ tr('score.reset') }}</span>
            </button>
          </div>
          <div class="cc-groups">
            <section
              v-for="group in detail.groups"
              :key="group.id"
              class="cc-group"
              :data-contract-group="group.id"
            >
              <h3>{{ tr('contract.group', { id: group.id }) }}</h3>
              <CcTermCard
                v-for="term in group.terms"
                :key="term.id"
                :term="term"
                :selected="selectedTermIds.has(term.id)"
                :availability="availability(term)"
                :held-keys="heldKeys"
                :conflict-with="conflictWith(term)"
                @toggle="toggleTerm"
              />
            </section>
          </div>
        </section>

        <section class="cc-section" data-cc-detail-block="selected-term-details">
          <h2>{{ tr('sections.selectedTermDetails') }}</h2>
          <EmptyState v-if="selectedTerms.length === 0" compact :title="tr('empty.selected')" />
          <div v-else class="cc-selected-list">
            <article v-for="term in selectedTerms" :key="term.id">
              <strong>{{ term.name }}</strong>
              <b>+{{ term.score }}</b>
              <p>{{ term.description }}</p>
            </article>
          </div>
        </section>

        <section class="cc-section" data-cc-detail-block="dungeon-enemies">
          <h2>{{ tr('sections.dungeonEnemies') }}</h2>
          <CcCombatSection v-if="combatStages.length" :stages="combatStages" />
          <EmptyState v-else compact :title="tr('empty.enemies')" />
        </section>

        <section class="cc-section" data-cc-detail-block="level-rewards">
          <h2>{{ tr('sections.levelRewards') }}</h2>
          <EmptyState v-if="detail.levelRewards.length === 0" compact :title="tr('empty.rewards')" />
          <template v-else>
            <div class="cc-levels">
              <article v-for="level in detail.levelRewards" :key="level.id">
                <strong>{{ tr('rewards.level', { level: level.level }) }}</strong>
                <div v-if="level.rewards.length">
                  <span v-for="reward in level.rewards" :key="reward.id">
                    <ImageWithFallback
                      class="cc-item-image"
                      :src="itemImage(reward.iconId)"
                      :alt="reward.name"
                      width="22"
                      height="22"
                    />
                    <span>{{ reward.name }}</span>
                    <b>×{{ reward.count }}</b>
                  </span>
                </div>
                <small v-else>{{ level.rewardId || tr('rewards.none') }}</small>
              </article>
            </div>
            <div class="cc-level-description">
              <p v-for="level in detail.levelRewards" :key="level.id">{{ levelDescription(level) }}</p>
            </div>
          </template>
        </section>

        <section class="cc-section" data-cc-detail-block="shop">
          <h2>{{ tr('sections.shop') }}</h2>
          <EmptyState v-if="!detail.shop" compact :title="tr('empty.shop')" />
          <template v-else>
            <h3>{{ tr('shop.title', { name: detail.shop.name }) }}</h3>
            <article v-for="shop in detail.shop.shops" :key="shop.id" class="cc-shop-card">
              <header>
                <strong>{{ shop.name }}</strong>
                <span>{{ tr('shop.goodsCount', { count: shop.goods.length }) }}</span>
              </header>
              <div class="cc-shop-head" aria-hidden="true">
                <span />
                <span>{{ tr('shop.item') }}</span>
                <span>{{ tr('shop.price') }}</span>
                <span>{{ tr('shop.limit') }}</span>
              </div>
              <div class="cc-shop-goods">
                <div v-for="good in shop.goods" :key="good.id" class="cc-shop-good" :data-goods-id="good.id">
                  <ImageWithFallback
                    v-if="good.rewards[0]?.iconId"
                    class="cc-goods-image"
                    :src="itemImage(good.rewards[0].iconId)"
                    :alt="good.rewards[0].name"
                    width="24"
                    height="24"
                  />
                  <span class="cc-good-name">
                    <template v-if="good.rewards.length">
                      <span v-for="reward in good.rewards" :key="reward.id">
                        {{ reward.name }}<b v-if="reward.count > 1">×{{ reward.count }}</b>
                      </span>
                    </template>
                    <span v-else>{{ good.fallbackName }}</span>
                  </span>
                  <span class="cc-good-price">
                    <del v-if="good.discountPercent">{{ good.price }}</del>
                    {{ good.actualPrice }} {{ good.currencyName }}
                    <small v-if="good.discountPercent">{{
                      tr('shop.discount', { percent: good.discountPercent })
                    }}</small>
                  </span>
                  <span>{{ good.limitCount ?? tr('shop.unlimited') }}</span>
                </div>
              </div>
            </article>
          </template>
        </section>

        <section class="cc-section" data-cc-detail-block="tasks">
          <h2>{{ tr('sections.tasks') }}</h2>
          <EmptyState v-if="detail.taskGroups.length === 0" compact :title="tr('empty.tasks')" />
          <div v-else class="cc-task-groups">
            <article v-for="group in detail.taskGroups" :key="group.id" class="cc-task-group">
              <header>
                <ImageWithFallback
                  v-if="group.iconId"
                  class="cc-task-image"
                  :src="taskGroupImage(group.iconId)"
                  :alt="group.name"
                  width="32"
                  height="32"
                />
                <strong>{{ group.name }}</strong>
                <span>{{ tr('tasks.count', { count: group.tasks.length }) }}</span>
                <span v-if="group.canUpdate">{{ tr('tasks.updatable') }}</span>
              </header>
              <EmptyState v-if="group.tasks.length === 0" compact :title="tr('tasks.empty')" />
              <div v-else class="cc-task-list">
                <article v-for="task in group.tasks" :key="task.id">
                  <code>{{ task.id }}</code>
                  <p>{{ task.description }}</p>
                  <div v-if="task.rewards.length" class="cc-task-rewards">
                    <b>{{ tr('tasks.rewards') }}</b>
                    <span v-for="reward in task.rewards" :key="reward.id">
                      <ImageWithFallback
                        class="cc-item-image"
                        :src="itemImage(reward.iconId)"
                        :alt="reward.name"
                        width="22"
                        height="22"
                      />
                      {{ reward.name }} ×{{ reward.count }}
                    </span>
                  </div>
                </article>
              </div>
            </article>
          </div>
        </section>
      </div>
    </div>

    <ResponsiveDrawer
      v-model:open="mobileDirectoryOpen"
      side="left"
      :title="tr('select')"
      :close-label="tr('common.close')"
    >
      <template #trigger>
        <button type="button" class="cc-mobile-button">
          <List :size="18" aria-hidden="true" />
          <span>{{ tr('select') }}</span>
        </button>
      </template>
      <CcDirectory
        v-model:search="search"
        :entries="visibleEntries"
        :selected-id="selectedEntry?.id ?? ''"
        :search-label="tr('search')"
        :directory-label="tr('directory.aria')"
        :empty-label="tr('noMatches')"
        :loading-label="tr('loading')"
        :error-title="tr('loadFailed')"
        :error-description="catalogError"
        :retry-label="tr('common.retry')"
        :loading="catalogQuery.isPending.value"
        :error="catalogQuery.isError.value"
        @select="openEntry"
        @retry="catalogQuery.refetch()"
      />
    </ResponsiveDrawer>
  </div>
</template>

<style scoped>
.cc-module {
  position: relative;
  display: grid;
  width: 100%;
  height: 100%;
  min-height: 31.25rem;
  grid-template-columns: 260px minmax(0, 1fr);
  gap: 20px;
  overflow: hidden;
  color: var(--ake-color-text);
}

.cc-sidebar {
  width: 260px;
  min-width: 0;
  min-height: 0;
}

.cc-content {
  min-width: 0;
  min-height: 0;
  padding: var(--ake-space-6);
  overflow-y: auto;
  overscroll-behavior: contain;
  border: var(--ake-border-width) solid var(--ake-color-border);
  border-radius: var(--ake-radius-lg);
  background: var(--ake-color-surface);
}

.cc-overview > header {
  padding-bottom: var(--ake-space-4);
  border-bottom: 2px solid var(--ake-color-border);
}

.cc-overview h1,
.cc-detail h1 {
  margin: 0;
  font-size: 1.4rem;
  letter-spacing: 0;
}

.cc-overview header p,
.cc-detail-header p {
  margin: var(--ake-space-1) 0 0;
  color: var(--ake-color-text-muted);
  font-size: 0.84rem;
}

.cc-overview-group {
  margin-top: var(--ake-space-5);
}

.cc-overview-group h2,
.cc-section > h2 {
  margin: 0 0 var(--ake-space-3);
  padding-bottom: var(--ake-space-2);
  border-bottom: var(--ake-border-width) solid var(--ake-color-border);
  font-size: 1.04rem;
  letter-spacing: 0;
}

.cc-overview-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 240px), 1fr));
  gap: var(--ake-space-3);
}

.cc-overview-card {
  display: grid;
  min-width: 0;
  min-height: 96px;
  grid-template-columns: 96px minmax(0, 1fr);
  gap: var(--ake-space-3);
  padding: var(--ake-space-3);
  border: var(--ake-border-width) solid var(--ake-color-border);
  border-radius: var(--ake-radius-sm);
  color: var(--ake-color-text);
  background: var(--ake-color-surface-muted);
  text-align: left;
  cursor: pointer;
}

.cc-overview-card:hover {
  border-color: var(--ake-color-accent);
  background: var(--ake-color-surface-hover);
}

.cc-overview-image {
  width: 96px;
  height: 60px;
  align-self: center;
}

.cc-overview-copy,
.cc-overview-copy > * {
  display: block;
  min-width: 0;
}

.cc-overview-copy b {
  overflow: hidden;
  margin-bottom: var(--ake-space-1);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cc-overview-copy code,
.cc-overview-copy small {
  color: var(--ake-color-text-muted);
  font-size: 0.68rem;
  overflow-wrap: anywhere;
}

.cc-detail-header {
  display: flex;
  align-items: center;
  gap: var(--ake-space-4);
  margin-bottom: var(--ake-space-5);
  padding-bottom: var(--ake-space-4);
  border-bottom: 2px solid var(--ake-color-border);
}

.cc-detail-image {
  width: 56px;
  height: 56px;
  flex: 0 0 auto;
}

.cc-detail-time {
  display: flex;
  flex-wrap: wrap;
  gap: var(--ake-space-3);
  margin-top: var(--ake-space-2);
  color: var(--ake-color-text-muted);
  font-size: 0.72rem;
}

.cc-detail-time b {
  color: var(--ake-color-accent);
}

.cc-section {
  margin-bottom: var(--ake-space-6);
}

.cc-configuration > summary {
  padding-bottom: var(--ake-space-2);
  border-bottom: var(--ake-border-width) solid var(--ake-color-border);
  cursor: pointer;
  font-size: 1.04rem;
  font-weight: 700;
}

.cc-info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 190px), 1fr));
  gap: var(--ake-space-2);
  margin: var(--ake-space-3) 0 0;
}

.cc-info-grid div {
  min-width: 0;
  padding: var(--ake-space-3);
  border: var(--ake-border-width) solid var(--ake-color-border);
  border-radius: var(--ake-radius-sm);
  background: var(--ake-color-surface-muted);
}

.cc-info-grid dt,
.cc-info-grid dd {
  margin: 0;
  overflow-wrap: anywhere;
}

.cc-info-grid dt {
  color: var(--ake-color-text-muted);
  font-size: 0.72rem;
}

.cc-info-grid dd {
  margin-top: var(--ake-space-1);
  font-size: 0.9rem;
  font-weight: 700;
}

.cc-score-panel {
  position: sticky;
  z-index: var(--ake-z-sticky);
  top: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--ake-space-4);
  margin-bottom: var(--ake-space-4);
  padding: var(--ake-space-3) var(--ake-space-4);
  border: var(--ake-border-width) solid var(--ake-color-border);
  border-radius: var(--ake-radius-sm);
  background: var(--ake-color-surface-raised);
  box-shadow: var(--ake-shadow-sm);
}

.cc-score-panel > div {
  display: flex;
  align-items: baseline;
  gap: var(--ake-space-2);
}

.cc-score-panel span,
.cc-score-panel small {
  color: var(--ake-color-text-muted);
  font-size: 0.76rem;
}

.cc-score-panel strong {
  color: var(--ake-color-accent);
  font-size: 1.8rem;
}

.cc-score-panel button,
.cc-mobile-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--ake-space-2);
  min-height: 34px;
  padding: 0 var(--ake-space-3);
  border: var(--ake-border-width) solid var(--ake-color-border);
  border-radius: var(--ake-radius-sm);
  color: var(--ake-color-text);
  background: var(--ake-color-surface);
  cursor: pointer;
}

.cc-score-panel button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.cc-groups {
  display: flex;
  flex-wrap: wrap;
  gap: var(--ake-space-4);
}

.cc-group {
  min-width: 0;
  flex: 1 1 360px;
  padding: var(--ake-space-3);
  border: var(--ake-border-width) solid var(--ake-color-border);
  border-radius: var(--ake-radius-sm);
  background: var(--ake-color-surface-muted);
}

.cc-group > h3,
.cc-section > h3 {
  margin: 0 0 var(--ake-space-3);
  font-size: 0.88rem;
  letter-spacing: 0;
}

.cc-group > h3 {
  padding-bottom: var(--ake-space-2);
  border-bottom: var(--ake-border-width) solid var(--ake-color-border);
}

.cc-selected-list,
.cc-task-groups,
.cc-task-list {
  display: grid;
  gap: var(--ake-space-2);
}

.cc-selected-list article {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: var(--ake-space-2);
  padding: var(--ake-space-2) 0;
  border-bottom: var(--ake-border-width) solid var(--ake-color-border);
  font-size: 0.82rem;
}

.cc-selected-list article > b {
  color: var(--ake-color-warning, #ad6100);
}

.cc-selected-list p {
  width: 100%;
  margin: 0;
  color: var(--ake-color-text-muted);
  white-space: pre-line;
}

.cc-levels {
  display: flex;
  flex-wrap: wrap;
  gap: var(--ake-space-2);
}

.cc-levels > article {
  min-width: 110px;
  padding: var(--ake-space-3);
  border: var(--ake-border-width) solid var(--ake-color-border);
  border-radius: var(--ake-radius-sm);
  background: var(--ake-color-surface-muted);
  text-align: center;
}

.cc-levels > article > strong {
  display: block;
  margin-bottom: var(--ake-space-2);
  color: var(--ake-color-accent);
}

.cc-levels article div,
.cc-levels article div > span,
.cc-task-rewards span {
  display: flex;
  align-items: center;
  gap: var(--ake-space-1);
}

.cc-levels article div {
  flex-direction: column;
}

.cc-levels article span,
.cc-levels article small {
  font-size: 0.7rem;
}

.cc-item-image,
.cc-goods-image {
  width: 22px;
  height: 22px;
  flex: 0 0 auto;
}

.cc-level-description {
  margin-top: var(--ake-space-3);
  padding: var(--ake-space-3);
  border: var(--ake-border-width) solid var(--ake-color-border);
  border-radius: var(--ake-radius-sm);
  background: var(--ake-color-surface-muted);
}

.cc-level-description p {
  margin: 0;
  color: var(--ake-color-text-muted);
  font-size: 0.76rem;
  line-height: 1.7;
}

.cc-shop-card,
.cc-task-group {
  margin-bottom: var(--ake-space-3);
  padding: var(--ake-space-3);
  border: var(--ake-border-width) solid var(--ake-color-border);
  border-radius: var(--ake-radius-sm);
  background: var(--ake-color-surface-muted);
}

.cc-shop-card > header,
.cc-task-group > header {
  display: flex;
  align-items: center;
  gap: var(--ake-space-2);
  padding-bottom: var(--ake-space-2);
  border-bottom: var(--ake-border-width) solid var(--ake-color-border);
}

.cc-shop-card > header span,
.cc-task-group > header span {
  color: var(--ake-color-text-muted);
  font-size: 0.72rem;
}

.cc-shop-card > header span {
  margin-left: auto;
}

.cc-shop-head,
.cc-shop-good {
  display: grid;
  min-width: 0;
  grid-template-columns: 28px minmax(100px, 1fr) auto 64px;
  align-items: center;
  gap: var(--ake-space-2);
  padding: 6px var(--ake-space-2);
  border-bottom: var(--ake-border-width) solid var(--ake-color-border);
  font-size: 0.74rem;
}

.cc-shop-head {
  color: var(--ake-color-text-muted);
  font-weight: 600;
}

.cc-shop-head span:nth-child(n + 3),
.cc-shop-good > span:nth-child(n + 3) {
  text-align: right;
}

.cc-good-name,
.cc-good-name > span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cc-good-name > span + span::before {
  content: ' + ';
}

.cc-good-price {
  white-space: nowrap;
}

.cc-good-price small {
  display: block;
  color: var(--ake-color-danger, #c83b3b);
}

.cc-task-image {
  width: 32px;
  height: 32px;
  flex: 0 0 auto;
}

.cc-task-group > header strong {
  margin-right: auto;
}

.cc-task-list {
  margin-top: var(--ake-space-3);
}

.cc-task-list > article {
  padding: var(--ake-space-3);
  border: var(--ake-border-width) solid var(--ake-color-border);
  background: var(--ake-color-surface);
}

.cc-task-list code {
  color: var(--ake-color-text-muted);
  font-size: 0.7rem;
}

.cc-task-list p {
  margin: var(--ake-space-2) 0;
  font-size: 0.8rem;
  white-space: pre-line;
}

.cc-task-rewards {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--ake-space-2);
  font-size: 0.72rem;
}

.cc-mobile-button {
  position: fixed;
  z-index: var(--ake-z-sticky);
  right: 18px;
  bottom: 18px;
  display: none;
  min-height: 42px;
  border: 0;
  color: var(--ake-color-on-accent);
  background: var(--ake-color-accent);
  box-shadow: var(--ake-shadow-dialog);
}

@media (max-width: 62.4375rem) {
  .cc-module {
    display: block;
    overflow: visible;
  }

  .cc-sidebar {
    display: none;
  }

  .cc-content {
    min-height: 100%;
    padding: var(--ake-space-4) var(--ake-space-3) 76px;
    overflow: visible;
  }

  .cc-mobile-button {
    display: inline-flex;
  }
}

@media (max-width: 34rem) {
  .cc-detail-header,
  .cc-score-panel {
    align-items: flex-start;
  }

  .cc-score-panel {
    flex-direction: column;
  }

  .cc-groups {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
  }

  .cc-shop-head {
    display: none;
  }

  .cc-shop-good {
    grid-template-columns: 28px minmax(0, 1fr);
  }

  .cc-shop-good > span:nth-child(n + 3) {
    grid-column: 2;
    text-align: left;
  }
}
</style>
