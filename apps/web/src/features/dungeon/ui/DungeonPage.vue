<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { useQuery } from '@tanstack/vue-query'
import { List } from '@lucide/vue'
import { EmptyState, ErrorState, ImageWithFallback, LoadingState, ResponsiveDrawer } from '@ake/ui'
import { useAppContext } from '../../../app/providers/app-context'
import { userErrorMessageKey } from '../../../shared/i18n'
import { getDungeonRepository } from '../api/repository'
import type { DungeonCatalogItem, DungeonRewardItem } from '../model'
import DungeonDirectory from './DungeonDirectory.vue'
import DungeonEnemyCard from './DungeonEnemyCard.vue'
import DungeonWavePanel from './DungeonWavePanel.vue'

defineOptions({ name: 'DungeonPage' })

const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const { t: dungeonT } = useI18n({
  useScope: 'local',
  inheritLocale: true,
  fallbackLocale: 'EN',
  messages: {
    EN: {
      dungeon: {
        search: 'Search dungeon series',
        list: 'Dungeon series',
        choose: 'Choose dungeon series',
        mobileList: 'Dungeon list',
        loadingCatalog: 'Loading dungeon series',
        loadingDetail: 'Loading dungeon details',
        catalogError: 'Dungeon series could not be loaded',
        detailError: 'Dungeon details could not be loaded',
        notFound: 'Dungeon series not found',
        overview: {
          title: 'Dungeon series',
          description: 'Browse stage groups by category.',
          stages: '{count} stages',
          rarity: 'Rarity {value}'
        },
        categories: {
          highDifficulty: 'High difficulty',
          bossRush: 'Boss rush',
          protocolSpace: 'Protocol Space',
          eventCombat: 'Event combat',
          challenge: 'Challenge',
          resource: 'Resource',
          weeklyRaid: 'Weekly raid',
          characterMission: 'Character mission',
          characterTutorial: 'Character tutorial',
          contingencyContract: 'Contingency Contract',
          training: 'Training',
          worldLevel: 'World level',
          wulingA: 'Wuling A',
          wulingB: 'Wuling B',
          mystery: 'Mystery',
          protocolDivergence: 'Protocol Divergence',
          other: 'Other'
        },
        stamina: 'Stamina {value}',
        goals: { main: 'Main goal', extra: 'Extra goal' },
        meta: { stamina: 'Stamina cost', recommended: 'Recommended level', category: 'Category' },
        waves: 'Enemy waves',
        rewards: {
          title: 'Rewards',
          fixed: 'Fixed rewards',
          first: 'First clear',
          hunter: 'Hunter mode',
          random: 'Random rewards'
        },
        enemies: 'Enemy details',
        runtime: {
          spawnerMissing: 'SpawnerConfig manifest is unavailable; using the dungeon enemy list.',
          scriptMissing: 'LevelScript manifest is unavailable; script buffs are omitted.',
          spawnerDetailsMissing: '{count} SpawnerConfig entries are unavailable.',
          scriptDetailsMissing: '{count} LevelScript entries are unavailable.',
          noWaves: 'No spawn-wave data is available for this level configuration.'
        }
      }
    },
    CH: {
      dungeon: {
        search: '搜索副本系列',
        list: '副本系列',
        choose: '选择副本系列',
        mobileList: '副本列表',
        loadingCatalog: '正在加载副本系列',
        loadingDetail: '正在加载副本详情',
        catalogError: '无法加载副本系列',
        detailError: '无法加载副本详情',
        notFound: '未找到副本系列',
        overview: {
          title: '副本系列',
          description: '按类别浏览副本与关卡。',
          stages: '{count} 个关卡',
          rarity: '稀有度 {value}'
        },
        categories: {
          highDifficulty: '高难挑战',
          bossRush: '首领连战',
          protocolSpace: '协议空间',
          eventCombat: '活动战斗',
          challenge: '挑战',
          resource: '资源副本',
          weeklyRaid: '周常讨伐',
          characterMission: '角色任务',
          characterTutorial: '角色教学',
          contingencyContract: '危机合约',
          training: '训练',
          worldLevel: '世界等级',
          wulingA: '武陵区域 A',
          wulingB: '武陵区域 B',
          mystery: '谜题',
          protocolDivergence: '协议岔路',
          other: '其他'
        },
        stamina: '理智 {value}',
        goals: { main: '主要目标', extra: '额外目标' },
        meta: { stamina: '理智消耗', recommended: '推荐等级', category: '类别' },
        waves: '敌人波次',
        rewards: {
          title: '关卡奖励',
          fixed: '固定奖励',
          first: '首次通关',
          hunter: '猎人模式',
          random: '随机奖励'
        },
        enemies: '敌人详情',
        runtime: {
          spawnerMissing: 'SpawnerConfig 清单缺失，当前使用关卡敌人列表。',
          scriptMissing: 'LevelScript 清单缺失，当前不展示脚本 Buff。',
          spawnerDetailsMissing: '{count} 个 SpawnerConfig 详情缺失。',
          scriptDetailsMissing: '{count} 个 LevelScript 详情缺失。',
          noWaves: '当前等级配置没有可用的刷怪波次数据。'
        }
      }
    }
  }
})
const { client, dataState } = useAppContext()
const repository = getDungeonRepository(client)
const directoryOpen = ref(false)
const search = ref('')

