<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { useQuery } from '@tanstack/vue-query'
import { List, Search } from '@lucide/vue'
import { EmptyState, ErrorState, LoadingState, ResponsiveDrawer } from '@ake/ui'
import { LANGUAGE_INFO, type AppLocale } from '@ake/r2-contract'
import { useAppContext } from '../../../app/providers/app-context'
import { usePreferencesStore } from '../../../app/stores/preferences'
import { userErrorMessageKey } from '../../../shared/i18n'
import { getShopRepository } from '../api/repository'
import {
  buildShopRotationSchedule,
  filterShopGroup,
  filterShopGroups,
  formatShopCountdown,
  nextDailyRefresh,
  nextWeeklyRefresh,
  type ShopContext,
  type ShopGroup,
  type ShopView
} from '../model'
import { shopCopy, type ShopCopyKey } from './copy'
import ShopProductCard from './ShopProductCard.vue'
import ShopRotationTable from './ShopRotationTable.vue'

const { client, dataState } = useAppContext()
const preferences = usePreferencesStore()
const repository = getShopRepository(client)
const route = useRoute()
const router = useRouter()
const { locale, t, te } = useI18n()

const search = ref('')
const activeShopId = ref('')
const mobileDirectoryOpen = ref(false)
const now = ref(Date.now())
let countdownTimer: ReturnType<typeof setInterval> | undefined

function tr(key: ShopCopyKey, params: Readonly<Record<string, string | number>> = {}): string {
  const path = `modules.shop.${key}`
  return te(path) ? String(t(path, params)) : shopCopy(locale.value as AppLocale, key, params)
}

const catalogQuery = useQuery({
  queryKey: computed(() => [
    'shop-catalog',
    dataState.value.baseUrl,
    dataState.value.selected.id,
    dataState.value.manifest.sharedRevision,
    dataState.value.locale,
    preferences.showHidden
  ]),
  queryFn: ({ signal }) => repository.catalog({ showHidden: preferences.showHidden }, signal)
})

const requestedId = computed(() => {
  const id = route.query.id
  return Array.isArray(id) ? (id[0] ?? '') : typeof id === 'string' ? id : ''
})
const groups = computed(() => catalogQuery.data.value?.groups ?? [])
const visibleGroups = computed(() => filterShopGroups(groups.value, search.value))
const selectedGroup = computed<ShopGroup | null>(() => {
  const id = requestedId.value || groups.value[0]?.id || ''
  return groups.value.find((group) => group.id === id) ?? null
})
const displayGroup = computed(() => {
  const group = selectedGroup.value
  return group ? filterShopGroup(group, search.value) : null
})
const activeShop = computed<ShopView | null>(() => {
  const group = displayGroup.value
  return group?.shops.find((shop) => shop.id === activeShopId.value) ?? group?.shops[0] ?? null
})
const schedule = computed(() => buildShopRotationSchedule(catalogQuery.data.value?.weapons ?? {}, now.value))
const dailyCountdown = computed(() => formatShopCountdown(nextDailyRefresh(now.value) - now.value))
const weeklyCountdown = computed(() => formatShopCountdown(nextWeeklyRefresh(now.value) - now.value))
const catalogError = computed(() =>
  catalogQuery.isError.value ? t(userErrorMessageKey(catalogQuery.error.value)) : ''
)

watch(
  [() => displayGroup.value?.id, () => displayGroup.value?.shops.map((shop) => shop.id).join('|')],
  () => {
    const shops = displayGroup.value?.shops ?? []
    if (!shops.some((shop) => shop.id === activeShopId.value)) activeShopId.value = shops[0]?.id ?? ''
  },
  { immediate: true }
)

onMounted(() => {
  countdownTimer = setInterval(() => {
    now.value = Date.now()
  }, 1_000)
})

onBeforeUnmount(() => {
  if (countdownTimer) clearInterval(countdownTimer)
})

