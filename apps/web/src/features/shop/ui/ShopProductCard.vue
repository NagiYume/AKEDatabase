<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { ImageWithFallback } from '@ake/ui'
import { LANGUAGE_INFO, type AppLocale } from '@ake/r2-contract'
import { useAppContext } from '../../../app/providers/app-context'
import type { ShopCopyKey } from './copy'
import { shopCopy } from './copy'
import type { ShopProduct } from '../model'

const props = defineProps<{ product: ShopProduct }>()
const { client } = useAppContext()
const { locale, t, te } = useI18n()

function tr(key: ShopCopyKey, params: Readonly<Record<string, string | number>> = {}): string {
  const path = `modules.shop.${key}`
  return te(path) ? String(t(path, params)) : shopCopy(locale.value as AppLocale, key, params)
}

function imageUrl(iconId: string): string {
  return iconId
    ? client.resolveImageUrl(
        `public/images/assets/beyond/dynamicassets/gameplay/ui/sprites/itemiconbig/${iconId}.png`
      )
    : ''
}

function number(value: number): string {
  return new Intl.NumberFormat(LANGUAGE_INFO[locale.value as AppLocale].htmlLang, {
    maximumFractionDigits: 2
  }).format(value)
}

function refreshLabel(type: number): string {
  const keys: Record<number, ShopCopyKey> = {
    0: 'refresh.none',
    1: 'refresh.daily',
    2: 'refresh.weekly',
    3: 'refresh.monthly',
    4: 'refresh.pool',
    5: 'refresh.subVersion',
    6: 'refresh.byTime'
  }
  const key = keys[type]
  return key ? tr(key) : tr('refresh.unknown', { type })
}

const limit = computed(() =>
  props.product.limitCount > 0
    ? tr('limitWithRefresh', {
        count: number(props.product.limitCount),
        refresh: refreshLabel(props.product.refreshType)
      })
    : tr('unlimited')
)
</script>