function entityId(): string {
  const value = route.query.id
  return Array.isArray(value) ? (value[0] ?? '') : typeof value === 'string' ? value : ''
}

const {
  data: catalog,
  isPending: catalogPending,
  isError: catalogError,
  error: catalogFailure,
  refetch: refetchCatalog
} = useQuery({
  queryKey: computed(() => [
    'dungeon',
    'catalog',
    dataState.value.baseUrl,
    dataState.value.selected.id,
    dataState.value.locale,
    dataState.value.manifest.sharedRevision
  ]),
  queryFn: ({ signal }) => repository.catalog(signal)
})

const visibleSeries = computed(() => {
  const term = search.value.trim().toLocaleLowerCase()
  const values = catalog.value?.series ?? []
  return term ? values.filter((item) => item.searchText.includes(term)) : values
})

const selected = computed(() => {
  const id = entityId()
  return id ? (catalog.value?.series.find((item) => item.id === id) ?? null) : null
})

const {
  data: detail,
  isPending: detailPending,
  isError: detailError,
  error: detailFailure,
  refetch: refetchDetail
} = useQuery({
  queryKey: computed(() => [
    'dungeon',
    'detail',
    dataState.value.baseUrl,
    dataState.value.selected.id,
    dataState.value.locale,
    dataState.value.manifest.sharedRevision,
    selected.value?.id ?? ''
  ]),
  enabled: computed(() => selected.value !== null),
  queryFn: ({ signal }) => repository.detail(selected.value?.id ?? '', signal)
})

const overviewGroups = computed(() => {
  const groups = new Map<string, DungeonCatalogItem[]>()
  for (const item of visibleSeries.value) {
    const values = groups.get(item.categoryKey) ?? []
    values.push(item)
    groups.set(item.categoryKey, values)
  }
  return [...groups.entries()]
    .map(([key, items]) => ({ key, items, rarity: Math.max(...items.map((item) => item.rarity), 0) }))
    .toSorted(
      (left, right) =>
        right.rarity - left.rarity || categoryLabel(left.key).localeCompare(categoryLabel(right.key))
    )
})

function openSeries(item: DungeonCatalogItem): void {
  directoryOpen.value = false
  void router.push({
    name: 'module',
    params: { moduleId: 'v3_dungeon' },
    query: { ...route.query, id: item.id }
  })
}

function errorMessage(value: unknown): string {
  return String(t(userErrorMessageKey(value)))
}

function categoryLabel(key: string): string {
  const messageKey = `dungeon.categories.${key}`
  const value = String(dungeonT(messageKey))
  return value === messageKey ? key : value
}

function dungeonImage(id: string, suffix = ''): string {
  return client.resolveImageUrl(
    `public/images/assets/beyond/dynamicassets/gameplay/ui/sprites/dungeon/${id}${suffix}.png`
  )
}

function itemImage(id: string): string {
  return client.resolveImageUrl(
    `public/images/assets/beyond/dynamicassets/gameplay/ui/sprites/itemiconbig/${id}.png`
  )
}

function enemyImage(id: string): string {
  return client.resolveImageUrl(
    `public/images/assets/beyond/dynamicassets/gameplay/ui/sprites/monstericonbig/${id}.png`
  )
}

