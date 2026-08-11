<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { useQuery } from '@tanstack/vue-query'
import { CalendarDays } from '@lucide/vue'
import { EmptyState, ErrorState, ImageWithFallback, LoadingState, ResponsiveDrawer } from '@ake/ui'
import { useAppContext } from '../../../app/providers/app-context'
import { userErrorMessageKey } from '../../../shared/i18n'
import { getSeasonTowerRepository } from '../api/repository'
import type { SeasonStatus, TowerDifficulty, TowerSeason, TowerStage } from '../model'
import SeasonTowerCombatDetail from './SeasonTowerCombatDetail.vue'
import SeasonTowerDirectory from './SeasonTowerDirectory.vue'

defineOptions({ name: 'SeasonTowerPage' })

const route = useRoute()
const router = useRouter()
const { t, te, locale } = useI18n()
const { t: legacyT } = useI18n({
  useScope: 'local',
  inheritLocale: true,
  fallbackLocale: 'EN',
  messages: {
    EN: {
      towerLegacy: {
        directoryDescription: 'Choose a season to view rotating stages',
        chooseSeason: 'Choose season',
        maximum: 'Maximum',
        glowingTitle: 'Glowing title',
        finalRankTitle: 'Final rank title',
        combatConfiguration: 'Monster configuration and attributes'
      }
    },
    CH: {
      towerLegacy: {
        directoryDescription: '选择赛季查看轮换关卡',
        chooseSeason: '选择赛季',
        maximum: '最高',
        glowingTitle: '增辉称号',
        finalRankTitle: '最终评级称号',
        combatConfiguration: '怪物配置与属性'
      }
    }
  }
})
const { client, dataState } = useAppContext()
const repository = getSeasonTowerRepository(client)
const directoryOpen = ref(false)

function tr(key: string, fallback: string): string {
  return te(key) ? String(t(key)) : fallback
}

function entityParam(): string {
  const value = route.query.id
  return Array.isArray(value) ? (value[0] ?? '') : typeof value === 'string' ? value : ''
}

const {
  data: catalog,
  isPending,
  isError,
  error,
  refetch
} = useQuery({
  queryKey: computed(() => [
    'season-tower',
    'catalog',
    dataState.value.baseUrl,
    dataState.value.selected.id,
    dataState.value.locale,
    dataState.value.manifest.sharedRevision
  ]),
  queryFn: ({ signal }) => repository.catalog(signal)
})

const selected = computed(() => {
  const requested = entityParam()
  const seasons = catalog.value?.seasons ?? []
  if (requested) return seasons.find((season) => season.id === requested) ?? null
  return seasons.find((season) => season.status === 'active') ?? seasons.at(-1) ?? null
})

function openSeason(season: TowerSeason): void {
  directoryOpen.value = false
  void router.push({
    name: 'module',
    params: { moduleId: 'season_tower' },
    query: { ...route.query, id: season.id }
  })
}

function errorMessage(value: unknown): string {
  return String(t(userErrorMessageKey(value)))
}

function statusLabel(status: SeasonStatus): string {
  return {
    active: tr('modules.seasonTower.status.active', 'Active'),
    upcoming: tr('modules.seasonTower.status.upcoming', 'Upcoming'),
    closed: tr('modules.seasonTower.status.closed', 'Closed')
  }[status]
}

function parseTime(value: string): Date | null {
  const match = value.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})\s+(\d{1,2}):(\d{1,2}):(\d{1,2})$/)
  const normalized = match
    ? `${match[1]}-${String(match[2]).padStart(2, '0')}-${String(match[3]).padStart(2, '0')}T${String(match[4]).padStart(2, '0')}:${String(match[5]).padStart(2, '0')}:${String(match[6]).padStart(2, '0')}+08:00`
    : value
  const date = new Date(normalized)
  return Number.isNaN(date.getTime()) ? null : date
}