<template>
  <article
    class="shop-product"
    :class="[`shop-rarity-${product.rarity}`, { 'is-hidden': product.hidden }]"
    :data-product-id="product.id"
  >
    <div class="shop-product-head" data-shop-product-block="identity">
      <div class="shop-product-icon">
        <ImageWithFallback
          v-if="product.iconId"
          :src="imageUrl(product.iconId)"
          :alt="product.name"
          width="48"
          height="48"
          aspect-ratio="1"
        />
        <span v-else aria-hidden="true">◇</span>
      </div>
      <div class="shop-product-title">
        <h3>{{ product.name }}</h3>
        <small>{{ product.id }}</small>
      </div>
    </div>

    <div v-if="product.tags.length || product.hidden || product.pool" class="shop-badges">
      <span v-for="tag in product.tags" :key="tag">{{ tag }}</span>
      <span v-if="product.hidden">{{ tr('hidden') }}</span>
      <span v-if="product.pool">{{ tr('weaponClaim') }}</span>
    </div>

    <div class="shop-price" data-shop-product-block="price">
      <template v-if="product.price.kind === 'normal'">
        <ImageWithFallback
          v-if="product.price.currencyIconId"
          :src="imageUrl(product.price.currencyIconId)"
          :alt="product.price.currencyName"
          width="20"
          height="20"
          aspect-ratio="1"
        />
        <del v-if="product.price.original">{{ number(product.price.original) }}</del>
        <strong>{{ number(product.price.current) }}</strong>
        <span>{{ product.price.currencyName }}</span>
        <em v-if="product.price.discountPercent">-{{ product.price.discountPercent }}%</em>
      </template>
      <strong v-else-if="product.price.kind === 'free'">{{ tr('free') }}</strong>
      <strong v-else>
        <template v-if="product.price.cny > 0">¥{{ number(product.price.cny) }}</template>
        <template v-if="product.price.cny > 0 && product.price.usd > 0"> / </template>
        <template v-if="product.price.usd > 0">${{ number(product.price.usd) }}</template>
      </strong>
    </div>

    <div class="shop-product-body">
      <div v-if="product.rewards.length" class="shop-rewards" data-shop-product-block="rewards">
        <div v-for="reward in product.rewards" :key="reward.id" class="shop-reward">
          <ImageWithFallback
            v-if="reward.iconId"
            :src="imageUrl(reward.iconId)"
            :alt="reward.name"
            width="24"
            height="24"
            aspect-ratio="1"
          />
          <span>{{ reward.name }}</span>
          <b>×{{ number(reward.count) }}</b>
        </div>
      </div>

      <template v-if="product.bonusRewards.length">
        <div class="shop-subtitle" data-shop-product-block="bonus">{{ tr('bonusReward') }}</div>
        <div class="shop-rewards is-bonus">
          <div v-for="reward in product.bonusRewards" :key="reward.id" class="shop-reward">
            <ImageWithFallback
              v-if="reward.iconId"
              :src="imageUrl(reward.iconId)"
              :alt="reward.name"
              width="24"
              height="24"
              aspect-ratio="1"
            />
            <span>{{ reward.name }}</span>
            <b>×{{ number(reward.count) }}</b>
          </div>
        </div>
      </template>

      <template v-if="product.monthlyRewards.length">
        <div class="shop-subtitle" data-shop-product-block="monthly">{{ tr('monthlyReward') }}</div>
        <div class="shop-rewards is-monthly">
          <div v-for="reward in product.monthlyRewards" :key="reward.id" class="shop-reward">
            <ImageWithFallback
              v-if="reward.iconId"
              :src="imageUrl(reward.iconId)"
              :alt="reward.name"
              width="24"
              height="24"
              aspect-ratio="1"
            />
            <span>{{ reward.name }}</span>
            <b>×{{ number(reward.count) }}</b>
          </div>
        </div>
      </template>

      <div v-if="product.pool" class="shop-pool" data-shop-product-block="pool">
        <b>{{ product.pool.name }}</b>
        <template v-for="(group, index) in product.pool.groups" :key="group.rarity">
          <div v-if="index === 0" class="shop-pool-rarity">
            <span>{{ group.rarity }}★</span>
            <div class="shop-pool-items">
              <span v-for="weapon in group.items" :key="weapon.id" class="shop-pool-row">
                <RouterLink
                  :to="{ name: 'module', params: { moduleId: 'v3_weapon' }, query: { id: weapon.id } }"
                  :title="weapon.name"
                >
                  <ImageWithFallback
                    :src="imageUrl(weapon.iconId)"
                    :alt="weapon.name"
                    width="24"
                    height="24"
                    aspect-ratio="1"
                  />
                </RouterLink>
                <small>{{ weapon.weight }}</small>
              </span>
            </div>
          </div>
          <details v-else class="shop-pool-rarity">
            <summary>
              {{ group.rarity }}★ <i>({{ group.items.length }})</i>
            </summary>
            <div class="shop-pool-items">
              <span v-for="weapon in group.items" :key="weapon.id" class="shop-pool-row">
                <RouterLink
                  :to="{ name: 'module', params: { moduleId: 'v3_weapon' }, query: { id: weapon.id } }"
                  :title="weapon.name"
                >
                  <ImageWithFallback
                    :src="imageUrl(weapon.iconId)"
                    :alt="weapon.name"
                    width="24"
                    height="24"
                    aspect-ratio="1"
                  />
                </RouterLink>
                <small>{{ weapon.weight }}</small>
              </span>
            </div>
          </details>
        </template>
      </div>

      <p v-if="product.hint" class="shop-note" data-shop-product-block="hint">{{ product.hint }}</p>
      <p v-if="product.lockText" class="shop-note" data-shop-product-block="lock">
        {{ product.lockText }}
      </p>
    </div>

    <footer data-shop-product-block="limit">{{ limit }}</footer>
  </article>
</template>

<style scoped>
.shop-product {
  position: relative;
  display: flex;
  min-width: 0;
  flex-direction: column;
  padding: 13px;
  border: var(--ake-border-width) solid var(--ake-color-border);
  border-radius: 6px;
  background: var(--ake-color-surface);
}

.shop-product.is-hidden {
  border-style: dashed;
  opacity: 0.78;
}

.shop-product-head {
  display: flex;
  min-height: 56px;
  align-items: center;
  gap: 11px;
}

.shop-product-icon {
  display: grid;
  width: 52px;
  height: 52px;
  flex: 0 0 52px;
  place-items: center;
  border: var(--ake-border-width) solid var(--ake-color-border);
  background: var(--ake-color-surface-muted);
}