function rewardKey(reward: DungeonRewardItem): string {
  return `${reward.id}:${reward.count}:${reward.iconId}`
}
</script>

<template>
  <div class="dungeon-module">
    <aside class="dungeon-sidebar">
      <DungeonDirectory
        :items="visibleSeries"
        :selected-id="selected?.id ?? ''"
        :search="search"
        :search-placeholder="dungeonT('dungeon.search')"
        :list-label="dungeonT('dungeon.list')"
        :loading="catalogPending"
        :error="catalogError"
        @update:search="search = $event"
        @select="openSeries"
        @retry="refetchCatalog()"
      />
    </aside>

    <div class="dungeon-detail">
      <LoadingState v-if="catalogPending" :label="dungeonT('dungeon.loadingCatalog')" />
      <ErrorState
        v-else-if="catalogError"
        :title="dungeonT('dungeon.catalogError')"
        :description="errorMessage(catalogFailure)"
        :retry-label="t('common.retry')"
        @retry="refetchCatalog()"
      />
      <ErrorState v-else-if="entityId() && !selected" :title="dungeonT('dungeon.notFound')" />

      <section v-else-if="!entityId()" class="dungeon-overview" data-dungeon-view="overview">
        <header>
          <h1>{{ dungeonT('dungeon.overview.title') }}</h1>
          <p>{{ dungeonT('dungeon.overview.description') }}</p>
        </header>
        <EmptyState v-if="overviewGroups.length === 0" />
        <section v-for="group in overviewGroups" v-else :key="group.key" class="dungeon-overview-group">
          <h2>{{ categoryLabel(group.key) }}</h2>
          <div class="dungeon-overview-grid">
            <button
              v-for="item in group.items"
              :key="item.id"
              type="button"
              class="dungeon-overview-item"
              @click="openSeries(item)"
            >
              <ImageWithFallback
                v-if="item.imageId"
                :src="dungeonImage(item.imageId, '_bg')"
                alt=""
                aspect-ratio="16 / 7"
              />
              <span>
                <strong>{{ item.name }}</strong>
                <code>{{ item.id }}</code>
                <small>{{ dungeonT('dungeon.overview.stages', { count: item.dungeonCount }) }}</small>
                <small>{{ dungeonT('dungeon.overview.rarity', { value: item.rarity }) }}</small>
              </span>
            </button>
          </div>
        </section>
      </section>

      <LoadingState v-else-if="detailPending" :label="dungeonT('dungeon.loadingDetail')" />
      <ErrorState
        v-else-if="detailError"
        :title="dungeonT('dungeon.detailError')"
        :description="errorMessage(detailFailure)"
        :retry-label="t('common.retry')"
        @retry="refetchDetail()"
      />
      <EmptyState v-else-if="!detail" :title="dungeonT('dungeon.notFound')" />

      <article v-else class="dungeon-series" data-dungeon-view="detail">
        <section class="dungeon-series-banner" data-dungeon-region="banner">
          <ImageWithFallback
            v-if="detail.pictureId"
            class="dungeon-series-background"
            :src="dungeonImage(detail.pictureId, '_bg')"
            alt=""
            aspect-ratio="16 / 5"
          />
          <header>
            <h1>{{ detail.name }}</h1>
            <code>{{ detail.id }}</code>
          </header>
          <ImageWithFallback
            v-if="detail.roleImageId"
            class="dungeon-series-role"
            :src="enemyImage(detail.roleImageId)"
            alt=""
            aspect-ratio="1"
          />
        </section>

        <div class="dungeon-series-meta" data-dungeon-region="meta">
          <span>{{ categoryLabel(detail.categoryKey) }}</span>
          <span v-if="detail.staminaText">
            {{ dungeonT('dungeon.stamina', { value: detail.staminaText }) }}
          </span>
        </div>

        <p v-if="detail.description" class="dungeon-series-description" data-dungeon-region="description">
          {{ detail.description }}
        </p>

        <section class="dungeon-cards" data-dungeon-region="cards">
          <article v-for="stage in detail.dungeons" :key="stage.id" class="dungeon-card">
            <ImageWithFallback
              v-if="stage.pictureId"
              class="dungeon-card-background"
              :src="dungeonImage(stage.pictureId)"
              alt=""
              aspect-ratio="1"
            />

            <header class="dungeon-card-header" data-dungeon-card-region="header">
              <ImageWithFallback
                v-if="stage.iconId"
                :src="itemImage(stage.iconId)"
                :alt="stage.name"
                aspect-ratio="1"
              />
              <h2>{{ stage.name }}</h2>
              <span v-if="stage.levelDescription">{{ stage.levelDescription }}</span>
              <code>{{ stage.id }}</code>
            </header>

            <div data-dungeon-card-region="description">
              <p v-if="stage.description" class="dungeon-card-description">{{ stage.description }}</p>
              <p v-if="stage.feature" class="dungeon-card-feature">{{ stage.feature }}</p>
            </div>

            <section
              v-if="stage.mainGoal || stage.extraGoal"
              class="dungeon-card-goals"
              data-dungeon-card-region="goals"
            >
              <p v-if="stage.mainGoal">
                <strong>{{ dungeonT('dungeon.goals.main') }}</strong>
                {{ stage.mainGoal }}
              </p>
              <p v-if="stage.extraGoal">
                <strong>{{ dungeonT('dungeon.goals.extra') }}</strong>
                {{ stage.extraGoal }}
              </p>
            </section>

            <dl class="dungeon-card-meta" data-dungeon-card-region="meta">
              <div v-if="stage.stamina > 0">
                <dt>{{ dungeonT('dungeon.meta.stamina') }}</dt>
                <dd>{{ stage.stamina }}</dd>
              </div>
              <div>
                <dt>{{ dungeonT('dungeon.meta.recommended') }}</dt>
                <dd>{{ stage.recommendedLevel || '?' }}</dd>
              </div>
              <div v-if="stage.category">
                <dt>{{ dungeonT('dungeon.meta.category') }}</dt>
                <dd>{{ categoryLabel(stage.categoryKey) }}</dd>
              </div>
            </dl>

            <section class="dungeon-runtime" data-dungeon-card-region="waves">
              <h3>{{ dungeonT('dungeon.waves') }}</h3>
              <p v-if="!stage.runtime.spawnerManifestAvailable" class="dungeon-runtime-note">
                {{ dungeonT('dungeon.runtime.spawnerMissing') }}
              </p>
              <p v-if="stage.runtime.missingSpawnerDetails" class="dungeon-runtime-note">
                {{
                  dungeonT('dungeon.runtime.spawnerDetailsMissing', {
                    count: stage.runtime.missingSpawnerDetails
                  })
                }}
              </p>
              <p v-if="!stage.runtime.levelScriptManifestAvailable" class="dungeon-runtime-note">
                {{ dungeonT('dungeon.runtime.scriptMissing') }}
              </p>
              <p v-if="stage.runtime.missingLevelScriptDetails" class="dungeon-runtime-note">
                {{
                  dungeonT('dungeon.runtime.scriptDetailsMissing', {
                    count: stage.runtime.missingLevelScriptDetails
                  })
                }}
              </p>
              <DungeonWavePanel v-if="stage.waves.length" :waves="stage.waves" />
              <p v-else class="dungeon-runtime-empty">{{ dungeonT('dungeon.runtime.noWaves') }}</p>
            </section>

            <section
              v-if="
                stage.rewards.fixed.length ||
                stage.rewards.first.length ||
                stage.rewards.hunterFixed.length ||
                stage.rewards.hunterRandom.length
              "
              class="dungeon-rewards"
              data-dungeon-card-region="rewards"
            >
              <h3>{{ dungeonT('dungeon.rewards.title') }}</h3>
              <div class="dungeon-reward-groups">
                <section v-if="stage.rewards.fixed.length">
                  <h4>{{ dungeonT('dungeon.rewards.fixed') }}</h4>
                  <div>
                    <span v-for="reward in stage.rewards.fixed" :key="rewardKey(reward)">
                      <ImageWithFallback
                        :src="itemImage(reward.iconId)"
                        :alt="reward.name"
                        aspect-ratio="1"
                      />
                      {{ reward.name }} ×{{ reward.count }}
                    </span>
                  </div>
                </section>
                <section v-if="stage.rewards.first.length">
                  <h4>{{ dungeonT('dungeon.rewards.first') }}</h4>
                  <div>
                    <span v-for="reward in stage.rewards.first" :key="rewardKey(reward)">
                      <ImageWithFallback
                        :src="itemImage(reward.iconId)"
                        :alt="reward.name"
                        aspect-ratio="1"
                      />
                      {{ reward.name }} ×{{ reward.count }}
                    </span>
                  </div>
                </section>
                <section
                  v-if="stage.rewards.hunterFixed.length || stage.rewards.hunterRandom.length"
                  class="is-hunter"
                >
                  <h4>
                    {{ dungeonT('dungeon.rewards.hunter') }}
                    <small v-if="stage.rewards.hunterStamina">
                      {{ dungeonT('dungeon.meta.stamina') }} {{ stage.rewards.hunterStamina }}
                    </small>
                  </h4>
                  <div v-if="stage.rewards.hunterFixed.length">
                    <strong>{{ dungeonT('dungeon.rewards.fixed') }}</strong>
                    <span v-for="reward in stage.rewards.hunterFixed" :key="rewardKey(reward)">
                      <ImageWithFallback
                        :src="itemImage(reward.iconId)"
                        :alt="reward.name"
                        aspect-ratio="1"
                      />
                      {{ reward.name }} ×{{ reward.count }}
                    </span>
                  </div>
                  <div v-if="stage.rewards.hunterRandom.length">
                    <strong>{{ dungeonT('dungeon.rewards.random') }}</strong>
                    <span v-for="reward in stage.rewards.hunterRandom" :key="rewardKey(reward)">
                      <ImageWithFallback
                        :src="itemImage(reward.iconId)"
                        :alt="reward.name"
                        aspect-ratio="1"
                      />
                      {{ reward.name }} ×{{ reward.count }}
                    </span>
                  </div>
                </section>
              </div>
            </section>

            <section v-if="stage.enemies.length" class="dungeon-enemies" data-dungeon-card-region="enemies">
              <h3>{{ dungeonT('dungeon.enemies') }}</h3>
              <div>
                <DungeonEnemyCard v-for="enemy in stage.enemies" :key="enemy.id" :enemy="enemy" />
              </div>
            </section>
          </article>
        </section>
      </article>
    </div>

    <ResponsiveDrawer
      v-model:open="directoryOpen"
      side="left"
      :title="dungeonT('dungeon.choose')"
      :close-label="t('common.close')"
    >
      <template #trigger>
        <button type="button" class="dungeon-mobile-button">
          <List :size="18" aria-hidden="true" />
          <span>{{ dungeonT('dungeon.mobileList') }}</span>
        </button>
      </template>
      <DungeonDirectory
        :items="visibleSeries"
        :selected-id="selected?.id ?? ''"
        :search="search"
        :search-placeholder="dungeonT('dungeon.search')"
        :list-label="dungeonT('dungeon.list')"
        :loading="catalogPending"
        :error="catalogError"
        @update:search="search = $event"
        @select="openSeries"
        @retry="refetchCatalog()"
      />
    </ResponsiveDrawer>
  </div>
