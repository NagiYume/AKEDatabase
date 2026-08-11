<script setup lang="ts">
import { computed, ref } from 'vue'
import { ImageWithFallback } from '@ake/ui'
import type { WeaponDetailModel } from '@ake/domain'
import CatalogRichText from './CatalogRichText.vue'
import { catalogUiText } from './copy'

const props = defineProps<{
  model: WeaponDetailModel
  locale: string
  preferredLevels: readonly number[]
  resolveImageUrl: (path: string) => string
}>()

const attackExpanded = ref(false)
const attackRows = computed(() => {
  if (attackExpanded.value || !props.preferredLevels.length) return props.model.attackRows
  const levels = new Set(props.preferredLevels)
  const filtered = props.model.attackRows.filter((row) => levels.has(row.level))
  return filtered.length ? filtered : props.model.attackRows.slice(-1)
})
</script>

<template>
  <article class="weapon-detail">
    <header class="weapon-header" data-layout-section="weapon-header">
      <div class="weapon-header__left">
        <div class="weapon-header__identity">
          <ImageWithFallback
            class="weapon-header__icon"
            :src="resolveImageUrl(model.icon)"
            :alt="model.name"
            width="112"
            height="112"
            aspect-ratio="1"
          />
          <div>
            <div class="weapon-header__title-row">
              <h1>{{ model.name }}</h1>
              <span>{{ model.rarity }}★</span>
              <code>{{ model.id }}</code>
            </div>
            <CatalogRichText
              v-if="model.description"
              class="weapon-header__description"
              :value="model.description"
              :resolve-image-url="resolveImageUrl"
            />
            <CatalogRichText
              v-if="model.decorativeDescription && model.decorativeDescription !== model.description"
              class="weapon-header__decorative"
              :value="model.decorativeDescription"
              :resolve-image-url="resolveImageUrl"
            />
          </div>
        </div>
      </div>
      <ImageWithFallback
        class="weapon-header__illustration"
        :src="resolveImageUrl(model.illustration)"
        :alt="model.name"
        width="360"
        height="360"
        aspect-ratio="1"
      />
    </header>

    <section v-if="model.attackRows.length" class="weapon-section" data-layout-section="base-attack">
      <div class="weapon-section__heading">
        <h2>{{ catalogUiText(locale, 'baseAttack') }}</h2>
        <button type="button" @click="attackExpanded = !attackExpanded">
          {{ catalogUiText(locale, attackExpanded ? 'collapse' : 'expandAll') }}
        </button>
      </div>
      <div class="weapon-table-wrap">
        <table>
          <thead>
            <tr>
              <th>{{ catalogUiText(locale, 'level') }}</th>
              <th>{{ catalogUiText(locale, 'attack') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in attackRows" :key="row.level">
              <th>{{ row.level }}</th>
              <td>{{ row.attack }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section v-if="model.skills.length" class="weapon-section" data-layout-section="skill-data">
      <h2>{{ catalogUiText(locale, 'skillData') }}</h2>
      <div class="weapon-list">
        <article v-for="skill in model.skills" :key="skill.id" class="weapon-item">
          <h3>{{ skill.name }}</h3>
          <div v-for="level in skill.levels" :key="level.level" class="weapon-skill-level">
            <strong>{{ catalogUiText(locale, 'level') }} {{ level.level }}</strong>
            <CatalogRichText :value="level.description" :resolve-image-url="resolveImageUrl" />
            <div v-if="level.parameters.length" class="weapon-parameters">
              <span v-for="parameter in level.parameters" :key="parameter.id">
                {{ parameter.label }}={{ parameter.value }}
              </span>
            </div>
          </div>
        </article>
      </div>
    </section>

    <section
      v-if="model.breakthroughs.length"
      class="weapon-section"
      data-layout-section="breakthrough-materials"
    >
      <h2>{{ catalogUiText(locale, 'breakthroughMaterials') }}</h2>
      <div class="weapon-grid">
        <article v-for="breakthrough in model.breakthroughs" :key="breakthrough.level" class="weapon-item">
          <h3>
            {{
              catalogUiText(locale, 'breakthroughLevel', {
                level: breakthrough.level || catalogUiText(locale, 'initial')
              })
            }}
          </h3>
          <div v-if="breakthrough.gold" class="weapon-cost">
            <strong>{{ catalogUiText(locale, 'gold') }}</strong>
            <span>{{ breakthrough.gold.toLocaleString() }}</span>
          </div>
          <div v-for="material in breakthrough.materials" :key="material.id" class="weapon-cost">
            <img :src="resolveImageUrl(material.icon)" :alt="material.name" width="28" height="28" />
            <strong>{{ material.name }}</strong>
            <span>×{{ material.count }}</span>
          </div>
          <div v-if="breakthrough.skillBounds.length" class="weapon-bounds">
            <span v-for="bound in breakthrough.skillBounds" :key="bound.skill">
              {{ catalogUiText(locale, 'skillBounds', bound) }}
            </span>
          </div>
        </article>
      </div>
    </section>

    <section v-if="model.potentials.length" class="weapon-section" data-layout-section="potentials">
      <h2>{{ catalogUiText(locale, 'potentials') }}</h2>
      <div class="weapon-grid">
        <article v-for="potential in model.potentials" :key="potential.level" class="weapon-item">
          <h3>{{ catalogUiText(locale, 'potentialLevel', { level: potential.level }) }}</h3>
          <span v-for="bound in potential.skillBounds" :key="bound.skill" class="weapon-bound">
            {{ catalogUiText(locale, 'skillUpperBound', bound) }}
          </span>
        </article>
      </div>
    </section>

    <section v-if="model.story" class="weapon-section" data-layout-section="story">
      <h2>{{ catalogUiText(locale, 'story') }}</h2>
      <CatalogRichText :value="model.story" :resolve-image-url="resolveImageUrl" />
    </section>
  </article>
</template>

<style scoped>
.weapon-detail {
  min-width: 0;
}

.weapon-header {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(180px, 30%);
  min-height: 300px;
  overflow: hidden;
  border-block-end: var(--ake-border-width) solid var(--ake-color-border);
}

.weapon-header__left {
  display: flex;
  min-width: 0;
  align-items: center;
}

.weapon-header__identity {
  display: grid;
  grid-template-columns: 112px minmax(0, 1fr);
  min-width: 0;
  align-items: start;
  gap: var(--ake-space-4);
  padding-block: var(--ake-space-5);
}

.weapon-header__title-row {
  display: flex;
  min-width: 0;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--ake-space-2);
}

.weapon-header h1 {
  margin: 0;
  font-size: var(--ake-font-size-2xl);
  letter-spacing: 0;
  overflow-wrap: anywhere;
}

.weapon-header__title-row > span {
  padding: 3px 7px;
  border: var(--ake-border-width) solid var(--ake-color-border);
  border-radius: var(--ake-radius-sm);
  background: var(--ake-color-surface-subtle);
  font-size: var(--ake-font-size-xs);
}

.weapon-header code {
  color: var(--ake-color-text-muted);
  font-size: var(--ake-font-size-xs);
  overflow-wrap: anywhere;
}

.weapon-header__description,
.weapon-header__decorative {
  display: block;
  margin-top: var(--ake-space-3);
  line-height: var(--ake-line-height-relaxed);
}

.weapon-header__decorative {
  color: var(--ake-color-text-muted);
}

.weapon-header__illustration {
  width: 100%;
  height: 100%;
  max-height: 380px;
  object-fit: contain;
}

.weapon-section {
  padding-block: var(--ake-space-5);
  border-block-end: var(--ake-border-width) solid var(--ake-color-border);
}

.weapon-section h2 {
  margin: 0 0 var(--ake-space-3);
  font-size: var(--ake-font-size-lg);
  letter-spacing: 0;
}

.weapon-section__heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--ake-space-3);
}

