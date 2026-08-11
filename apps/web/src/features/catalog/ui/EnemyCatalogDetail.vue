<script setup lang="ts">
import { computed, ref } from 'vue'
import { ChevronDown, ChevronRight } from '@lucide/vue'
import { ImageWithFallback } from '@ake/ui'
import type { EnemyDetailModel, EnemyVariantModel } from '@ake/domain'
import CatalogRichText from './CatalogRichText.vue'
import { catalogUiText } from './copy'

const props = defineProps<{
  model: EnemyDetailModel
  locale: string
  preferredLevels: readonly number[]
  resolveImageUrl: (path: string) => string
}>()

const expandedVariants = ref(new Set<string>())

const flagsWithLabels = computed(() =>
  props.model.variants.map((variant) => ({
    id: variant.id,
    labels: variant.flags.map((flag) => catalogUiText(props.locale, flag))
  }))
)

function variantFlags(variant: EnemyVariantModel): readonly string[] {
  return flagsWithLabels.value.find((item) => item.id === variant.id)?.labels ?? []
}

function visibleRows(variant: EnemyVariantModel) {
  if (expandedVariants.value.has(variant.id) || !props.preferredLevels.length) return variant.rows
  const preferred = new Set(props.preferredLevels)
  const rows = variant.rows.filter((row) => preferred.has(row.level))
  return rows.length ? rows : variant.rows.slice(-1)
}

function toggleVariant(variant: EnemyVariantModel): void {
  const next = new Set(expandedVariants.value)
  if (next.has(variant.id)) next.delete(variant.id)
  else next.add(variant.id)
  expandedVariants.value = next
}

function formatValue(value: string | number): string {
  if (typeof value === 'string') return value
  return Number.isInteger(value) ? value.toLocaleString() : String(Math.round(value * 1000) / 1000)
}
</script>