function groupType(group: ShopGroup): string {
  if (group.kind === 'recommendation') return tr('groupTypes.recommend')
  if (group.kind === 'cash') return tr('groupTypes.cash')
  const key = `groupTypes.type${group.type}` as ShopCopyKey
  return [
    'groupTypes.type0',
    'groupTypes.type2',
    'groupTypes.type3',
    'groupTypes.type4',
    'groupTypes.type5'
  ].includes(key)
    ? tr(key)
    : tr('groupTypes.other')
}

function shopName(shop: ShopView): string {
  if (shop.kind === 'rotation') return tr('rotation.title')
  if (shop.kind === 'recommendation') return tr('recommendations')
  const key = `shopNames.${shop.id}` as ShopCopyKey
  return [
    'shopNames.shop_pay_weapon_gacha',
    'shopNames.shop_pay_weapon_weekly',
    'shopNames.shop_pay_weapon_daily',
    'shopNames.shop_pay_weapon_constant'
  ].includes(key)
    ? tr(key)
    : shop.name
}

function contextLabel(context: ShopContext): string {
  return tr(`context.${context.kind}` as ShopCopyKey)
}

function configuredDate(value: string): string {
  if (!value) return ''
  const match = value.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})\s+(\d{1,2}):(\d{1,2}):(\d{1,2})$/)
  if (!match) return value
  const date = new Date(
    `${match[1]}-${match[2]?.padStart(2, '0')}-${match[3]?.padStart(2, '0')}T${match[4]?.padStart(2, '0')}:${match[5]?.padStart(2, '0')}:${match[6]?.padStart(2, '0')}+08:00`
  )
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat(LANGUAGE_INFO[locale.value as AppLocale].htmlLang, {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }).format(date)
}

function contextValue(context: ShopContext): string {
  if (context.kind !== 'openTime') return context.value
  return `${configuredDate(context.openTime) || tr('unknown')} - ${configuredDate(context.closeTime) || tr('permanent')}`
}

function selectShop(shopId: string): void {
  activeShopId.value = shopId
}

function openGroup(group: ShopGroup): void {
  mobileDirectoryOpen.value = false
  activeShopId.value = ''
  void router.push({
    name: 'module',
    params: { moduleId: 'v3_shop' },
    query: { ...route.query, id: group.id }
  })
}
</script>