</template>

<style scoped>
.dungeon-module {
  display: grid;
  min-height: 0;
  grid-template-columns: 260px minmax(0, 1fr);
  gap: var(--ake-space-5);
}

.dungeon-sidebar {
  position: sticky;
  top: var(--ake-space-4);
  display: flex;
  height: calc(100vh - 8rem);
  min-height: 31.25rem;
}

.dungeon-detail {
  min-width: 0;
  padding: var(--ake-space-6);
  border: var(--ake-border-width) solid var(--ake-color-border);
  border-radius: var(--ake-radius-xl);
  background: var(--ake-color-surface);
}

.dungeon-overview > header h1,
.dungeon-overview > header p {
  margin: 0;
}

.dungeon-overview > header p {
  margin-block-start: var(--ake-space-2);
  color: var(--ake-color-text-muted);
}

.dungeon-overview-group {
  margin-block-start: var(--ake-space-6);
}

.dungeon-overview-group h2 {
  margin: 0 0 var(--ake-space-3);
  font-size: var(--ake-font-size-lg);
}

.dungeon-overview-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(15rem, 1fr));
  gap: var(--ake-space-3);
}

.dungeon-overview-item {
  position: relative;
  min-height: 8.5rem;
  overflow: hidden;
  padding: 0;
  border: var(--ake-border-width) solid var(--ake-color-border);
  border-radius: var(--ake-radius-lg);
  background: var(--ake-color-surface-muted);
  color: inherit;
  text-align: start;
  cursor: pointer;
}

