<script setup lang="ts">
import { computed } from 'vue'
import { ArrowRight } from '@lucide/vue'
import { ImageWithFallback } from '@ake/ui'
import type { ItemDetailModel, ItemRecipeModel } from '@ake/domain'
import CatalogRichText from './CatalogRichText.vue'
import { catalogUiText } from './copy'

const props = defineProps<{
  model: ItemDetailModel
  locale: string
  showHidden: boolean
  resolveImageUrl: (path: string) => string
}>()

const emit = defineEmits<{ selectItem: [id: string] }>()

const recipeGroups = computed(() =>
  [
    {
      id: 'sources',
      label: catalogUiText(props.locale, 'recipeSources'),
      recipes: props.model.recipes.filter((recipe) =>
        recipe.outputs.some((item) => item.id === props.model.id)
      )
    },
    {
      id: 'uses',
      label: catalogUiText(props.locale, 'recipeUses'),
      recipes: props.model.recipes.filter((recipe) =>
        recipe.inputs.some((item) => item.id === props.model.id)
      )
    }
  ].filter((group) => group.recipes.length)
)

function formatDuration(milliseconds: number): string {
  if (!milliseconds) return catalogUiText(props.locale, 'notConfigured')
  let seconds = Math.round(milliseconds / 1_000)
  const days = Math.floor(seconds / 86_400)
  seconds %= 86_400
  const hours = Math.floor(seconds / 3_600)
  seconds %= 3_600
  const minutes = Math.floor(seconds / 60)
  seconds %= 60
  const parts = [
    [days, catalogUiText(props.locale, 'daysShort')],
    [hours, catalogUiText(props.locale, 'hoursShort')],
    [minutes, catalogUiText(props.locale, 'minutesShort')],
    [seconds, catalogUiText(props.locale, 'secondsShort')]
  ] as const
  return (
    parts
      .filter(([value]) => value > 0)
      .map(([value, unit]) => `${value}${unit}`)
      .join('') || catalogUiText(props.locale, 'lessThanSecond')
  )
}

function recipeMeta(recipe: ItemRecipeModel): string {
  if (!recipe.meta) return ''
  return /^\d+$/.test(recipe.meta)
    ? catalogUiText(props.locale, 'facilityLevel', { level: recipe.meta })
    : recipe.meta
}
</script>