function formatTime(value: string): string {
  const date = parseTime(value)
  if (!date) return tr('modules.seasonTower.timeMissing', 'Time unavailable')
  return new Intl.DateTimeFormat(locale.value, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(date)
}

function formatDate(value: string): string {
  const date = parseTime(value)
  if (!date) return tr('modules.seasonTower.timeMissing', 'Time unavailable')
  return new Intl.DateTimeFormat(locale.value, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(date)
}

function activityImage(id: string): string {
  return client.resolveImageUrl(
    `public/images/assets/beyond/dynamicassets/gameplay/ui/sprites/activity/${id}.png`
  )
}

function itemIcon(id: string): string {
  return client.resolveImageUrl(
    `public/images/assets/beyond/dynamicassets/gameplay/ui/sprites/itemiconbig/${id}.png`
  )
}

function difficultyLabel(difficulty: TowerDifficulty): string {
  const labels: Readonly<Record<number, string>> = {
    1: tr('modules.seasonTower.difficulty.normal', 'Normal'),
    2: tr('modules.seasonTower.difficulty.hard', 'Hard'),
    3: tr('modules.seasonTower.difficulty.brutal', 'Brutal')
  }
  return (
    difficulty.label ||
    labels[difficulty.star] ||
    `${tr('modules.seasonTower.difficulty.unknown', 'Difficulty')} ${difficulty.star}`
  )
}

function activityTitle(): string {
  const name = catalog.value?.activityName
  return name && name !== 'activity_seasontower_0' ? name : tr('modules.seasonTower.title', 'War Echoes')
}

function displayDomainName(name: string, id: string, key: string, fallback: string): string {
  return name && name !== id ? name : `${tr(key, fallback)} ${id}`
}

function maxDifficultyStar(stage: TowerStage): number {
  return Math.max(0, ...stage.difficulties.map((difficulty) => difficulty.star))
}

function comparable(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

function sharedDifficultyValue(stage: TowerStage, field: 'feature' | 'special'): string {
  const values = stage.difficulties.map((difficulty) => comparable(difficulty[field]))
  return new Set(values).size <= 1 ? (values.find(Boolean) ?? '') : ''
}

function showDifficultyValue(
  stage: TowerStage,
  difficulty: TowerDifficulty,
  field: 'feature' | 'special'
): boolean {
  return Boolean(difficulty[field]) && !sharedDifficultyValue(stage, field)
}
</script>

<template>
  <div class="st-module">
    <aside class="st-sidebar">
      <SeasonTowerDirectory
        :title="activityTitle()"
        :subtitle="legacyT('towerLegacy.directoryDescription')"
        :seasons="catalog?.seasons ?? []"
        :selected-id="selected?.id ?? ''"
        :loading="isPending"
        :error="isError"
        :format-date="formatDate"
        :status-label="statusLabel"
        @select="openSeason"
        @retry="refetch()"
      />
    </aside>

    <section class="st-content">
      <LoadingState v-if="isPending" :label="tr('modules.seasonTower.loading', 'Loading War Echoes data')" />
      <ErrorState
        v-else-if="isError"
        :title="tr('modules.seasonTower.error', 'War Echoes data could not be loaded')"
        :description="errorMessage(error)"
        :retry-label="tr('common.retry', 'Retry')"
        @retry="refetch()"
      />
      <ErrorState
        v-else-if="entityParam() && !selected"
        :title="tr('modules.seasonTower.notFound.title', 'Season not found')"
        :description="
          tr(
            'modules.seasonTower.notFound.description',
            'This season is unavailable in the selected data version.'
          )
        "
      />
      <EmptyState
        v-else-if="!selected || !catalog"
        :title="tr('modules.seasonTower.empty.matches', 'No seasons are available')"
      />

      <div v-else class="st-detail">
        <header class="st-detail-header" data-season-region="header">
          <ImageWithFallback
            class="st-detail-icon"
            :src="activityImage(catalog.activityIcon)"
            :alt="activityTitle()"
            width="72"
            height="72"
            loading="eager"
          />
          <div class="st-detail-title">
            <h1>
              {{ activityTitle() }} ·
              {{
                displayDomainName(selected.name, selected.id, 'modules.seasonTower.season.unnamed', 'Season')
              }}
            </h1>
            <p>
              {{
                catalog.activityDescription ||
                tr('modules.seasonTower.description', 'Rotating combat stages and seasonal ranks')
              }}
            </p>
            <div class="st-period">
              <span class="st-status" :data-status="selected.status">{{ statusLabel(selected.status) }}</span>
              <span>{{ formatTime(selected.openTime) }}</span>
              <i aria-hidden="true" />
              <span>{{ formatTime(selected.closeTime) }}</span>
            </div>
          </div>
        </header>

        <section v-if="catalog.introPages.length" class="st-section" data-season-region="intro">
          <h2>{{ tr('modules.seasonTower.intro.title', 'How it works') }}</h2>
          <div class="st-intro-grid">
            <article v-for="(page, pageIndex) in catalog.introPages" :key="page.id">
              <strong>
                {{ displayDomainName(page.title, page.id, 'modules.seasonTower.intro.page', 'Guide') }}
                {{ page.title === page.id ? pageIndex + 1 : '' }}
              </strong>
              <p>{{ page.description }}</p>
            </article>
          </div>
        </section>

        <section class="st-section" data-season-region="ranks">
          <h2>{{ tr('modules.seasonTower.ranks.title', 'Final ranks and titles') }}</h2>
          <div v-if="catalog.ranks.length" class="st-rank-grid">
            <article
              v-for="rank in catalog.ranks"
              :key="rank.id"
              class="st-rank"
              :class="{ 'st-rank--glowing': rank.glowing }"
            >
              <span>
                {{ rank.stars === null ? '✦' : rank.stars }}
                <small v-if="rank.stars !== null">★</small>
              </span>
              <div>
                <strong>{{
                  displayDomainName(rank.name, rank.id, 'modules.seasonTower.ranks.rank', 'Rank')
                }}</strong>
                <small>{{
                  rank.glowing ? legacyT('towerLegacy.glowingTitle') : legacyT('towerLegacy.finalRankTitle')
                }}</small>
              </div>
            </article>
          </div>
          <EmptyState v-else compact :title="tr('common.empty', 'No rank data')" />
        </section>

        <section class="st-section" data-season-region="weeks">
          <h2>{{ tr('modules.seasonTower.weeks.title', 'Rotation schedule') }}</h2>
          <div class="st-weeks">
            <details
              v-for="(week, weekIndex) in selected.weeks"
              :key="week.id"
              class="st-week"
              :class="`st-week--${week.status}`"
              :open="week.status === 'active'"
            >
              <summary class="st-week-head">
                <div>
                  <h3>
                    {{
                      displayDomainName(week.name, week.id, 'modules.seasonTower.weeks.rotation', 'Rotation')
                    }}
                  </h3>
                  <small>
                    {{ tr('modules.seasonTower.weeks.rotation', 'Rotation') }} {{ weekIndex + 1 }} ·
                    {{ week.stages.length }} {{ tr('modules.seasonTower.metrics.stages', 'stages') }} ·
                    {{ legacyT('towerLegacy.maximum') }}
                    {{ week.stages.length * 3 }} ★
                  </small>
                </div>
                <div class="st-week-time">
                  <strong>{{ statusLabel(week.status) }}</strong>
                  <span>{{ formatTime(week.openTime) }}</span>
                  <i aria-hidden="true" />
                  <span>{{ formatTime(week.closeTime) }}</span>
                </div>
              </summary>

              <div class="st-week-body">
                <div class="st-stage-grid">
                  <article
                    v-for="stage in week.stages"
                    :key="stage.id"
                    class="st-stage"
                    :data-stage-id="stage.id"
                  >
                    <header class="st-stage-head">
                      <div>
                        <h3>
                          {{
                            displayDomainName(
                              stage.name,
                              stage.id,
                              'modules.seasonTower.stage.unnamed',
                              'Stage'
                            )
                          }}
                        </h3>
                        <code>{{ stage.id }}</code>
                      </div>
                      <strong>
                        {{ legacyT('towerLegacy.maximum') }}
                        {{ maxDifficultyStar(stage) }} ★
                      </strong>
                    </header>

                    <p v-if="sharedDifficultyValue(stage, 'feature')" class="st-feature st-feature--shared">
                      {{ sharedDifficultyValue(stage, 'feature') }}
                    </p>
                    <p v-if="sharedDifficultyValue(stage, 'special')" class="st-special st-special--shared">
                      <strong>{{ tr('modules.seasonTower.special', 'Special effect') }}</strong>
                      {{ sharedDifficultyValue(stage, 'special') }}
                    </p>

                    <div>
                      <section
                        v-for="difficulty in stage.difficulties"
                        :key="difficulty.gameId"
                        class="st-difficulty"
                        :class="`st-difficulty--${difficulty.star}`"
                      >
                        <header class="st-difficulty-head">
                          <span>{{ difficulty.star }} ★</span>
                          <strong>{{ difficultyLabel(difficulty) }}</strong>
                          <small>
                            {{ tr('modules.seasonTower.level.recommended', 'Recommended level') }}
                            {{ difficulty.recommendedLevel || '-' }}
                          </small>
                        </header>
                        <p class="st-goal">
                          {{
                            difficulty.goal || tr('modules.seasonTower.goal.default', 'Defeat all enemies')
                          }}
                        </p>
                        <p v-if="showDifficultyValue(stage, difficulty, 'feature')" class="st-feature">
                          {{ difficulty.feature }}
                        </p>
                        <p v-if="showDifficultyValue(stage, difficulty, 'special')" class="st-special">
                          <strong>{{ tr('modules.seasonTower.special', 'Special effect') }}</strong>
                          {{ difficulty.special }}
                        </p>

                        <div class="st-rewards">
                          <span v-if="difficulty.rewards.length === 0" class="st-muted">{{
                            tr('modules.seasonTower.rewards.none', 'No rewards configured')
                          }}</span>
                          <span
                            v-for="reward in difficulty.rewards"
                            v-else
                            :key="`${reward.id}:${reward.probable}`"
                            class="st-reward"
                          >
                            <ImageWithFallback
                              :src="itemIcon(reward.iconId)"
                              :alt="reward.name"
                              width="26"
                              height="26"
                            />
                            <span>{{ reward.name }}</span>
                            <strong>×{{ reward.count }}</strong>
                          </span>
                        </div>

                        <div class="st-combat-list">
                          <SeasonTowerCombatDetail
                            v-for="spawner in difficulty.spawners"
                            :key="spawner.id"
                            :difficulty="difficulty"
                            :spawner="spawner"
                            :default-open="
                              week.status === 'active' && difficulty.star === maxDifficultyStar(stage)
                            "
                            :label="legacyT('towerLegacy.combatConfiguration')"
                          />
                          <SeasonTowerCombatDetail
                            v-if="difficulty.spawners.length === 0 && difficulty.fallbackEnemies.length"
                            :difficulty="difficulty"
                            :spawner="null"
                            :default-open="
                              week.status === 'active' && difficulty.star === maxDifficultyStar(stage)
                            "
                            :label="legacyT('towerLegacy.combatConfiguration')"
                          />
                        </div>
                      </section>
                    </div>
                  </article>
                </div>
              </div>
            </details>
          </div>
        </section>
      </div>
    </section>

    <ResponsiveDrawer
      v-model:open="directoryOpen"
      side="left"
      :title="legacyT('towerLegacy.chooseSeason')"
      :close-label="tr('common.close', 'Close')"
    >
      <template #trigger>
        <button type="button" class="st-mobile-button">
          <CalendarDays :size="18" aria-hidden="true" />
          <span>{{ tr('modules.seasonTower.season.label', 'Season') }}</span>
        </button>
      </template>
      <SeasonTowerDirectory
        :title="activityTitle()"
        :subtitle="legacyT('towerLegacy.directoryDescription')"
        :seasons="catalog?.seasons ?? []"
        :selected-id="selected?.id ?? ''"
        :loading="isPending"
        :error="isError"
        :format-date="formatDate"
        :status-label="statusLabel"
        @select="openSeason"
        @retry="refetch()"
      />
    </ResponsiveDrawer>
  </div>
</template>

<style scoped>
.st-module {
  display: grid;
  grid-template-columns: 260px minmax(0, 1fr);
  min-width: 0;
  min-height: calc(100dvh - var(--ake-app-header-height, 4rem));
  gap: var(--ake-space-5);
  padding: var(--ake-space-4);
  color: var(--ake-color-text);
}

.st-sidebar {
  min-width: 0;
  min-height: 0;
}

.st-sidebar > :deep(.st-directory) {
  position: sticky;
  top: var(--ake-space-4);
  max-height: calc(100dvh - var(--ake-app-header-height, 4rem) - var(--ake-space-8));
}

.st-content {
  min-width: 0;
  min-height: 0;
  padding: var(--ake-space-6);
  border: var(--ake-border-width) solid var(--ake-color-border);
  border-radius: var(--ake-radius-lg);
  background: var(--ake-color-surface);
}

.st-detail {
  display: grid;
  min-width: 0;
  gap: var(--ake-space-6);
}

.st-detail-header {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: var(--ake-space-4);
  padding-block-end: var(--ake-space-4);
  border-block-end: 2px solid var(--ake-color-border);
}

.st-detail-icon {
  width: 4.5rem;
  height: 4.5rem;
  flex: 0 0 4.5rem;
  border-radius: var(--ake-radius-md);
}

.st-detail-title {
  min-width: 0;
}

.st-detail-title h1 {
  margin: 0 0 var(--ake-space-1);
  font-size: var(--ake-font-size-xl);
  overflow-wrap: anywhere;
}

.st-detail-title p {
  margin: 0;
  color: var(--ake-color-text-muted);
  font-size: var(--ake-font-size-sm);
}

.st-period,
.st-week-time {
  display: flex;
  min-width: 0;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--ake-space-2);
  margin-block-start: var(--ake-space-2);
  color: var(--ake-color-text-muted);
  font-size: var(--ake-font-size-xs);
}

.st-period > i,
.st-week-time > i {
  width: 1rem;
  height: 1px;
  background: currentColor;
}

.st-status,
.st-week-time > strong {
  padding: 0.2rem 0.45rem;
  border-radius: var(--ake-radius-sm);
  color: var(--ake-color-surface);
  background: var(--ake-color-text-muted);
  font-size: var(--ake-font-size-xs);
}

.st-status[data-status='active'],
.st-week--active .st-week-time > strong {
  background: var(--ake-color-success);
}

.st-status[data-status='upcoming'],
.st-week--upcoming .st-week-time > strong {
  background: var(--ake-color-warning);
}

.st-section {
  display: grid;
  min-width: 0;
  gap: var(--ake-space-3);
}

.st-section > h2 {
  margin: 0;
  font-size: var(--ake-font-size-lg);
}

.st-intro-grid,
.st-rank-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 13rem), 1fr));
  gap: var(--ake-space-3);
}

