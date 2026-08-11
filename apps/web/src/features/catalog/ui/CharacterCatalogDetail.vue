<script setup lang="ts">
import { computed, ref } from 'vue'
import { ChevronDown, ChevronRight } from '@lucide/vue'
import { ImageWithFallback } from '@ake/ui'
import type { CharacterDetailModel, CharacterSkillModel } from '@ake/domain'
import CatalogRichText from './CatalogRichText.vue'
import { catalogUiText } from './copy'

const props = defineProps<{
  model: CharacterDetailModel
  locale: string
  preferredLevels: readonly number[]
  preferredSkillLevels: readonly number[]
  resolveImageUrl: (path: string) => string
}>()

const growthExpanded = ref(false)
const allSkillsExpanded = ref(false)
const expandedSkills = ref(new Set<string>())

const growthRows = computed(() => {
  const rows = props.model.growth?.rows ?? []
  if (growthExpanded.value || !props.preferredLevels.length) return rows
  const levels = new Set(props.preferredLevels)
  const filtered = rows.filter((row) => levels.has(row.level))
  return filtered.length ? filtered : rows.slice(-1)
})

function skillType(groupType: number): string {
  return catalogUiText(
    props.locale,
    groupType === 0
      ? 'basicAttack'
      : groupType === 1
        ? 'combatSkill'
        : groupType === 3
          ? 'comboSkill'
          : 'ultimate'
  )
}

function skillExpanded(skill: CharacterSkillModel): boolean {
  return allSkillsExpanded.value || expandedSkills.value.has(skill.id)
}

function visibleSkillLevels(skill: CharacterSkillModel) {
  if (skillExpanded(skill) || !props.preferredSkillLevels.length) return skill.levels
  const levels = new Set(props.preferredSkillLevels)
  const filtered = skill.levels.filter((level) => levels.has(level.level))
  return filtered.length ? filtered : skill.levels.slice(-1)
}

function toggleSkill(skill: CharacterSkillModel): void {
  const next = new Set(expandedSkills.value)
  if (next.has(skill.id)) next.delete(skill.id)
  else next.add(skill.id)
  expandedSkills.value = next
}

function formatValue(value: number): string {
  return Number.isInteger(value) ? value.toLocaleString() : String(Math.round(value * 1000) / 1000)
}
</script>