.dungeon-overview-item:hover,
.dungeon-overview-item:focus-visible {
  border-color: var(--ake-color-accent);
  outline: none;
}

.dungeon-overview-item > :deep(.ake-image) {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  opacity: 0.35;
}

.dungeon-overview-item > span {
  position: relative;
  z-index: 1;
  display: flex;
  min-height: 8.5rem;
  flex-direction: column;
  justify-content: flex-end;
  padding: var(--ake-space-4);
  background: linear-gradient(to top, var(--ake-color-surface) 20%, transparent);
}

.dungeon-overview-item strong,
.dungeon-overview-item code,
.dungeon-overview-item small {
  display: block;
}

.dungeon-overview-item code,
.dungeon-overview-item small {
  color: var(--ake-color-text-muted);
  font-size: var(--ake-font-size-xs);
}

.dungeon-series-banner {
  position: relative;
  display: flex;
  min-height: 10rem;
  align-items: flex-end;
  justify-content: space-between;
  overflow: hidden;
  margin-block-end: var(--ake-space-5);
  border-radius: var(--ake-radius-xl);
}

.dungeon-series-banner::after {
  position: absolute;
  z-index: 1;
  inset: 40% 0 0;
  background: linear-gradient(to top, var(--ake-color-surface), transparent);
  content: '';
  pointer-events: none;
}

