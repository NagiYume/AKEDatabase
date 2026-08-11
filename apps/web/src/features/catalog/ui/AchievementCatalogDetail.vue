<script setup lang="ts">
import { computed } from 'vue'
import { ImageWithFallback } from '@ake/ui'
import type { AchievementDetailModel } from '@ake/domain'
import CatalogRichText from './CatalogRichText.vue'
import { catalogUiText } from './copy'

const props = defineProps<{
  model: AchievementDetailModel
  locale: string
  resolveImageUrl: (path: string) => string
}>()

const showSingleGroupHeading = computed(
  () => props.model.groups.length !== 1 || props.model.groups[0]?.name !== 'default'
)
</script>

<template>
  <article class="achievement-detail">
    <header class="achievement-header" data-layout-section="achievement-header">
      <h1>{{ model.name }}</h1>
    </header>

    <section v-if="model.groups.length" class="achievement-section" data-layout-section="achievement-groups">
      <div v-for="group in model.groups" :key="group.id" class="achievement-group">
        <h2 v-if="showSingleGroupHeading">
          {{ group.name === 'default' ? catalogUiText(locale, 'defaultGroup') : group.name }}
        </h2>
        <div class="achievement-list">
          <article
            v-for="achievement in group.achievements"
            :key="achievement.id"
            class="achievement-card"
            :class="{ 'is-added': achievement.added }"
            :data-ake-change="achievement.added ? 'added' : undefined"
          >
            <header>
              <h3>{{ achievement.name }}</h3>
              <div class="achievement-badges">
                <span v-if="achievement.added" data-detail-region="version-added-badge">
                  {{ catalogUiText(locale, 'added') }}
                </span>
                <span v-if="achievement.upgradable">{{ catalogUiText(locale, 'upgradable') }}</span>
                <span v-if="achievement.platable">{{ catalogUiText(locale, 'platable') }}</span>
                <span v-if="achievement.rareEffect">{{ catalogUiText(locale, 'rareEffect') }}</span>
                <span v-if="achievement.hiddenUntilObtained">{{
                  catalogUiText(locale, 'hiddenUntilObtained')
                }}</span>
              </div>
            </header>
            <div class="achievement-levels">
              <article v-for="level in achievement.levels" :key="level.level" class="achievement-level">
                <ImageWithFallback
                  :src="resolveImageUrl(level.icon)"
                  :alt="`${achievement.name} ${catalogUiText(locale, 'achievementLevel', { level: level.level })}`"
                  width="76"
                  height="76"
                  aspect-ratio="1"
                />
                <div>
                  <CatalogRichText :value="level.description" :resolve-image-url="resolveImageUrl" />
                  <div v-if="level.conditions.length" class="achievement-conditions">
                    <div v-for="condition in level.conditions" :key="condition.id">
                      <CatalogRichText :value="condition.description" :resolve-image-url="resolveImageUrl" />
                      <span v-if="condition.progress !== ''">
                        {{ catalogUiText(locale, 'progress', { value: condition.progress }) }}
                      </span>
                    </div>
                  </div>
                </div>
              </article>
            </div>
          </article>
        </div>
      </div>
    </section>
  </article>
</template>

<style scoped>
.achievement-detail {
  min-width: 0;
}
.achievement-header {
  padding-block: var(--ake-space-5);
  border-block-end: var(--ake-border-width) solid var(--ake-color-border);
}
.achievement-header h1 {
  margin: 0;
  font-size: var(--ake-font-size-2xl);
  letter-spacing: 0;
  overflow-wrap: anywhere;
}
.achievement-section {
  padding-block: var(--ake-space-5);
  border-block-end: var(--ake-border-width) solid var(--ake-color-border);
}
.achievement-group + .achievement-group {
  margin-top: var(--ake-space-6);
}
.achievement-group > h2 {
  margin: 0 0 var(--ake-space-3);
  font-size: var(--ake-font-size-lg);
  letter-spacing: 0;
}
.achievement-list {
  display: grid;
  gap: var(--ake-space-3);
}
.achievement-card {
  min-width: 0;
  padding: var(--ake-space-4);
  border: var(--ake-border-width) solid var(--ake-color-border);
  border-radius: var(--ake-radius-md);
  background: var(--ake-color-surface-raised);
}
.achievement-card.is-added {
  border-color: var(--ake-color-accent);
}
.achievement-card > header {
  display: flex;
  min-width: 0;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: var(--ake-space-2);
  padding-bottom: var(--ake-space-3);
  border-block-end: var(--ake-border-width) solid var(--ake-color-border);
}
.achievement-card h3 {
  margin: 0;
  font-size: var(--ake-font-size-md);
  letter-spacing: 0;
  overflow-wrap: anywhere;
}
.achievement-badges {
  display: flex;
  flex-wrap: wrap;
  gap: var(--ake-space-1);
}
.achievement-badges span {
  padding: 2px 6px;
  border: var(--ake-border-width) solid var(--ake-color-border);
  border-radius: var(--ake-radius-sm);
  color: var(--ake-color-text-muted);
  background: var(--ake-color-surface-subtle);
  font-size: var(--ake-font-size-xs);
}
.achievement-levels {
  display: grid;
  gap: var(--ake-space-3);
  padding-top: var(--ake-space-3);
}
.achievement-level {
  display: grid;
  grid-template-columns: 76px minmax(0, 1fr);
  min-width: 0;
  gap: var(--ake-space-3);
  align-items: start;
}
.achievement-conditions {
  display: grid;
  gap: var(--ake-space-2);
  margin-top: var(--ake-space-2);
}
.achievement-conditions > div {
  padding: var(--ake-space-2) var(--ake-space-3);
  border-inline-start: 3px solid var(--ake-color-accent);
  background: var(--ake-color-surface-subtle);
}
.achievement-conditions span {
  color: var(--ake-color-text-muted);
  font-size: var(--ake-font-size-xs);
}
@media (max-width: 34rem) {
  .achievement-level {
    grid-template-columns: 56px minmax(0, 1fr);
  }
  .achievement-level :deep(.ake-image) {
    width: 56px;
    height: 56px;
  }
}
</style>