.st-intro-grid article {
  padding: var(--ake-space-3);
  border: var(--ake-border-width) solid var(--ake-color-border);
  border-radius: var(--ake-radius-md);
  background: var(--ake-color-surface-muted);
}

.st-intro-grid p {
  margin: var(--ake-space-2) 0 0;
  color: var(--ake-color-text-muted);
  font-size: var(--ake-font-size-sm);
  line-height: var(--ake-line-height-relaxed);
  white-space: pre-wrap;
}

.st-rank {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: var(--ake-space-2);
  padding: var(--ake-space-2) var(--ake-space-3);
  border: var(--ake-border-width) solid var(--ake-color-border);
  border-radius: var(--ake-radius-md);
  background: var(--ake-color-surface-muted);
}

.st-rank > span {
  color: var(--ake-color-accent);
  font-size: var(--ake-font-size-lg);
  font-weight: 700;
}

.st-rank > span small {
  font-size: 0.6em;
}

.st-rank > div {
  display: grid;
  min-width: 0;
}

.st-rank > div small {
  color: var(--ake-color-text-muted);
  font-size: var(--ake-font-size-xs);
}

.st-rank--glowing {
  border-color: var(--ake-color-warning);
}

.st-weeks,
.st-stage-grid,
.st-combat-list {
  display: grid;
  min-width: 0;
  gap: var(--ake-space-3);
}