<template>
  <div class="shop-module">
    <aside class="shop-sidebar" :aria-label="tr('groupList')">
      <label class="shop-search" data-shop-directory-block="search">
        <Search :size="17" aria-hidden="true" />
        <input v-model="search" type="search" :placeholder="tr('search')" />
      </label>
      <nav class="shop-group-list" :aria-label="tr('groupList')" data-shop-directory-block="groups">
        <EmptyState
          v-if="!catalogQuery.isPending.value && visibleGroups.length === 0"
          compact
          :title="tr('noMatches')"
        />
        <button
          v-for="group in visibleGroups"
          v-else
          :key="group.id"
          class="shop-group"
          :class="{ 'is-active': group.id === selectedGroup?.id }"
          type="button"
          :data-group-id="group.id"
          @click="openGroup(group)"
        >
          <span class="shop-group-mark" aria-hidden="true" />
          <span class="shop-group-copy">
            <b>{{ group.name }}</b>
            <small>{{ groupType(group) }}</small>
          </span>
          <span class="shop-group-count">{{ group.productCount }}</span>
        </button>
      </nav>
    </aside>

    <div class="shop-content">
      <LoadingState v-if="catalogQuery.isPending.value" :label="tr('loading')" />
      <ErrorState
        v-else-if="catalogQuery.isError.value"
        :title="tr('loadFailed')"
        :description="catalogError"
        :retry-label="t('common.retry')"
        @retry="catalogQuery.refetch()"
      />
      <ErrorState
        v-else-if="requestedId && !selectedGroup"
        :title="t('errors.notFoundTitle')"
        :description="t('errors.deepLinkMissing')"
      />
      <EmptyState v-else-if="!displayGroup" :title="tr('selectGroup')" />
      <template v-else>
        <section class="shop-group-header" data-shop-detail-block="group-header">
          <div>
            <span>{{ groupType(displayGroup) }}</span>
            <h1>{{ displayGroup.name }}</h1>
            <small>{{ displayGroup.id }}</small>
          </div>
          <strong>{{ tr('goodsCount', { count: displayGroup.productCount }) }}</strong>
        </section>

        <dl v-if="displayGroup.context.length" class="shop-context" data-shop-detail-block="context">
          <div v-for="context in displayGroup.context" :key="context.kind">
            <dt>{{ contextLabel(context) }}</dt>
            <dd>{{ contextValue(context) }}</dd>
          </div>
        </dl>

        <div
          v-if="displayGroup.shops.length > 1"
          class="shop-tabs"
          role="tablist"
          data-shop-detail-block="tabs"
        >
          <button
            v-for="shop in displayGroup.shops"
            :key="shop.id"
            type="button"
            role="tab"
            :aria-selected="shop.id === activeShop?.id"
            :class="{ 'is-active': shop.id === activeShop?.id }"
            :data-shop-id="shop.id"
            @click="selectShop(shop.id)"
          >
            <span>{{ shopName(shop) }}</span>
            <b>{{ shop.products.length }}</b>
          </button>
        </div>

        <section v-if="activeShop" class="shop-section" data-shop-detail-block="active-shop">
          <header>
            <div>
              <h2>{{ shopName(activeShop) }}</h2>
              <small v-if="activeShop.kind !== 'rotation'">{{ activeShop.id }}</small>
            </div>
            <span>{{ tr('goodsCount', { count: activeShop.products.length }) }}</span>
          </header>

          <template v-if="activeShop.kind === 'rotation' && activeShop.rotation">
            <div class="shop-rotation-section" data-shop-rotation-block="weekly-current">
              <div class="shop-rotation-head">
                <h3>{{ tr('rotation.weekly') }}</h3>
                <span class="shop-countdown">
                  <span>{{ tr('rotation.refreshIn') }}</span>
                  <strong data-shop-countdown="weekly">{{ weeklyCountdown }}</strong>
                </span>
              </div>
              <div class="shop-products">
                <ShopProductCard
                  v-for="product in activeShop.rotation.weekly"
                  :key="product.id"
                  :product="product"
                />
              </div>
              <template v-if="activeShop.rotation.nextWeekly.length">
                <h3 class="shop-rotation-next" data-shop-rotation-block="weekly-next">
                  {{ tr('rotation.nextBatch') }}
                </h3>
                <div class="shop-products">
                  <ShopProductCard
                    v-for="product in activeShop.rotation.nextWeekly"
                    :key="`next-weekly:${product.id}`"
                    :product="product"
                  />
                </div>
              </template>
            </div>

            <div class="shop-rotation-section" data-shop-rotation-block="daily-current">
              <div class="shop-rotation-head">
                <h3>{{ tr('rotation.daily') }}</h3>
                <span class="shop-countdown">
                  <span>{{ tr('rotation.refreshIn') }}</span>
                  <strong data-shop-countdown="daily">{{ dailyCountdown }}</strong>
                </span>
              </div>
              <div class="shop-products">
                <ShopProductCard
                  v-for="product in activeShop.rotation.daily"
                  :key="product.id"
                  :product="product"
                />
              </div>
              <template v-if="activeShop.rotation.nextDaily.length">
                <h3 class="shop-rotation-next" data-shop-rotation-block="daily-next">
                  {{ tr('rotation.nextBatch') }}
                </h3>
                <div class="shop-products">
                  <ShopProductCard
                    v-for="product in activeShop.rotation.nextDaily"
                    :key="`next-daily:${product.id}`"
                    :product="product"
                  />
                </div>
              </template>
            </div>

            <ShopRotationTable :rows="schedule" />
          </template>

          <div v-else-if="activeShop.products.length" class="shop-products" data-shop-products>
            <ShopProductCard v-for="product in activeShop.products" :key="product.id" :product="product" />
          </div>
          <EmptyState v-else compact :title="tr('noGoods')" />
        </section>
        <EmptyState v-else compact :title="tr('noGoods')" />
      </template>
    </div>

    <ResponsiveDrawer
      v-model:open="mobileDirectoryOpen"
      side="left"
      :title="tr('selectGroup')"
      :close-label="t('common.close')"
    >
      <template #trigger>
        <button class="shop-mobile-button" type="button" :aria-label="tr('groups')">
          <List :size="18" aria-hidden="true" />
          <span>{{ tr('groups') }}</span>
        </button>
      </template>
      <div class="shop-mobile-groups">
        <EmptyState v-if="visibleGroups.length === 0" compact :title="tr('noMatches')" />
        <button
          v-for="group in visibleGroups"
          v-else
          :key="group.id"
          class="shop-group"
          :class="{ 'is-active': group.id === selectedGroup?.id }"
          type="button"
          :data-group-id="group.id"
          @click="openGroup(group)"
        >
          <span class="shop-group-mark" aria-hidden="true" />
          <span class="shop-group-copy">
            <b>{{ group.name }}</b>
            <small>{{ groupType(group) }}</small>
          </span>
          <span class="shop-group-count">{{ group.productCount }}</span>
        </button>
      </div>
    </ResponsiveDrawer>
  </div>