.weapon-section__heading button {
  min-height: 32px;
  padding: 4px 9px;
  border: var(--ake-border-width) solid var(--ake-color-border);
  border-radius: var(--ake-radius-sm);
  color: inherit;
  background: var(--ake-color-surface);
  font: inherit;
  cursor: pointer;
}

.weapon-table-wrap {
  max-width: 100%;
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
}

thead th {
  background: var(--ake-color-surface-subtle);
}

.weapon-list {
  display: grid;
  gap: var(--ake-space-3);
}

.weapon-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 260px), 1fr));
  gap: var(--ake-space-3);
}

.weapon-item {
  min-width: 0;
  padding: var(--ake-space-4);
  border: var(--ake-border-width) solid var(--ake-color-border);
  border-radius: var(--ake-radius-md);
  background: var(--ake-color-surface-raised);
}

.weapon-item h3 {
  margin: 0 0 var(--ake-space-2);
  font-size: var(--ake-font-size-md);
  letter-spacing: 0;
}

.weapon-skill-level {
  display: grid;
  grid-template-columns: 5rem minmax(0, 1fr);
  gap: var(--ake-space-3);
  padding-block: var(--ake-space-3);
  border-block-start: var(--ake-border-width) solid var(--ake-color-border);
}

.weapon-parameters {
  grid-column: 2;
  display: flex;
  flex-wrap: wrap;
  gap: var(--ake-space-2);
}

.weapon-parameters span,
.weapon-bound,
.weapon-bounds span {
  padding: 2px 6px;
  border-radius: var(--ake-radius-sm);
  background: var(--ake-color-surface-subtle);
  font-family: var(--ake-font-family-mono);
  font-size: var(--ake-font-size-xs);
}

.weapon-cost {
  display: grid;
  grid-template-columns: 28px minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--ake-space-2);
  padding-block: var(--ake-space-2);
}

.weapon-cost:first-of-type {
  grid-template-columns: minmax(0, 1fr) auto;
}

.weapon-bounds {
  display: flex;
  flex-wrap: wrap;
  gap: var(--ake-space-2);
  margin-top: var(--ake-space-3);
}

@media (max-width: 52rem) {
  .weapon-header {
    grid-template-columns: minmax(0, 1fr);
  }

  .weapon-header__illustration {
    max-height: 20rem;
  }
}

@media (max-width: 34rem) {
  .weapon-header__identity {
    grid-template-columns: 76px minmax(0, 1fr);
  }

  .weapon-header__icon {
    width: 76px;
    height: 76px;
  }

  .weapon-skill-level {
    grid-template-columns: minmax(0, 1fr);
  }

  .weapon-parameters {
    grid-column: 1;
  }
}
</style>