.dungeon-series-background {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.dungeon-series-banner > header {
  position: relative;
  z-index: 2;
  min-width: 0;
  padding: var(--ake-space-5);
}

.dungeon-series-banner h1 {
  margin: 0;
}

.dungeon-series-banner code {
  color: var(--ake-color-text-muted);
}

.dungeon-series-role {
  position: relative;
  z-index: 2;
  width: min(10rem, 30%);
  max-height: 10rem;
  margin-inline-end: var(--ake-space-4);
  object-fit: contain;
}

.dungeon-series-meta {
  display: flex;
  flex-wrap: wrap;
  gap: var(--ake-space-3);
  margin-block-end: var(--ake-space-4);
}

.dungeon-series-meta span {
  padding: 0.25rem 0.75rem;
  border-radius: var(--ake-radius-pill);
  background: var(--ake-color-accent-soft);
  color: var(--ake-color-accent-strong);
  font-size: var(--ake-font-size-sm);
}

.dungeon-series-description,
.dungeon-card-description {
  padding-inline-start: var(--ake-space-3);
  border-inline-start: 0.1875rem solid var(--ake-color-accent);
  color: var(--ake-color-text-muted);
  font-style: italic;
  line-height: 1.6;
  white-space: pre-wrap;
}

.dungeon-cards {
  display: grid;
  gap: var(--ake-space-6);
  margin-block-start: var(--ake-space-5);
}

.dungeon-card {
  position: relative;
  overflow: hidden;
  padding: var(--ake-space-5);
  border: var(--ake-border-width) solid var(--ake-color-border);
  border-radius: var(--ake-radius-xl);
  background: var(--ake-color-surface-muted);
  box-shadow: var(--ake-shadow-sm);
}

.dungeon-card-background {
  position: absolute;
  inset: 0 0 auto auto;
  width: 8.75rem;
  height: 8.75rem;
  opacity: 0.6;
  object-fit: contain;
  pointer-events: none;
}

.dungeon-card > *:not(.dungeon-card-background) {
  position: relative;
  z-index: 1;
}

.dungeon-card-header {
  display: flex;
  align-items: center;
  gap: var(--ake-space-3);
  flex-wrap: wrap;
}

.dungeon-card-header :deep(.ake-image) {
  width: 2.25rem;
  height: 2.25rem;
}

.dungeon-card-header h2 {
  margin: 0;
  font-size: var(--ake-font-size-xl);
}

.dungeon-card-header span {
  padding: 0.125rem 0.625rem;
  border-radius: var(--ake-radius-pill);
  background: var(--ake-color-surface);
  color: var(--ake-color-text-muted);
}

.dungeon-card-header code {
  color: var(--ake-color-text-muted);
  font-size: var(--ake-font-size-xs);
}

.dungeon-card-feature,
.dungeon-card-goals,
.dungeon-runtime-note,
.dungeon-runtime-empty {
  padding: var(--ake-space-3);
  border-radius: var(--ake-radius-md);
  background: var(--ake-color-surface);
  line-height: 1.55;
  white-space: pre-wrap;
}

.dungeon-card-goals {
  border: var(--ake-border-width) solid #d8b43c;
  background: #fff8dc;
  color: #634d00;
}

:global([data-theme='dark']) .dungeon-card-goals {
  background: #342f1e;
  color: #f1dc89;
}

.dungeon-card-goals p {
  margin: 0;
}

.dungeon-card-goals p + p {
  margin-block-start: var(--ake-space-2);
}

.dungeon-card-goals strong {
  margin-inline-end: var(--ake-space-2);
}

.dungeon-card-meta {
  display: flex;
  flex-wrap: wrap;
  gap: var(--ake-space-6);
  margin-block: var(--ake-space-4);
}

.dungeon-card-meta > div {
  display: flex;
  gap: var(--ake-space-2);
}

.dungeon-card-meta dt {
  color: var(--ake-color-text-muted);
  font-weight: 700;
}

.dungeon-card-meta dd {
  margin: 0;
}

.dungeon-runtime,
.dungeon-rewards,
.dungeon-enemies {
  margin-block-start: var(--ake-space-5);
}

.dungeon-runtime h3,
.dungeon-rewards h3,
.dungeon-enemies h3 {
  margin: 0 0 var(--ake-space-3);
  font-size: var(--ake-font-size-lg);
}

.dungeon-runtime-note,
.dungeon-runtime-empty {
  margin: var(--ake-space-2) 0;
  color: var(--ake-color-text-muted);
  font-size: var(--ake-font-size-sm);
}

.dungeon-reward-groups {
  display: flex;
  flex-wrap: wrap;
  gap: var(--ake-space-4);
}

.dungeon-reward-groups > section {
  min-width: 12.5rem;
  flex: 1;
  padding: var(--ake-space-3);
  border: var(--ake-border-width) solid var(--ake-color-border);
  border-radius: var(--ake-radius-lg);
  background: var(--ake-color-surface);
}

.dungeon-reward-groups > section.is-hunter {
  flex-basis: 100%;
}

.dungeon-reward-groups h4 {
  display: flex;
  justify-content: space-between;
  gap: var(--ake-space-2);
  margin: 0 0 var(--ake-space-2);
}

.dungeon-reward-groups h4 small {
  color: var(--ake-color-text-muted);
}

.dungeon-reward-groups section > div {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--ake-space-2);
}