</template>

<style scoped>
.shop-module {
  position: relative;
  display: grid;
  width: 100%;
  height: 100%;
  min-height: 31.25rem;
  grid-template-columns: 282px minmax(0, 1fr);
  gap: 18px;
  overflow: hidden;
  color: var(--ake-color-text);
}

.shop-sidebar {
  display: flex;
  width: 282px;
  min-height: 0;
  flex-direction: column;
  border: var(--ake-border-width) solid var(--ake-color-border);
  background: var(--ake-color-surface-muted);
}

.shop-search {
  display: flex;
  height: 38px;
  align-items: center;
  gap: 8px;
  margin: 12px;
  padding: 0 10px;
  border: var(--ake-border-width) solid var(--ake-color-border);
  background: var(--ake-color-surface);
}

.shop-search > svg {
  flex: 0 0 auto;
  color: var(--ake-color-text-muted);
}

.shop-search input {
  width: 100%;
  min-width: 0;
  border: 0;
  outline: 0;
  color: inherit;
  background: transparent;
  font: inherit;
}

.shop-group-list,
.shop-mobile-groups {
  min-height: 0;
  flex: 1;
  padding: 0 12px 12px;
  overflow-y: auto;
}

.shop-group {
  position: relative;
  display: grid;
  width: 100%;
  min-height: 58px;
  grid-template-columns: 4px minmax(0, 1fr) auto;
  align-items: stretch;
  margin: 0 0 7px;
  padding: 0;
  border: var(--ake-border-width) solid var(--ake-color-border);
  border-radius: 4px;
  color: inherit;
  background: var(--ake-color-surface);
  text-align: left;
  cursor: pointer;
}

.shop-group:hover,
.shop-group.is-active {
  background: var(--ake-color-surface-hover);
}

.shop-group.is-active {
  border-color: var(--ake-color-accent);
}

.shop-group-mark {
  background: transparent;
}

.shop-group.is-active .shop-group-mark {
  background: var(--ake-color-accent);
}

.shop-group-copy {
  min-width: 0;
  padding: 10px 8px;
}

.shop-group-copy b,
.shop-group-copy small {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.shop-group-copy b {
  font-size: 0.88rem;
}

.shop-group-copy small {
  margin-top: 4px;
  color: var(--ake-color-text-muted);
  font-size: 0.7rem;
}

.shop-group-count {
  min-width: 30px;
  align-self: center;
  padding-right: 10px;
  color: var(--ake-color-text-muted);
  font-size: 0.72rem;
  text-align: right;
}

.shop-content {
  min-width: 0;
  min-height: 0;
  padding: 0 4px 28px;
  overflow-y: auto;
  overscroll-behavior: contain;
}

.shop-group-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 18px;
  padding: 14px 2px 18px;
  border-bottom: 2px solid var(--ake-color-accent);
}

.shop-group-header h1 {
  margin: 4px 0 3px;
  font-size: 1.5rem;
  letter-spacing: 0;
}