.st-week {
  --tower-week-color: var(--ake-color-text-muted);
  min-width: 0;
  overflow: hidden;
  border: 2px solid var(--tower-week-color);
  border-radius: var(--ake-radius-md);
}

.st-week--active {
  --tower-week-color: var(--ake-color-success);
}

.st-week--upcoming {
  --tower-week-color: var(--ake-color-warning);
}

.st-week-head {
  position: relative;
  display: flex;
  min-width: 0;
  align-items: center;
  justify-content: space-between;
  gap: var(--ake-space-4);
  padding: var(--ake-space-3) 2.75rem var(--ake-space-3) var(--ake-space-4);
  background: var(--ake-color-surface-muted);
  cursor: pointer;
  list-style: none;
}

.st-week-head::-webkit-details-marker {
  display: none;
}

.st-week-head::after {
  position: absolute;
  top: 50%;
  right: var(--ake-space-4);
  color: var(--tower-week-color);
  content: '›';
  font-size: 1.45rem;
  transform: translateY(-50%);
  transition: transform var(--ake-duration-fast) var(--ake-ease-standard);
}

.st-week[open] > .st-week-head::after {
  transform: translateY(-50%) rotate(90deg);
}

.st-week-head h3 {
  margin: 0;
  font-size: var(--ake-font-size-md);
}

