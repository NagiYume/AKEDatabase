<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { ImageWithFallback } from '@ake/ui'
import { LANGUAGE_INFO, type AppLocale } from '@ake/r2-contract'
import { useAppContext } from '../../../app/providers/app-context'
import type { ShopRotationScheduleRow, ShopWeapon } from '../model'
import { shopCopy, type ShopCopyKey } from './copy'

defineProps<{ rows: ShopRotationScheduleRow[] }>()

const { client } = useAppContext()
const { locale, t, te } = useI18n()
const dayKeys: ShopCopyKey[] = [
  'rotation.thu',
  'rotation.fri',
  'rotation.sat',
  'rotation.sun',
  'rotation.mon',
  'rotation.tue',
  'rotation.wed'
]

function tr(key: ShopCopyKey): string {
  const path = `modules.shop.${key}`
  return te(path) ? String(t(path)) : shopCopy(locale.value as AppLocale, key)
}

function imageUrl(iconId: string): string {
  return client.resolveImageUrl(
    `public/images/assets/beyond/dynamicassets/gameplay/ui/sprites/itemiconbig/${iconId}.png`
  )
}

function formatDate(value: number): string {
  return new Intl.DateTimeFormat(LANGUAGE_INFO[locale.value as AppLocale].htmlLang, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date(value))
}

function weaponRoute(weapon: ShopWeapon) {
  return { name: 'module', params: { moduleId: 'v3_weapon' }, query: { id: weapon.id } }
}
</script>

<template>
  <div class="shop-rotation-full" data-shop-rotation-block="schedule">
    <details class="shop-rotation-details" open>
      <summary>{{ tr('rotation.fullTable') }}</summary>
      <div class="shop-rotation-scroll">
        <table class="shop-rotation-table">
          <thead>
            <tr>
              <th colspan="5" />
              <th colspan="7">{{ tr('rotation.dailyTitle') }}</th>
            </tr>
            <tr>
              <th>#</th>
              <th>{{ tr('rotation.startDate') }}</th>
              <th>{{ tr('rotation.endDate') }}</th>
              <th>{{ tr('rotation.weekly6') }}</th>
              <th>{{ tr('rotation.weekly5') }}</th>
              <th v-for="key in dayKeys" :key="key">{{ tr(key) }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in rows" :key="row.index" :class="{ 'is-active': row.active }">
              <td>{{ row.index }}</td>
              <td>{{ formatDate(row.start) }}</td>
              <td>{{ formatDate(row.end) }}</td>
              <td>
                <RouterLink :to="weaponRoute(row.weeklySix)" :title="row.weeklySix.name">
                  <ImageWithFallback
                    :src="imageUrl(row.weeklySix.iconId)"
                    :alt="row.weeklySix.name"
                    width="32"
                    height="32"
                    aspect-ratio="1"
                  />
                </RouterLink>
              </td>
              <td>
                <RouterLink :to="weaponRoute(row.weeklyFive)" :title="row.weeklyFive.name">
                  <ImageWithFallback
                    :src="imageUrl(row.weeklyFive.iconId)"
                    :alt="row.weeklyFive.name"
                    width="32"
                    height="32"
                    aspect-ratio="1"
                  />
                </RouterLink>
              </td>
              <td
                v-for="(weapons, day) in row.days"
                :key="day"
                class="shop-rotation-day"
                :class="{ 'is-active': row.activeDay === day }"
              >
                <RouterLink
                  v-for="weapon in weapons"
                  :key="weapon.id"
                  :to="weaponRoute(weapon)"
                  :title="weapon.name"
                >
                  <ImageWithFallback
                    :src="imageUrl(weapon.iconId)"
                    :alt="weapon.name"
                    width="32"
                    height="32"
                    aspect-ratio="1"
                  />
                </RouterLink>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </details>
  </div>
</template>

<style scoped>
.shop-rotation-full {
  margin-top: 16px;
}

.shop-rotation-details {
  border: var(--ake-border-width) solid var(--ake-color-border);
  border-radius: 4px;
}

.shop-rotation-details summary {
  padding: 10px 13px;
  background: var(--ake-color-surface-muted);
  cursor: pointer;
  font-size: 0.88rem;
  font-weight: 700;
}

.shop-rotation-scroll {
  max-width: 100%;
  overflow-x: auto;
  overscroll-behavior-inline: contain;
}

.shop-rotation-table {
  width: 100%;
  min-width: 980px;
  margin: 0;
  border-collapse: collapse;
  font-size: 0.76rem;
}

.shop-rotation-table thead {
  position: sticky;
  z-index: 2;
  top: 0;
}

.shop-rotation-table th {
  padding: 7px 8px;
  border-bottom: 2px solid var(--ake-color-border);
  background: var(--ake-color-surface-muted);
  font-weight: 700;
  text-align: center;
  white-space: nowrap;
}

.shop-rotation-table td {
  padding: 4px 6px;
  border-bottom: var(--ake-border-width) solid var(--ake-color-border);
  text-align: center;
  vertical-align: middle;
}

.shop-rotation-table th:first-child,
.shop-rotation-table td:first-child {
  min-width: 44px;
}

.shop-rotation-table td:first-child {
  color: var(--ake-color-text-muted);
  font-weight: 600;
}

.shop-rotation-table tbody tr:hover {
  background: var(--ake-color-surface-hover);
}

.shop-rotation-table tbody tr.is-active,
.shop-rotation-day.is-active {
  background: var(--ake-color-accent-soft);
}

.shop-rotation-day {
  min-width: 70px;
}

.shop-rotation-table a {
  display: inline-block;
  vertical-align: middle;
}

.shop-rotation-table a + a {
  margin-left: 3px;
}

.shop-rotation-table :deep(.ake-image) {
  width: 32px;
  height: 32px;
}
</style>