<template>
  <article class="item-detail">
    <header class="item-header" data-layout-section="item-header">
      <div class="item-header__identity">
        <ImageWithFallback
          class="item-header__icon"
          :src="resolveImageUrl(model.icon)"
          :alt="model.name"
          width="112"
          height="112"
          aspect-ratio="1"
        />
        <div>
          <div class="item-header__title-row">
            <h1>{{ model.name }}</h1>
            <span>{{ model.rarity }}★</span>
            <code>{{ model.id }}</code>
          </div>
          <span v-if="model.typeLabel" class="item-type">{{ model.typeLabel }}</span>
        </div>
      </div>
      <CatalogRichText
        v-if="model.description"
        class="item-header__description"
        :value="model.description"
        :resolve-image-url="resolveImageUrl"
      />
      <CatalogRichText
        v-if="model.decorativeDescription && model.decorativeDescription !== model.description"
        class="item-header__decorative"
        :value="model.decorativeDescription"
        :resolve-image-url="resolveImageUrl"
      />
    </header>

    <section v-if="model.effects.length" class="item-section" data-layout-section="use-effects">
      <h2>{{ catalogUiText(locale, 'useEffects') }}</h2>
      <div class="item-list">
        <article v-for="effect in model.effects" :key="effect.id" class="item-effect">
          <h3>{{ catalogUiText(locale, effect.id) }}</h3>
          <CatalogRichText
            v-for="(description, index) in effect.descriptions"
            :key="index"
            :value="description"
            :resolve-image-url="resolveImageUrl"
          />
          <div v-if="effect.meta.length" class="item-chips">
            <span v-for="meta in effect.meta" :key="meta.id">
              {{ catalogUiText(locale, meta.id) }}: {{ meta.value }}
            </span>
          </div>
        </article>
      </div>
    </section>

    <section v-if="model.properties.length" class="item-section" data-layout-section="properties">
      <h2>{{ catalogUiText(locale, 'properties') }}</h2>
      <dl class="item-properties">
        <div v-for="property in model.properties" :key="property.id">
          <dt>{{ property.label || catalogUiText(locale, property.id) }}</dt>
          <dd>{{ property.value }}</dd>
        </div>
      </dl>
    </section>

    <section v-if="recipeGroups.length" class="item-section" data-layout-section="crafting-paths">
      <h2>{{ catalogUiText(locale, 'craftingPaths') }}</h2>
      <div v-for="group in recipeGroups" :key="group.id" class="recipe-group">
        <h3>{{ group.label }}</h3>
        <article v-for="recipe in group.recipes" :key="recipe.id" class="recipe-card">
          <header>
            <span>{{ catalogUiText(locale, recipe.kind) }}</span>
            <strong>{{ recipe.name }}</strong>
            <small v-if="recipeMeta(recipe)">{{ recipeMeta(recipe) }}</small>
            <small>{{ formatDuration(recipe.durationMs) }}</small>
          </header>
          <div class="recipe-flow">
            <div class="recipe-side">
              <span v-if="!recipe.inputs.length" class="recipe-empty">
                {{ catalogUiText(locale, 'noMaterials') }}
              </span>
              <button
                v-for="item in recipe.inputs"
                v-else
                :key="item.id"
                type="button"
                class="recipe-item"
                :class="{ 'is-current': item.id === model.id }"
                @click="emit('selectItem', item.id)"
              >
                <img :src="resolveImageUrl(item.icon)" :alt="item.name" width="34" height="34" />
                <span>{{ item.name }}</span>
                <strong>×{{ item.count }}</strong>
              </button>
            </div>
            <ArrowRight class="recipe-arrow" :size="20" aria-hidden="true" />
            <div class="recipe-side">
              <button
                v-for="item in recipe.outputs"
                :key="item.id"
                type="button"
                class="recipe-item"
                :class="{ 'is-current': item.id === model.id }"
                @click="emit('selectItem', item.id)"
              >
                <img :src="resolveImageUrl(item.icon)" :alt="item.name" width="34" height="34" />
                <span>{{ item.name }}</span>
                <strong>×{{ item.count }}</strong>
              </button>
            </div>
          </div>
        </article>
      </div>
    </section>

    <section v-if="model.obtainWays.length" class="item-section" data-layout-section="obtain-ways">
      <h2>{{ catalogUiText(locale, 'obtainWays') }}</h2>
      <div class="obtain-list">
        <article v-for="way in model.obtainWays" :key="way.id">
          <ImageWithFallback
            :src="resolveImageUrl(way.icon)"
            alt=""
            width="42"
            height="42"
            aspect-ratio="1"
          />
          <CatalogRichText :value="way.description" :resolve-image-url="resolveImageUrl" />
        </article>
      </div>
    </section>

    <section
      v-if="showHidden && model.applicableWeapons.length"
      class="item-section"
      data-layout-section="applicable-weapons"
    >
      <h2>{{ catalogUiText(locale, 'applicableWeapons') }}</h2>
      <div class="item-id-list">
        <code v-for="weaponId in model.applicableWeapons" :key="weaponId">{{ weaponId }}</code>
      </div>
    </section>

    <section
      v-if="showHidden && model.choiceBox"
      class="item-section"
      data-layout-section="choice-box-contents"
    >
      <h2>{{ catalogUiText(locale, 'choiceBoxContents') }}</h2>
      <p v-if="model.choiceBox.selectedCount" class="item-section__meta">
        {{ catalogUiText(locale, 'selectableCount', { count: model.choiceBox.selectedCount }) }}
      </p>
      <div v-if="model.choiceBox.rewardIds.length" class="item-id-list">
        <code v-for="rewardId in model.choiceBox.rewardIds" :key="rewardId">{{ rewardId }}</code>
      </div>
    </section>

    <section v-if="model.iconComposite.length" class="item-section" data-layout-section="icon-composite">
      <h2>{{ catalogUiText(locale, 'iconComposite') }}</h2>
      <dl class="item-properties">
        <div v-for="property in model.iconComposite" :key="property.id">
          <dt>{{ catalogUiText(locale, property.id) }}</dt>
          <dd>
            {{
              property.value === 'yes' || property.value === 'no'
                ? catalogUiText(locale, String(property.value))
                : property.value
            }}
          </dd>
        </div>
      </dl>
    </section>

    <section v-if="model.displayType" class="item-section" data-layout-section="display-type">
      <h2>{{ catalogUiText(locale, 'displayType') }}</h2>
      <span class="item-type">{{ model.displayType }}</span>
    </section>

    <section
      v-if="showHidden && model.encyclopedia"
      class="item-section"
      data-layout-section="encyclopedia-entry"
    >
      <h2>{{ catalogUiText(locale, 'encyclopediaEntry') }}</h2>
      <dl class="item-properties">
        <div>
          <dt>{{ catalogUiText(locale, 'entryId') }}</dt>
          <dd>{{ model.encyclopedia.id }}</dd>
        </div>
        <div v-if="model.encyclopedia.groupId">
          <dt>{{ catalogUiText(locale, 'encyclopediaGroup') }}</dt>
          <dd>{{ model.encyclopedia.groupId }}</dd>
        </div>
      </dl>
    </section>
  </article>
</template>