.st-week-head small {
  display: block;
  margin-block-start: var(--ake-space-1);
  color: var(--ake-color-text-muted);
  font-size: var(--ake-font-size-xs);
}

.st-week-time {
  justify-content: flex-end;
  margin: 0;
}

.st-week-body {
  padding: var(--ake-space-3);
  border-block-start: var(--ake-border-width) solid var(--ake-color-border);
}

.st-stage {
  min-width: 0;
  overflow: hidden;
  border: var(--ake-border-width) solid var(--ake-color-border);
  border-radius: var(--ake-radius-md);
  background: var(--ake-color-surface);
}

.st-stage-head {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: var(--ake-space-3);
  padding: var(--ake-space-3) var(--ake-space-4);
  border-block-end: var(--ake-border-width) solid var(--ake-color-border);
  background: var(--ake-color-surface-muted);
}

.st-stage-head > div {
  min-width: 0;
  flex: 1;
}

.st-stage-head h3 {
  margin: 0;
  font-size: var(--ake-font-size-md);
}

.st-stage-head code {
  display: block;
  margin-block-start: var(--ake-space-1);
  color: var(--ake-color-text-muted);
  font-size: var(--ake-font-size-xs);
  overflow-wrap: anywhere;
}

.st-stage-head > strong {
  color: var(--ake-color-accent);
  font-size: var(--ake-font-size-xs);
}

