<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { ArrowRight } from '@lucide/vue'
import { APP_MODULES } from '../app/modules'
import { usePreferencesStore } from '../app/stores/preferences'

const { t } = useI18n()
const preferences = usePreferencesStore()
const visible = computed(() =>
  APP_MODULES.filter((module) => module.id !== 'settings' && (preferences.showHidden || !module.hidden))
)
const hiddenCount = computed(() => APP_MODULES.filter((module) => module.hidden).length)
</script>

<template>
  <section class="overview-page">
    <header class="page-heading">
      <div>
        <h1>{{ t('home.title') }}</h1>
        <p>{{ t('home.description') }}</p>
      </div>
      <span v-if="!preferences.showHidden" class="quiet-status">{{
        t('home.hiddenCount', { count: hiddenCount })
      }}</span>
    </header>
    <div class="module-grid">
      <RouterLink
        v-for="module in visible"
        :key="module.id"
        class="module-tile"
        :to="{ name: 'module', params: { moduleId: module.id } }"
      >
        <div>
          <h2>{{ t(module.titleKey) }}</h2>
          <p>{{ t(module.descriptionKey) }}</p>
        </div>
        <ArrowRight :size="18" aria-hidden="true" />
      </RouterLink>
    </div>
  </section>
</template>