<template>
  <article class="enemy-detail">
    <header class="enemy-header" data-layout-section="enemy-header">
      <div class="enemy-header__identity">
        <ImageWithFallback
          class="enemy-header__icon"
          :src="resolveImageUrl(model.icon)"
          :alt="model.name"
          width="112"
          height="112"
          aspect-ratio="1"
        />
        <div class="enemy-header__copy">
          <div class="enemy-header__title-row">
            <h1>{{ model.name }}</h1>
            <span>{{ model.rarity }}★</span>
            <code>{{ model.id }}</code>
          </div>
          <div v-if="model.tags.length" class="enemy-chips">
            <span v-for="tag in model.tags" :key="tag">{{ tag }}</span>
          </div>
          <dl v-if="model.meta.length" class="enemy-meta">
            <div v-for="item in model.meta" :key="item.id">
              <dt>{{ item.label || catalogUiText(locale, item.id) }}</dt>
              <dd>{{ formatValue(item.value) }}</dd>
            </div>
          </dl>
          <CatalogRichText
            v-if="model.description"
            class="enemy-header__description"
            :value="model.description"
            :resolve-image-url="resolveImageUrl"
          />
          <div v-if="model.abilities.length" class="enemy-abilities">
            <h2>{{ catalogUiText(locale, 'abilities') }}</h2>
            <CatalogRichText
              v-for="(ability, index) in model.abilities"
              :key="`${index}-${ability}`"
              :value="ability"
              :resolve-image-url="resolveImageUrl"
            />
          </div>
        </div>
      </div>
      <ImageWithFallback
        class="enemy-header__portrait"
        :src="resolveImageUrl(model.portrait)"
        :alt="model.name"
        width="340"
        height="340"
        aspect-ratio="1"
      />
    </header>

    <section
      v-if="model.poiseBreakBuffs.length"
      class="enemy-section"
      data-layout-section="poise-break-buffs"
    >
      <h2>{{ catalogUiText(locale, 'poiseBreakBuffs') }}</h2>
      <div class="enemy-chips">
        <code v-for="buff in model.poiseBreakBuffs" :key="buff">{{ buff }}</code>
      </div>
    </section>

    <section v-if="model.variants.length" class="enemy-section" data-layout-section="variant-attributes">
      <h2>{{ catalogUiText(locale, 'variantAttributes') }}</h2>
      <div class="enemy-variants">
        <article v-for="variant in model.variants" :key="variant.id" class="enemy-variant">
          <header class="enemy-variant__header">
            <div>
              <h3>{{ variant.id }}</h3>
              <span v-if="variant.isBase">{{ catalogUiText(locale, 'baseVariant') }}</span>
            </div>
            <button
              v-if="variant.rows.length > preferredLevels.length"
              type="button"
              :aria-label="catalogUiText(locale, expandedVariants.has(variant.id) ? 'collapse' : 'expand')"
              @click="toggleVariant(variant)"
            >
              <ChevronDown v-if="expandedVariants.has(variant.id)" :size="18" aria-hidden="true" />
              <ChevronRight v-else :size="18" aria-hidden="true" />
            </button>
          </header>

          <dl class="enemy-variant__template">
            <dt>{{ catalogUiText(locale, 'template') }}</dt>
            <dd>
              <code>{{ variant.templateId }}</code>
            </dd>
          </dl>

          <div v-if="variant.modifiers.length" class="enemy-variant__group">
            <h4>{{ catalogUiText(locale, 'modifiers') }}</h4>
            <dl class="enemy-values">
              <div v-for="modifier in variant.modifiers" :key="modifier.id">
                <dt>{{ modifier.label }}</dt>
                <dd>{{ formatValue(modifier.value) }}</dd>
              </div>
            </dl>
          </div>

          <div v-if="variant.buffs.length" class="enemy-variant__group">
            <h4>{{ catalogUiText(locale, 'buffs') }}</h4>
            <div class="enemy-chips">
              <code v-for="buff in variant.buffs" :key="buff">{{ buff }}</code>
            </div>
          </div>

          <div v-if="variant.flags.length" class="enemy-variant__group">
            <div class="enemy-chips">
              <span v-for="flag in variantFlags(variant)" :key="flag">{{ flag }}</span>
            </div>
          </div>

          <div v-if="variant.differences.length" class="enemy-variant__group">
            <h4>{{ catalogUiText(locale, 'differences') }}</h4>
            <dl class="enemy-values">
              <div v-for="difference in variant.differences" :key="difference.id">
                <dt>{{ difference.label || catalogUiText(locale, difference.id) }}</dt>
                <dd>{{ formatValue(difference.value) }}</dd>
              </div>
            </dl>
          </div>

          <div v-if="variant.rows.length" class="enemy-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{{ catalogUiText(locale, 'level') }}</th>
                  <th>{{ catalogUiText(locale, 'hp') }}</th>
                  <th>{{ catalogUiText(locale, 'attack') }}</th>
                  <th>{{ catalogUiText(locale, 'defense') }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in visibleRows(variant)" :key="row.level">
                  <th>{{ row.level }}</th>
                  <td>{{ formatValue(row.hp) }}</td>
                  <td>{{ formatValue(row.attack) }}</td>
                  <td>{{ formatValue(row.defense) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </article>
      </div>
    </section>
  </article>
</template>

<style scoped>
.enemy-detail {
  min-width: 0;
}

.enemy-header {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(180px, 30%);
  min-height: 300px;
  overflow: hidden;
  border-block-end: var(--ake-border-width) solid var(--ake-color-border);
}

.enemy-header__identity {
  display: grid;
  grid-template-columns: 112px minmax(0, 1fr);
  min-width: 0;
  align-items: start;
  gap: var(--ake-space-4);
  padding-block: var(--ake-space-5);
}

.enemy-header__copy {
  min-width: 0;
}

.enemy-header__title-row {
  display: flex;
  min-width: 0;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--ake-space-2);
}

.enemy-header h1 {
  margin: 0;
  font-size: var(--ake-font-size-2xl);
  letter-spacing: 0;
  overflow-wrap: anywhere;
}

.enemy-header__title-row > span,
.enemy-chips > span,
.enemy-chips > code,
.enemy-variant__header span {
  padding: 3px 7px;
  border: var(--ake-border-width) solid var(--ake-color-border);
  border-radius: var(--ake-radius-sm);
  color: inherit;
  background: var(--ake-color-surface-subtle);
  font-family: inherit;
  font-size: var(--ake-font-size-xs);
}

.enemy-header code,
.enemy-variant code {
  overflow-wrap: anywhere;
}

.enemy-header__title-row code {
  color: var(--ake-color-text-muted);
  font-size: var(--ake-font-size-xs);
}

.enemy-chips {
  display: flex;
  flex-wrap: wrap;
  gap: var(--ake-space-1);
  margin-top: var(--ake-space-3);
}

.enemy-meta,
.enemy-values {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 150px), 1fr));
  gap: var(--ake-space-2);
  margin: var(--ake-space-4) 0;
}