<template>
  <article class="legacy-detail character-detail">
    <header class="legacy-header" data-layout-section="character-header">
      <div class="legacy-header__identity">
        <ImageWithFallback
          class="legacy-header__icon"
          :src="resolveImageUrl(model.icon)"
          :alt="model.name"
          width="112"
          height="112"
          aspect-ratio="1"
        />
        <div class="legacy-header__copy">
          <div class="legacy-header__title-row">
            <h1>{{ model.name }}</h1>
            <span class="legacy-rarity">{{ model.rarity }}★</span>
            <code>{{ model.id }}</code>
          </div>
          <div v-if="model.tags.length" class="legacy-tags">
            <span v-for="tag in model.tags" :key="tag">{{ tag }}</span>
          </div>
          <dl class="legacy-meta">
            <div v-for="item in model.meta" :key="item.id">
              <dt>{{ catalogUiText(locale, item.id) }}</dt>
              <dd>{{ item.value }}</dd>
            </div>
          </dl>
          <CatalogRichText
            v-if="model.profile"
            class="legacy-header__profile"
            :value="model.profile"
            :resolve-image-url="resolveImageUrl"
          />
          <CatalogRichText
            v-if="model.feature"
            class="legacy-header__feature"
            :value="model.feature"
            :resolve-image-url="resolveImageUrl"
          />
        </div>
      </div>
      <ImageWithFallback
        class="legacy-header__portrait"
        :src="resolveImageUrl(model.portrait)"
        :alt="model.name"
        width="320"
        height="360"
        aspect-ratio="8/9"
      />
    </header>

    <section v-if="model.growth?.rows.length" class="legacy-section" data-layout-section="attribute-growth">
      <div class="legacy-section__heading">
        <h2>{{ catalogUiText(locale, 'attributeGrowth') }}</h2>
        <button type="button" class="legacy-action" @click="growthExpanded = !growthExpanded">
          {{ catalogUiText(locale, growthExpanded ? 'collapse' : 'expandAll') }}
        </button>
      </div>
      <div class="legacy-table-wrap">
        <table>
          <thead>
            <tr>
              <th>{{ catalogUiText(locale, 'level') }}</th>
              <th v-for="column in model.growth.columns" :key="column.id">{{ column.label }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in growthRows" :key="row.level">
              <th>{{ row.level }}</th>
              <td v-for="column in model.growth.columns" :key="column.id">
                {{ formatValue(row.values[column.id] ?? 0) }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section v-if="model.talents.length" class="legacy-section" data-layout-section="talents">
      <h2>{{ catalogUiText(locale, 'talents') }}</h2>
      <div class="legacy-list">
        <article v-for="talent in model.talents" :key="talent.id" class="legacy-item">
          <h3>{{ talent.name }}</h3>
          <CatalogRichText :value="talent.description" :resolve-image-url="resolveImageUrl" />
          <div v-if="talent.costs.length" class="legacy-costs">
            <span>{{ catalogUiText(locale, 'developmentCost') }}</span>
            <span v-for="cost in talent.costs" :key="cost.id">
              <img :src="resolveImageUrl(cost.icon)" :alt="cost.name" width="24" height="24" />
              {{ cost.name }} ×{{ cost.count }}
            </span>
          </div>
        </article>
      </div>
    </section>

    <section v-if="model.potentials.length" class="legacy-section" data-layout-section="potentials">
      <h2>{{ catalogUiText(locale, 'potentials') }}</h2>
      <div class="legacy-list">
        <article v-for="potential in model.potentials" :key="potential.id" class="legacy-item">
          <h3>{{ potential.name }}</h3>
          <CatalogRichText :value="potential.description" :resolve-image-url="resolveImageUrl" />
          <div v-if="potential.costs.length" class="legacy-costs">
            <span>{{ catalogUiText(locale, 'developmentCost') }}</span>
            <span v-for="cost in potential.costs" :key="cost.id">
              <img :src="resolveImageUrl(cost.icon)" :alt="cost.name" width="24" height="24" />
              {{ cost.name }} ×{{ cost.count }}
            </span>
          </div>
        </article>
      </div>
    </section>

    <section v-if="model.attributeNodes.length" class="legacy-section" data-layout-section="attribute-nodes">
      <h2>{{ catalogUiText(locale, 'attributeNodes') }}</h2>
      <div class="legacy-grid">
        <article v-for="node in model.attributeNodes" :key="node.id" class="legacy-item">
          <h3>{{ node.name }}</h3>
          <CatalogRichText :value="node.description" :resolve-image-url="resolveImageUrl" />
          <div class="legacy-chips">
            <span v-for="modifier in node.modifiers" :key="modifier.id">
              {{ modifier.label }} +{{ modifier.value }}
            </span>
          </div>
          <div v-if="node.costs.length" class="legacy-costs">
            <span>{{ catalogUiText(locale, 'developmentCost') }}</span>
            <span v-for="cost in node.costs" :key="cost.id">
              <img :src="resolveImageUrl(cost.icon)" :alt="cost.name" width="24" height="24" />
              {{ cost.name }} ×{{ cost.count }}
            </span>
          </div>
        </article>
      </div>
    </section>

    <section v-if="model.skills.length" class="legacy-section" data-layout-section="skills">
      <div class="legacy-section__heading">
        <h2>{{ catalogUiText(locale, 'skills') }}</h2>
        <button type="button" class="legacy-action" @click="allSkillsExpanded = !allSkillsExpanded">
          {{ catalogUiText(locale, allSkillsExpanded ? 'collapse' : 'expandAll') }}
        </button>
      </div>
      <div class="legacy-list">
        <article v-for="skill in model.skills" :key="skill.id" class="legacy-item legacy-skill">
          <header>
            <ImageWithFallback
              v-if="skill.icon"
              :src="resolveImageUrl(skill.icon)"
              :alt="skill.name"
              width="48"
              height="48"
              aspect-ratio="1"
            />
            <div>
              <small>{{ skillType(skill.groupType) }}</small>
              <h3>{{ skill.name }}</h3>
            </div>
            <button
              v-if="skill.levels.length > preferredSkillLevels.length"
              type="button"
              class="legacy-icon-action"
              :aria-label="catalogUiText(locale, skillExpanded(skill) ? 'collapse' : 'expand')"
              @click="toggleSkill(skill)"
            >
              <ChevronDown v-if="skillExpanded(skill)" :size="18" aria-hidden="true" />
              <ChevronRight v-else :size="18" aria-hidden="true" />
            </button>
          </header>
          <CatalogRichText
            v-if="skill.description"
            :value="skill.description"
            :resolve-image-url="resolveImageUrl"
          />
          <div v-if="skill.conditions.length" class="legacy-conditions">
            <article v-for="condition in skill.conditions" :key="condition.id">
              <strong>{{ condition.name }}</strong>
              <CatalogRichText :value="condition.description" :resolve-image-url="resolveImageUrl" />
            </article>
          </div>
          <div v-if="skill.levels.length" class="legacy-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{{ catalogUiText(locale, 'level') }}</th>
                  <th>{{ catalogUiText(locale, 'description') }}</th>
                  <th>{{ catalogUiText(locale, 'cooldown') }}</th>
                  <th>{{ catalogUiText(locale, 'skillCost') }}</th>
                  <th>{{ catalogUiText(locale, 'parameters') }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="level in visibleSkillLevels(skill)" :key="level.level">
                  <th>{{ level.level }}</th>
                  <td>
                    <CatalogRichText :value="level.description" :resolve-image-url="resolveImageUrl" />
                    <div
                      v-for="description in level.subDescriptions"
                      :key="description"
                      class="legacy-subdesc"
                    >
                      <CatalogRichText :value="description" :resolve-image-url="resolveImageUrl" />
                    </div>
                  </td>
                  <td>{{ level.cooldown ?? '—' }}</td>
                  <td>{{ level.cost ?? '—' }}</td>
                  <td>
                    <span v-for="parameter in level.parameters" :key="parameter.id" class="legacy-parameter">
                      {{ parameter.label }}={{ parameter.value }}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div v-if="skill.costs.length" class="legacy-skill-costs">
            <div v-for="costLevel in skill.costs" :key="costLevel.level">
              <strong>
                {{ catalogUiText(locale, 'level') }} {{ costLevel.level - 1 }}→{{ costLevel.level }}
              </strong>
              <span v-for="cost in costLevel.items" :key="cost.id">
                <img :src="resolveImageUrl(cost.icon)" :alt="cost.name" width="24" height="24" />
                {{ cost.name }} ×{{ cost.count }}
              </span>
            </div>
          </div>
        </article>
      </div>
    </section>

    <section v-if="model.logistics.length" class="legacy-section" data-layout-section="logistics">
      <h2>{{ catalogUiText(locale, 'logisticsSkills') }}</h2>
      <div class="legacy-list">
        <article v-for="skill in model.logistics" :key="skill.id" class="legacy-item logistics-item">
          <header>
            <ImageWithFallback
              v-if="skill.icon"
              :src="resolveImageUrl(skill.icon)"
              :alt="skill.name"
              width="44"
              height="44"
              aspect-ratio="1"
            />
            <h3>{{ skill.name }}</h3>
            <span>{{ skill.room }}</span>
          </header>
          <div v-for="level in skill.levels" :key="`${level.name}-${level.postfix}`" class="logistics-level">
            <strong>{{ level.name }} {{ level.postfix }}</strong>
            <CatalogRichText :value="level.description" :resolve-image-url="resolveImageUrl" />
            <small>{{ level.unlockHint }}</small>
          </div>
        </article>
      </div>
    </section>

    <details
      v-if="model.potentialImages.length"
      class="legacy-disclosure"
      data-layout-section="potential-images"
    >
      <summary>{{ catalogUiText(locale, 'potentialImages') }}</summary>
      <div class="potential-images">
        <ImageWithFallback
          v-for="image in model.potentialImages"
          :key="image"
          :src="resolveImageUrl(image)"
          alt=""
          width="280"
          height="360"
          aspect-ratio="7/9"
        />
      </div>
    </details>

    <details v-if="model.profileRecords.length" class="legacy-disclosure" data-layout-section="profile">
      <summary>{{ catalogUiText(locale, 'profile') }}</summary>
      <article v-for="record in model.profileRecords" :key="record.title" class="profile-record">
        <h3>{{ record.title }}</h3>
        <CatalogRichText :value="record.description" :resolve-image-url="resolveImageUrl" />
      </article>
    </details>

    <details v-if="model.voiceRecords.length" class="legacy-disclosure" data-layout-section="voice">
      <summary>{{ catalogUiText(locale, 'voiceRecords') }}</summary>
      <div class="legacy-table-wrap">
        <table>
          <tbody>
            <tr v-for="record in model.voiceRecords" :key="record.title">
              <th>{{ record.title }}</th>
              <td>{{ record.description }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </details>
  </article>
</template>

<style scoped>
.legacy-detail {
  min-width: 0;
}

.legacy-header {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(180px, 30%);
  min-height: 300px;
  overflow: hidden;
  border-block-end: var(--ake-border-width) solid var(--ake-color-border);
}

.legacy-header__identity {
  display: grid;
  grid-template-columns: 112px minmax(0, 1fr);
  align-items: start;
  gap: var(--ake-space-4);
  padding: var(--ake-space-5) 0;
}

.legacy-header__icon {
  object-fit: contain;
}

.legacy-header__copy {
  min-width: 0;
}

.legacy-header__title-row {
  display: flex;
  min-width: 0;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--ake-space-2);
}

.legacy-header h1 {
  margin: 0;
  font-size: var(--ake-font-size-2xl);
  letter-spacing: 0;
  overflow-wrap: anywhere;
}

.legacy-rarity,
.legacy-tags span,
.legacy-chips span {
  padding: 3px 7px;
  border: var(--ake-border-width) solid var(--ake-color-border);
  border-radius: var(--ake-radius-sm);
  background: var(--ake-color-surface-subtle);
  font-size: var(--ake-font-size-xs);
}

.legacy-header code {
  color: var(--ake-color-text-muted);
  font-size: var(--ake-font-size-xs);
  overflow-wrap: anywhere;
}

.legacy-tags,
.legacy-chips {
  display: flex;
  flex-wrap: wrap;
  gap: var(--ake-space-1);
  margin-top: var(--ake-space-3);
}

.legacy-meta {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: var(--ake-space-2);
  margin: var(--ake-space-4) 0;
}

.legacy-meta div {
  min-width: 0;
}

.legacy-meta dt {
  color: var(--ake-color-text-muted);
  font-size: var(--ake-font-size-xs);
}

.legacy-meta dd {
  margin: 2px 0 0;
  overflow-wrap: anywhere;
}

.legacy-header__profile,
.legacy-header__feature {
  display: block;
  margin-top: var(--ake-space-3);
  color: var(--ake-color-text-muted);
  line-height: var(--ake-line-height-relaxed);
}

.legacy-header__portrait {
  width: 100%;
  height: 100%;
  max-height: 390px;
  object-fit: contain;
  object-position: center bottom;
}

.legacy-section,
.legacy-disclosure {
  padding-block: var(--ake-space-5);
  border-block-end: var(--ake-border-width) solid var(--ake-color-border);
}

.legacy-section h2,
.legacy-disclosure summary {
  margin: 0 0 var(--ake-space-3);
  font-size: var(--ake-font-size-lg);
  font-weight: 700;
  letter-spacing: 0;
}

.legacy-section__heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--ake-space-3);
}

.legacy-action,
.legacy-icon-action {
  min-height: 32px;
  padding: 4px 9px;
  border: var(--ake-border-width) solid var(--ake-color-border);
  border-radius: var(--ake-radius-sm);
  color: inherit;
  background: var(--ake-color-surface);
  font: inherit;
  cursor: pointer;
}

.legacy-icon-action {
  display: grid;
  width: 32px;
  padding: 0;
  place-items: center;
}

.legacy-table-wrap {
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
  vertical-align: top;
}

thead th {
  background: var(--ake-color-surface-subtle);
  white-space: nowrap;
}

.legacy-list {
  display: grid;
  gap: var(--ake-space-3);
}

.legacy-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 260px), 1fr));
  gap: var(--ake-space-3);
}