.shop-group-header span,
.shop-group-header small {
  color: var(--ake-color-text-muted);
  font-size: 0.74rem;
}

.shop-group-header > strong {
  flex: 0 0 auto;
  padding-bottom: 3px;
  color: var(--ake-color-accent);
  font-size: 0.86rem;
}

.shop-context {
  display: flex;
  flex-wrap: wrap;
  gap: 0;
  margin: 0;
  padding: 10px 0;
  border-bottom: var(--ake-border-width) solid var(--ake-color-border);
}

.shop-context div {
  display: flex;
  gap: 7px;
  padding: 4px 18px 4px 2px;
}

.shop-context dt {
  color: var(--ake-color-text-muted);
  font-size: 0.72rem;
}

.shop-context dd {
  margin: 0;
  font-size: 0.76rem;
  font-weight: 600;
}

.shop-tabs {
  display: flex;
  gap: 2px;
  margin-top: 16px;
  overflow-x: auto;
  border-bottom: var(--ake-border-width) solid var(--ake-color-border);
}

.shop-tabs button {
  display: flex;
  min-width: max-content;
  align-items: center;
  gap: 8px;
  padding: 10px 13px;
  border: 0;
  border-bottom: 3px solid transparent;
  color: var(--ake-color-text-muted);
  background: transparent;
  cursor: pointer;
}

.shop-tabs button.is-active {
  border-bottom-color: var(--ake-color-accent);
  color: var(--ake-color-text);
}

.shop-tabs button b {
  font-size: 0.68rem;
  font-weight: 600;
}

.shop-section > header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 14px;
  padding: 20px 2px 12px;
}

.shop-section h2 {
  margin: 0;
  font-size: 1.05rem;
  letter-spacing: 0;
}

.shop-section header small,
.shop-section header > span {
  color: var(--ake-color-text-muted);
  font-size: 0.7rem;
}

.shop-products {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 300px), 1fr));
  gap: 10px;
}

.shop-rotation-section {
  margin-top: 8px;
}

.shop-rotation-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  margin: 14px 0 8px;
  padding-bottom: 6px;
  border-bottom: var(--ake-border-width) solid var(--ake-color-border);
}

.shop-rotation-head h3,
.shop-rotation-next {
  margin: 0;
  font-size: 0.94rem;
  letter-spacing: 0;
}

.shop-rotation-next {
  margin-top: 14px;
  padding-bottom: 6px;
  border-bottom: var(--ake-border-width) solid var(--ake-color-border);
}

.shop-countdown {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 5px;
  font-size: 0.74rem;
}

.shop-countdown > span {
  color: var(--ake-color-text-muted);
}

.shop-countdown strong {
  min-width: 88px;
  color: var(--ake-color-accent);
  font-size: 0.85rem;
  text-align: right;
}

.shop-mobile-button {
  position: fixed;
  z-index: var(--ake-z-sticky);
  right: 18px;
  bottom: 18px;
  display: none;
  height: 42px;
  align-items: center;
  gap: 8px;
  padding: 0 16px;
  border: 0;
  border-radius: 4px;
  color: var(--ake-color-on-accent);
  background: var(--ake-color-accent);
  box-shadow: var(--ake-shadow-dialog);
  cursor: pointer;
}

.shop-mobile-groups {
  display: grid;
  gap: 0;
  padding: 0;
}

@media (max-width: 62.4375rem) {
  .shop-module {
    display: block;
  }

  .shop-sidebar {
    display: none;
  }

  .shop-content {
    height: 100%;
    padding: 0 2px 76px;
  }

  .shop-products {
    grid-template-columns: minmax(0, 1fr);
  }

  .shop-group-header {
    align-items: flex-start;
  }

  .shop-group-header h1 {
    font-size: 1.22rem;
  }

  .shop-mobile-button {
    display: inline-flex;
  }
}

@media (max-width: 34rem) {
  .shop-group-header {
    flex-direction: column;
    gap: 6px;
  }

  .shop-group-header > strong {
    align-self: flex-end;
  }

  .shop-rotation-head {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