.shop-product-icon :deep(.ake-image) {
  width: 48px;
  height: 48px;
}

.shop-product-icon > span {
  color: var(--ake-color-text-muted);
  font-size: 1.3rem;
}

.shop-product-title {
  min-width: 0;
}

.shop-product-title h3 {
  margin: 0;
  font-size: 0.91rem;
  letter-spacing: 0;
  line-height: 1.35;
  overflow-wrap: anywhere;
}

.shop-product-title small {
  display: block;
  margin-top: 4px;
  overflow: hidden;
  color: var(--ake-color-text-muted);
  font-size: 0.62rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.shop-badges {
  display: flex;
  min-height: 20px;
  flex-wrap: wrap;
  gap: 5px;
  margin-top: 9px;
}

.shop-badges span {
  padding: 2px 6px;
  border: var(--ake-border-width) solid var(--ake-color-border);
  color: var(--ake-color-text-muted);
  font-size: 0.63rem;
}

.shop-price {
  display: flex;
  min-height: 29px;
  align-items: baseline;
  gap: 6px;
  margin-top: 8px;
  padding: 7px 0;
  border-block: var(--ake-border-width) solid var(--ake-color-border);
}

.shop-price :deep(.ake-image) {
  width: 20px;
  height: 20px;
  align-self: center;
}

.shop-price del,
.shop-price span {
  color: var(--ake-color-text-muted);
  font-size: 0.7rem;
}

.shop-price strong {
  color: var(--ake-color-accent);
  font-size: 1rem;
}

.shop-price em {
  margin-left: auto;
  padding: 2px 5px;
  color: var(--ake-color-danger);
  background: var(--ake-color-surface-muted);
  font-size: 0.65rem;
  font-style: normal;
}

.shop-product-body {
  min-height: 0;
  flex: 1;
  padding-top: 7px;
}

.shop-rewards {
  display: grid;
  gap: 3px;
}

.shop-reward {
  display: grid;
  min-height: 28px;
  grid-template-columns: 24px minmax(0, 1fr) auto;
  align-items: center;
  gap: 7px;
  font-size: 0.72rem;
}

.shop-reward :deep(.ake-image) {
  width: 24px;
  height: 24px;
}

.shop-reward b {
  color: var(--ake-color-text-muted);
  font-size: 0.68rem;
}

.shop-subtitle {
  margin-top: 8px;
  color: var(--ake-color-text-muted);
  font-size: 0.66rem;
  font-weight: 700;
}

.shop-pool,
.shop-note {
  margin: 7px 0 0;
  padding: 7px 8px;
  background: var(--ake-color-surface-muted);
  font-size: 0.69rem;
  line-height: 1.45;
  white-space: pre-wrap;
}

.shop-pool > b {
  display: block;
  margin-bottom: 6px;
  font-size: 0.74rem;
}

.shop-pool-rarity {
  margin-top: 3px;
}

.shop-pool-rarity > span,
.shop-pool-rarity > summary {
  display: block;
  margin-bottom: 3px;
  padding: 1px 0;
  color: var(--ake-color-accent);
  font-size: 0.66rem;
  font-weight: 600;
  cursor: pointer;
}

.shop-pool-rarity summary i {
  color: var(--ake-color-text-muted);
  font-weight: 400;
}

.shop-pool-items {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
}

.shop-pool-row {
  display: flex;
  align-items: center;
  gap: 3px;
}

.shop-pool-row :deep(.ake-image) {
  width: 24px;
  height: 24px;
}

.shop-pool-row small {
  min-width: 24px;
  color: var(--ake-color-text-muted);
  font-size: 0.58rem;
  text-align: right;
}

.shop-product footer {
  margin-top: 9px;
  padding-top: 8px;
  border-top: var(--ake-border-width) solid var(--ake-color-border);
  color: var(--ake-color-text-muted);
  font-size: 0.66rem;
}

.shop-rarity-1 {
  border-left: 3px solid #808080;
}

.shop-rarity-2 {
  border-left: 3px solid #00a541;
}

.shop-rarity-3 {
  border-left: 3px solid #2d6eea;
}

.shop-rarity-4 {
  border-left: 3px solid #8b35c7;
}

.shop-rarity-5 {
  border-left: 3px solid #bd8c00;
}

.shop-rarity-6 {
  border-left: 3px solid #d52e2e;
}
</style>