.enemy-meta div,
.enemy-values div {
  min-width: 0;
}

.enemy-meta dt,
.enemy-values dt,
.enemy-variant__template dt {
  color: var(--ake-color-text-muted);
  font-size: var(--ake-font-size-xs);
}

.enemy-meta dd,
.enemy-values dd,
.enemy-variant__template dd {
  margin: 2px 0 0;
  overflow-wrap: anywhere;
}

.enemy-header__description {
  display: block;
  margin-top: var(--ake-space-3);
  color: var(--ake-color-text-muted);
  line-height: var(--ake-line-height-relaxed);
}

.enemy-abilities {
  margin-top: var(--ake-space-4);
  padding-top: var(--ake-space-3);
  border-block-start: var(--ake-border-width) solid var(--ake-color-border);
}

.enemy-abilities h2 {
  margin: 0 0 var(--ake-space-2);
  font-size: var(--ake-font-size-md);
  letter-spacing: 0;
}

.enemy-abilities :deep(p) {
  margin-block: var(--ake-space-1);
}

.enemy-header__portrait {
  width: 100%;
  height: 100%;
  max-height: 390px;
  object-fit: contain;
}

.enemy-section {
  padding-block: var(--ake-space-5);
  border-block-end: var(--ake-border-width) solid var(--ake-color-border);
}

.enemy-section > h2 {
  margin: 0 0 var(--ake-space-3);
  font-size: var(--ake-font-size-lg);
  letter-spacing: 0;
}

.enemy-variants {
  display: grid;
  gap: var(--ake-space-4);
}

.enemy-variant {
  min-width: 0;
  padding: var(--ake-space-4);
  border: var(--ake-border-width) solid var(--ake-color-border);
  border-radius: var(--ake-radius-md);
  background: var(--ake-color-surface-raised);
}

.enemy-variant__header {
  display: flex;
  min-width: 0;
  align-items: center;
  justify-content: space-between;
  gap: var(--ake-space-3);
  margin-bottom: var(--ake-space-3);
}

.enemy-variant__header > div {
  display: flex;
  min-width: 0;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--ake-space-2);
}

.enemy-variant__header h3 {
  margin: 0;
  font-size: var(--ake-font-size-md);
  letter-spacing: 0;
  overflow-wrap: anywhere;
}

.enemy-variant__header button {
  display: grid;
  width: 32px;
  height: 32px;
  flex: 0 0 auto;
  padding: 0;
  place-items: center;
  border: var(--ake-border-width) solid var(--ake-color-border);
  border-radius: var(--ake-radius-sm);
  color: inherit;
  background: var(--ake-color-surface);
  cursor: pointer;
}

.enemy-variant__template {
  margin: 0;
}

.enemy-variant__group {
  padding-top: var(--ake-space-3);
  border-block-start: var(--ake-border-width) solid var(--ake-color-border);
  margin-top: var(--ake-space-3);
}

.enemy-variant__group h4 {
  margin: 0 0 var(--ake-space-2);
  font-size: var(--ake-font-size-sm);
  letter-spacing: 0;
}

.enemy-variant__group .enemy-values,
.enemy-variant__group .enemy-chips {
  margin-block: 0;
}

.enemy-table-wrap {
  max-width: 100%;
  margin-top: var(--ake-space-4);
  overflow-x: auto;
}

table {
  width: max-content;
  min-width: 100%;
  border-collapse: collapse;
}

th,
td {
  padding: var(--ake-space-2) var(--ake-space-3);
  border: var(--ake-border-width) solid var(--ake-color-border);
  text-align: start;
  white-space: nowrap;
}

thead th {
  background: var(--ake-color-surface-subtle);
}

@media (max-width: 52rem) {
  .enemy-header {
    grid-template-columns: minmax(0, 1fr);
  }

  .enemy-header__portrait {
    max-height: 20rem;
  }
}

@media (max-width: 34rem) {
  .enemy-header__identity {
    grid-template-columns: 76px minmax(0, 1fr);
  }

  .enemy-header__icon {
    width: 76px;
    height: 76px;
  }
}
</style>
