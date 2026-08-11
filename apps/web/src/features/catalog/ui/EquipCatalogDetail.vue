<script setup lang="ts">
import { ImageWithFallback } from '@ake/ui'
import type { EquipDetailModel } from '@ake/domain'
import CatalogRichText from './CatalogRichText.vue'
import { catalogUiText } from './copy'

defineProps<{
  model: EquipDetailModel
  locale: string
  showHidden: boolean
  resolveImageUrl: (path: string) => string
}>()

function partLabel(locale: string, type: number): string {
  return catalogUiText(
    locale,
    type === 0 ? 'partArmor' : type === 1 ? 'partGloves' : type === 2 ? 'partAccessory' : 'setPieces'
  )
}

function formatValue(value: number): string {
  if (Math.abs(value) < 1 && value !== 0) return `${Math.round(value * 10_000) / 100}%`
  return Number.isInteger(value) ? value.toLocaleString() : String(Math.round(value * 100) / 100)
}
</script>

<template>
  <article class="equip-detail">
    <header class="equip-header" data-layout-section="equip-header">
      <ImageWithFallback
        class="equip-header__icon"
        :src="resolveImageUrl(model.icon)"
        :alt="model.id === 'suit_none' ? catalogUiText(locale, 'independentEquipment') : model.name"
        width="112"
        height="112"
        aspect-ratio="1"
      />
      <div>
        <div class="equip-header__title-row">
          <h1>{{ model.id === 'suit_none' ? catalogUiText(locale, 'independentEquipment') : model.name }}</h1>
          <span>{{ model.rarity }}★</span>
          <code>{{ model.id }}</code>
        </div>
        <div v-if="model.packs.length" class="equip-chips">
          <span v-for="pack in model.packs" :key="pack">{{ pack }}</span>
        </div>
      </div>
    </header>

    <section v-if="model.skills.length" class="equip-section" data-layout-section="set-skills">
      <h2>{{ catalogUiText(locale, 'setSkills') }}</h2>
      <article v-for="skill in model.skills" :key="skill.id" class="equip-skill">
        <h3>{{ skill.name }}</h3>
        <CatalogRichText :value="skill.description" :resolve-image-url="resolveImageUrl" />
        <div v-if="showHidden && skill.parameters.length" class="equip-chips">
          <code v-for="parameter in skill.parameters" :key="parameter.id">
            {{ parameter.label }}={{ parameter.value }}
          </code>
        </div>
      </article>
    </section>

    <section v-if="model.pieces.length" class="equip-section" data-layout-section="set-pieces">
      <h2>{{ catalogUiText(locale, 'setPieces') }}</h2>
      <div class="equip-grid">
        <article
          v-for="piece in model.pieces"
          :key="piece.id"
          class="equip-card"
          :class="{ 'is-added': piece.added }"
          :data-ake-change="piece.added ? 'added' : undefined"
        >
          <header>
            <ImageWithFallback
              :src="resolveImageUrl(piece.icon)"
              :alt="piece.name"
              width="64"
              height="64"
              aspect-ratio="1"
            />
            <div>
              <div class="equip-card__name-row">
                <h3>{{ piece.name }}</h3>
                <span v-if="piece.added" data-detail-region="version-added-badge">
                  {{ catalogUiText(locale, 'added') }}
                </span>
                <span>{{ piece.rarity }}★</span>
              </div>
              <code v-if="showHidden" data-detail-region="hidden-piece-id">{{ piece.id }}</code>
            </div>
          </header>

          <div class="equip-chips equip-card__meta">
            <span>{{ partLabel(locale, piece.partType) }}</span>
            <span>{{ catalogUiText(locale, 'minimumLevel', { level: piece.minimumLevel }) }}</span>
            <span v-if="piece.domainLabel" :title="showHidden ? piece.domainId : undefined">
              {{ piece.domainLabel }}
            </span>
          </div>

          <dl v-if="piece.mainStat" class="equip-main-stat">
            <dt>{{ piece.mainStat.label }}</dt>
            <dd>
              {{ formatValue(piece.mainStat.value) }}
              <small v-if="showHidden && piece.mainStat.modifierLabel">
                {{ piece.mainStat.modifierLabel }}
              </small>
            </dd>
          </dl>

          <div v-if="piece.subStats.length" class="equip-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{{ catalogUiText(locale, 'stat') }}</th>
                  <th>{{ catalogUiText(locale, 'base') }}</th>
                  <th v-if="piece.subStats.some((stat) => stat.enhancedValues.length)">+1</th>
                  <th v-if="piece.subStats.some((stat) => stat.enhancedValues.length)">+2</th>
                  <th v-if="piece.subStats.some((stat) => stat.enhancedValues.length)">+3</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="stat in piece.subStats" :key="stat.id">
                  <th>
                    {{ stat.label }}
                    <small v-if="showHidden && stat.modifierLabel">{{ stat.modifierLabel }}</small>
                  </th>
                  <td>{{ formatValue(stat.value) }}</td>
                  <template v-if="piece.subStats.some((item) => item.enhancedValues.length)">
                    <td v-for="index in 3" :key="index">
                      {{
                        stat.enhancedValues[index - 1] === undefined
                          ? '—'
                          : formatValue(stat.enhancedValues[index - 1]!)
                      }}
                    </td>
                  </template>
                </tr>
              </tbody>
            </table>
          </div>

          <CatalogRichText
            v-if="piece.description"
            class="equip-card__description"
            data-detail-region="piece-description"
            :value="piece.description"
            :resolve-image-url="resolveImageUrl"
          />

          <div v-if="piece.crafting.length || piece.guarantees.length" class="equip-card__actions">
            <details v-if="piece.crafting.length" data-detail-region="crafting-cost">
              <summary>{{ catalogUiText(locale, 'craftingCost') }}</summary>
              <div v-for="chain in piece.crafting" :key="chain.id" class="equip-cost-chain">
                <strong>{{ chain.level }}</strong>
                <span v-for="item in chain.items" :key="item.id">
                  <img :src="resolveImageUrl(item.icon)" :alt="item.name" width="24" height="24" />
                  {{ item.name }} ×{{ item.count }}
                </span>
              </div>
            </details>
            <details v-if="piece.guarantees.length" data-detail-region="enhancement-guarantee">
              <summary>{{ catalogUiText(locale, 'enhancementGuarantee') }}</summary>
              <div class="equip-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>{{ catalogUiText(locale, 'stat') }}</th>
                      <th>+1</th>
                      <th>+2</th>
                      <th>+3</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="guarantee in piece.guarantees" :key="guarantee.label">
                      <th>{{ guarantee.label }}</th>
                      <td v-for="(value, index) in guarantee.values" :key="index">{{ value }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </details>
          </div>
        </article>
      </div>
    </section>

    <section v-if="model.enhancement" class="equip-section" data-layout-section="enhancement-info">
      <h2>{{ catalogUiText(locale, 'enhancementInfo') }}</h2>
      <dl class="equip-enhancement">
        <div v-if="model.enhancement.maximumCraftingCount !== null">
          <dt>{{ catalogUiText(locale, 'maximumCraftingCount') }}</dt>
          <dd>{{ model.enhancement.maximumCraftingCount }}</dd>
        </div>
        <div v-if="model.enhancement.recyclingReturnRate !== null">
          <dt>{{ catalogUiText(locale, 'recyclingReturnRate') }}</dt>
          <dd>{{ formatValue(model.enhancement.recyclingReturnRate) }}</dd>
        </div>
        <div v-if="model.enhancement.maximumEnhancementLevel !== null">
          <dt>
            {{
              catalogUiText(locale, 'maximumEnhancementLevel', {
                level: model.enhancement.maximumEnhancementLevel
              })
            }}
          </dt>
          <dd>+{{ model.enhancement.maximumEnhancementLevel }}</dd>
        </div>
      </dl>
      <div
        v-if="showHidden && model.enhancement.costs.length"
        class="equip-enhance-costs"
        data-detail-region="enhancement-costs"
      >
        <article v-for="cost in model.enhancement.costs" :key="cost.domainId">
          <h3>{{ cost.domainLabel }}</h3>
          <p>
            {{ catalogUiText(locale, 'materialsConsumed') }}: {{ cost.consumeId }} ×{{ cost.consumeCount }}
          </p>
          <p v-if="cost.returnId" data-detail-region="returned-materials">
            {{ catalogUiText(locale, 'materialsReturned') }}: {{ cost.returnId }} ×{{ cost.returnCount }}
          </p>
        </article>
      </div>
    </section>
  </article>
</template>

<style scoped>
.equip-detail {
  min-width: 0;
}
.equip-header {
  display: grid;
  grid-template-columns: 112px minmax(0, 1fr);
  align-items: center;
  gap: var(--ake-space-4);
  padding-block: var(--ake-space-5);
  border-block-end: var(--ake-border-width) solid var(--ake-color-border);
}
.equip-header__title-row,
.equip-card__name-row {
  display: flex;
  min-width: 0;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--ake-space-2);
}
.equip-header h1 {
  margin: 0;
  font-size: var(--ake-font-size-2xl);
  letter-spacing: 0;
  overflow-wrap: anywhere;
}
.equip-header__title-row > span,
.equip-card__name-row > span,
.equip-chips > span,
.equip-chips > code {
  padding: 3px 7px;
  border: var(--ake-border-width) solid var(--ake-color-border);
  border-radius: var(--ake-radius-sm);
  color: inherit;
  background: var(--ake-color-surface-subtle);
  font-family: inherit;
  font-size: var(--ake-font-size-xs);
}
.equip-header code,
.equip-card code {
  color: var(--ake-color-text-muted);
  font-size: var(--ake-font-size-xs);
  overflow-wrap: anywhere;
}
.equip-chips {
  display: flex;
  flex-wrap: wrap;
  gap: var(--ake-space-1);
  margin-top: var(--ake-space-3);
}
.equip-section {
  padding-block: var(--ake-space-5);
  border-block-end: var(--ake-border-width) solid var(--ake-color-border);
}
.equip-section > h2 {
  margin: 0 0 var(--ake-space-3);
  font-size: var(--ake-font-size-lg);
  letter-spacing: 0;
}
.equip-skill {
  padding: var(--ake-space-3) 0;
  border-block-start: var(--ake-border-width) solid var(--ake-color-border);
}
.equip-skill h3 {
  margin: 0 0 var(--ake-space-2);
  font-size: var(--ake-font-size-md);
  letter-spacing: 0;
}
.equip-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 310px), 1fr));
  gap: var(--ake-space-3);
}
.equip-card {
  min-width: 0;
  padding: var(--ake-space-4);
  border: var(--ake-border-width) solid var(--ake-color-border);
  border-radius: var(--ake-radius-md);
  background: var(--ake-color-surface-raised);
}
.equip-card.is-added {
  border-color: var(--ake-color-accent);
}
.equip-card > header {
  display: grid;
  grid-template-columns: 64px minmax(0, 1fr);
  align-items: center;
  gap: var(--ake-space-3);
}
.equip-card h3 {
  margin: 0;
  font-size: var(--ake-font-size-md);
  letter-spacing: 0;
  overflow-wrap: anywhere;
}
.equip-card__meta {
  margin-block: var(--ake-space-3);
}
.equip-main-stat {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--ake-space-3);
  margin: 0;
  padding: var(--ake-space-3);
  background: var(--ake-color-surface-subtle);
}
.equip-main-stat dd {
  margin: 0;
  font-weight: 700;
}
.equip-main-stat small,
.equip-table-wrap small {
  display: block;
  color: var(--ake-color-text-muted);
  font-weight: 400;
}
.equip-table-wrap {
  max-width: 100%;
  margin-top: var(--ake-space-3);
  overflow-x: auto;
}
table {
  width: max-content;
  min-width: 100%;
  border-collapse: collapse;
}
th,
td {
  padding: var(--ake-space-2);
  border: var(--ake-border-width) solid var(--ake-color-border);
  text-align: start;
  white-space: nowrap;
}
thead th {
  background: var(--ake-color-surface-subtle);
}
.equip-card__description {
  display: block;
  margin-top: var(--ake-space-3);
  color: var(--ake-color-text-muted);
}
.equip-card__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--ake-space-2);
  margin-top: var(--ake-space-3);
}
.equip-card__actions details {
  min-width: min(100%, 14rem);
  flex: 1;
  padding: var(--ake-space-2);
  border: var(--ake-border-width) solid var(--ake-color-border);
  border-radius: var(--ake-radius-sm);
}
.equip-card__actions summary {
  cursor: pointer;
  font-size: var(--ake-font-size-sm);
  font-weight: 700;
}
.equip-cost-chain {
  display: grid;
  gap: var(--ake-space-2);
  padding-top: var(--ake-space-2);
}
.equip-cost-chain span {
  display: flex;
  align-items: center;
  gap: var(--ake-space-2);
  font-size: var(--ake-font-size-xs);
}
.equip-enhancement {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 180px), 1fr));
  gap: var(--ake-space-3);
  margin: 0;
}
.equip-enhancement div,
.equip-enhance-costs article {
  padding: var(--ake-space-3);
  background: var(--ake-color-surface-subtle);
}
.equip-enhancement dt {
  color: var(--ake-color-text-muted);
  font-size: var(--ake-font-size-xs);
}
.equip-enhancement dd {
  margin: var(--ake-space-1) 0 0;
  font-weight: 700;
}
.equip-enhance-costs {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 220px), 1fr));
  gap: var(--ake-space-3);
  margin-top: var(--ake-space-3);
}
.equip-enhance-costs h3,
.equip-enhance-costs p {
  margin: 0;
  font-size: var(--ake-font-size-sm);
  letter-spacing: 0;
}
.equip-enhance-costs p {
  margin-top: var(--ake-space-1);
  color: var(--ake-color-text-muted);
  overflow-wrap: anywhere;
}
@media (max-width: 34rem) {
  .equip-header {
    grid-template-columns: 76px minmax(0, 1fr);
  }
  .equip-header__icon {
    width: 76px;
    height: 76px;
  }
}
</style>
