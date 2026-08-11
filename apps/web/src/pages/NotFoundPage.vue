<script setup lang="ts">
import { RouterLink } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { CircleHelp } from '@lucide/vue'

defineProps<{ hidden?: boolean }>()
const { t } = useI18n()
</script>

<template>
  <section class="state-page" role="status">
    <CircleHelp :size="40" aria-hidden="true" />
    <h1>{{ t('errors.notFoundTitle') }}</h1>
    <p>{{ hidden ? t('errors.hiddenModule') : t('errors.notFoundDesc') }}</p>
    <RouterLink class="command-button" :to="{ name: 'home' }">{{ t('errors.returnHome') }}</RouterLink>
  </section>
</template>