.legacy-item {
  min-width: 0;
  padding: var(--ake-space-4);
  border: var(--ake-border-width) solid var(--ake-color-border);
  border-radius: var(--ake-radius-md);
  background: var(--ake-color-surface-raised);
}

.legacy-item h3 {
  margin: 0 0 var(--ake-space-2);
  font-size: var(--ake-font-size-md);
  letter-spacing: 0;
}

.legacy-costs,
.legacy-skill-costs > div {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--ake-space-2);
  margin-top: var(--ake-space-3);
  color: var(--ake-color-text-muted);
  font-size: var(--ake-font-size-xs);
}

.legacy-costs > span,
.legacy-skill-costs span {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.legacy-skill > header,
.logistics-item > header {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: var(--ake-space-3);
  margin-bottom: var(--ake-space-3);
}

.legacy-skill > header > div {
  min-width: 0;
  flex: 1;
}

.legacy-skill > header h3,
.logistics-item > header h3 {
  margin: 0;
}

.legacy-skill > header small,
.logistics-item > header span,
.logistics-level small {
  color: var(--ake-color-text-muted);
}

.legacy-conditions {
  display: grid;
  gap: var(--ake-space-2);
  margin-block: var(--ake-space-3);
}

.legacy-conditions article,
.logistics-level {
  padding: var(--ake-space-3);
  border-inline-start: 3px solid var(--ake-color-accent);
  background: var(--ake-color-surface-subtle);
}

.legacy-subdesc {
  margin-top: var(--ake-space-2);
  color: var(--ake-color-text-muted);
}

.legacy-parameter {
  display: block;
  font-family: var(--ake-font-family-mono);
  font-size: var(--ake-font-size-xs);
  white-space: nowrap;
}

.logistics-level + .logistics-level {
  margin-top: var(--ake-space-2);
}

.logistics-level > * {
  display: block;
}

.legacy-disclosure summary {
  cursor: pointer;
}

.potential-images {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 220px), 1fr));
  gap: var(--ake-space-3);
}

.potential-images :deep(img) {
  width: 100%;
  max-height: 32rem;
  object-fit: contain;
}

.profile-record + .profile-record {
  margin-top: var(--ake-space-4);
}

.profile-record h3 {
  margin: 0 0 var(--ake-space-2);
  font-size: var(--ake-font-size-md);
  letter-spacing: 0;
}

@media (max-width: 52rem) {
  .legacy-header {
    grid-template-columns: minmax(0, 1fr);
  }

  .legacy-header__portrait {
    max-height: 20rem;
  }
}

@media (max-width: 34rem) {
  .legacy-header__identity {
    grid-template-columns: 76px minmax(0, 1fr);
  }

  .legacy-header__icon {
    width: 76px;
    height: 76px;
  }
}
</style>