.dungeon-reward-groups section > div + div {
  margin-block-start: var(--ake-space-3);
}

.dungeon-reward-groups span {
  display: inline-flex;
  align-items: center;
  gap: var(--ake-space-1);
  padding: 0.1875rem 0.5rem;
  border-radius: var(--ake-radius-md);
  background: var(--ake-color-surface-muted);
  font-size: var(--ake-font-size-sm);
}

.dungeon-reward-groups span :deep(.ake-image) {
  width: 1.75rem;
  height: 1.75rem;
}

.dungeon-enemies > div {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(21.25rem, 1fr));
  gap: var(--ake-space-4);
}

.dungeon-mobile-button {
  position: fixed;
  z-index: 90;
  inset: auto var(--ake-space-4) 5rem auto;
  display: none;
  align-items: center;
  gap: var(--ake-space-2);
  min-height: 2.75rem;
  padding: 0.625rem 0.875rem;
  border: 0;
  border-radius: var(--ake-radius-pill);
  background: var(--ake-color-accent);
  box-shadow: var(--ake-shadow-lg);
  color: var(--ake-color-on-accent);
  font: inherit;
  font-weight: 700;
}

@media (max-width: 999px) {
  .dungeon-module {
    display: block;
  }

  .dungeon-sidebar {
    display: none;
  }

  .dungeon-mobile-button {
    display: inline-flex;
  }

  .dungeon-detail {
    padding: var(--ake-space-4);
  }
}

@media (max-width: 600px) {
  .dungeon-detail,
  .dungeon-card {
    padding: var(--ake-space-3);
  }

  .dungeon-enemies > div {
    grid-template-columns: minmax(0, 1fr);
  }

  .dungeon-series-role {
    width: 35%;
  }
}
</style>