<style scoped>
.item-detail {
  min-width: 0;
}
.item-header {
  padding-block: var(--ake-space-5);
  border-block-end: var(--ake-border-width) solid var(--ake-color-border);
}
.item-header__identity {
  display: grid;
  grid-template-columns: 112px minmax(0, 1fr);
  align-items: center;
  gap: var(--ake-space-4);
}
.item-header__title-row {
  display: flex;
  min-width: 0;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--ake-space-2);
}
.item-header h1 {
  margin: 0;
  font-size: var(--ake-font-size-2xl);
  letter-spacing: 0;
  overflow-wrap: anywhere;
}
.item-header__title-row > span,
.item-type,
.item-chips span {
  display: inline-flex;
  padding: 3px 7px;
  border: var(--ake-border-width) solid var(--ake-color-border);
  border-radius: var(--ake-radius-sm);
  background: var(--ake-color-surface-subtle);
  font-size: var(--ake-font-size-xs);
}
.item-header code {
  color: var(--ake-color-text-muted);
  font-size: var(--ake-font-size-xs);
  overflow-wrap: anywhere;
}
.item-type {
  margin-top: var(--ake-space-2);
}
.item-header__description,
.item-header__decorative {
  display: block;
  margin-top: var(--ake-space-4);
  line-height: var(--ake-line-height-relaxed);
}
.item-header__decorative {
  color: var(--ake-color-text-muted);
}
.item-section {
  padding-block: var(--ake-space-5);
  border-block-end: var(--ake-border-width) solid var(--ake-color-border);
}
.item-section > h2 {
  margin: 0 0 var(--ake-space-3);
  font-size: var(--ake-font-size-lg);
  letter-spacing: 0;
}
.item-list {
  display: grid;
  gap: var(--ake-space-3);
}
.item-effect,
.recipe-card {
  min-width: 0;
  padding: var(--ake-space-4);
  border: var(--ake-border-width) solid var(--ake-color-border);
  border-radius: var(--ake-radius-md);
  background: var(--ake-color-surface-raised);
}
.item-effect h3,
.recipe-group h3 {
  margin: 0 0 var(--ake-space-2);
  font-size: var(--ake-font-size-md);
  letter-spacing: 0;
}
.item-chips {
  display: flex;
  flex-wrap: wrap;
  gap: var(--ake-space-2);
  margin-top: var(--ake-space-3);
}
.item-properties {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 180px), 1fr));
  gap: var(--ake-space-3);
  margin: 0;
}
.item-properties div {
  padding: var(--ake-space-3);
  background: var(--ake-color-surface-subtle);
}
.item-properties dt {
  color: var(--ake-color-text-muted);
  font-size: var(--ake-font-size-xs);
}
.item-properties dd {
  margin: var(--ake-space-1) 0 0;
  font-weight: 700;
  overflow-wrap: anywhere;
}
.item-section__meta {
  margin: 0 0 var(--ake-space-3);
  color: var(--ake-color-text-muted);
  font-size: var(--ake-font-size-sm);
}
.item-id-list {
  display: flex;
  min-width: 0;
  flex-wrap: wrap;
  gap: var(--ake-space-2);
}
.item-id-list code {
  max-width: 100%;
  padding: 3px 7px;
  border: var(--ake-border-width) solid var(--ake-color-border);
  border-radius: var(--ake-radius-sm);
  background: var(--ake-color-surface-subtle);
  font-size: var(--ake-font-size-xs);
  overflow-wrap: anywhere;
}
.recipe-group + .recipe-group {
  margin-top: var(--ake-space-5);
}
.recipe-card + .recipe-card {
  margin-top: var(--ake-space-3);
}
.recipe-card > header {
  display: flex;
  min-width: 0;
  align-items: baseline;
  flex-wrap: wrap;
  gap: var(--ake-space-2);
}
.recipe-card > header > span {
  padding: 2px 6px;
  border-radius: var(--ake-radius-sm);
  background: var(--ake-color-surface-subtle);
  font-size: var(--ake-font-size-xs);
}
.recipe-card > header small {
  color: var(--ake-color-text-muted);
}
.recipe-flow {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 24px minmax(0, 1fr);
  align-items: center;
  gap: var(--ake-space-3);
  margin-top: var(--ake-space-3);
}
.recipe-side {
  display: flex;
  min-width: 0;
  flex-wrap: wrap;
  gap: var(--ake-space-2);
}
.recipe-item {
  display: grid;
  grid-template-columns: 34px minmax(0, 1fr) auto;
  min-width: min(100%, 12rem);
  flex: 1;
  align-items: center;
  gap: var(--ake-space-2);
  padding: var(--ake-space-2);
  border: var(--ake-border-width) solid var(--ake-color-border);
  border-radius: var(--ake-radius-sm);
  color: inherit;
  background: var(--ake-color-surface);
  font: inherit;
  text-align: start;
  cursor: pointer;
}
.recipe-item.is-current {
  border-color: var(--ake-color-accent);
}
.recipe-item span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.recipe-empty {
  color: var(--ake-color-text-muted);
}
.recipe-arrow {
  justify-self: center;
}
.obtain-list {
  display: grid;
  gap: var(--ake-space-2);
}
.obtain-list article {
  display: grid;
  grid-template-columns: 42px minmax(0, 1fr);
  align-items: center;
  gap: var(--ake-space-3);
  padding: var(--ake-space-3);
  background: var(--ake-color-surface-subtle);
}
@media (max-width: 34rem) {
  .item-header__identity {
    grid-template-columns: 76px minmax(0, 1fr);
  }
  .item-header__icon {
    width: 76px;
    height: 76px;
  }
  .recipe-flow {
    grid-template-columns: minmax(0, 1fr);
  }
  .recipe-arrow {
    transform: rotate(90deg);
  }
}
</style>