.st-difficulty {
  padding: var(--ake-space-3) var(--ake-space-4);
  border-block-end: var(--ake-border-width) solid var(--ake-color-border);
}

.st-difficulty:last-child {
  border-block-end: 0;
}

.st-difficulty-head {
  display: flex;
  min-width: 0;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--ake-space-2);
}

.st-difficulty-head > span {
  color: var(--ake-color-accent);
  font-size: var(--ake-font-size-xs);
  font-weight: 700;
}

.st-difficulty-head > small {
  margin-inline-start: auto;
  color: var(--ake-color-text-muted);
  font-size: var(--ake-font-size-xs);
}

.st-goal {
  margin: var(--ake-space-2) 0 0;
  color: var(--ake-color-text-muted);
  font-size: var(--ake-font-size-sm);
}

.st-feature,
.st-special {
  margin: var(--ake-space-2) 0 0;
  padding: var(--ake-space-2) var(--ake-space-3);
  border-radius: var(--ake-radius-sm);
  color: var(--ake-color-text-muted);
  background: var(--ake-color-surface-muted);
  font-size: var(--ake-font-size-xs);
  line-height: var(--ake-line-height-relaxed);
  white-space: pre-wrap;
}

.st-special {
  border-inline-start: 3px solid var(--ake-color-warning);
}

.st-special > strong {
  display: block;
  color: var(--ake-color-warning);
}

.st-feature--shared,
.st-special--shared {
  margin: var(--ake-space-3) var(--ake-space-4) 0;
}

.st-rewards {
  display: flex;
  min-width: 0;
  flex-wrap: wrap;
  gap: var(--ake-space-2);
  margin-block-start: var(--ake-space-2);
}

.st-reward {
  display: inline-grid;
  grid-template-columns: 1.625rem minmax(0, auto) auto;
  align-items: center;
  gap: var(--ake-space-1);
  padding: var(--ake-space-1) var(--ake-space-2) var(--ake-space-1) var(--ake-space-1);
  border: var(--ake-border-width) solid var(--ake-color-border);
  border-radius: var(--ake-radius-sm);
  font-size: var(--ake-font-size-xs);
}

.st-reward > :deep(.ake-image) {
  width: 1.625rem;
  height: 1.625rem;
}

.st-reward > strong {
  color: var(--ake-color-accent);
}

.st-muted {
  color: var(--ake-color-text-muted);
  font-size: var(--ake-font-size-xs);
}

.st-combat-list {
  margin-block-start: var(--ake-space-3);
}

.st-mobile-button {
  position: fixed;
  z-index: calc(var(--ake-z-sticky) + 1);
  right: var(--ake-space-4);
  bottom: var(--ake-space-4);
  display: none;
  min-height: 3rem;
  align-items: center;
  gap: var(--ake-space-2);
  padding-inline: var(--ake-space-4);
  border: 0;
  border-radius: var(--ake-radius-md);
  color: var(--ake-color-surface);
  background: var(--ake-color-accent);
  box-shadow: var(--ake-shadow-dialog);
  cursor: pointer;
}

@media (max-width: 62.5rem) {
  .st-module {
    display: block;
    padding: var(--ake-space-3);
  }

  .st-sidebar {
    display: none;
  }

  .st-content {
    padding: var(--ake-space-4);
  }

  .st-mobile-button {
    display: inline-flex;
  }
}

@media (max-width: 42.5rem) {
  .st-content {
    padding: var(--ake-space-3);
    border-radius: var(--ake-radius-md);
  }

  .st-detail-header,
  .st-week-head {
    align-items: flex-start;
    flex-direction: column;
  }

  .st-detail-icon {
    width: 3.5rem;
    height: 3.5rem;
    flex-basis: 3.5rem;
  }

  .st-week-time {
    justify-content: flex-start;
  }

  .st-intro-grid,
  .st-rank-grid {
    grid-template-columns: minmax(0, 1fr);
  }

  .st-stage-head > strong {
    display: none;
  }

  .st-difficulty-head > small {
    width: 100%;
    margin-inline-start: 0;
  }
}
</style>
