<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { ModuleShell } from '@ake/ui'

const { t } = useI18n()
</script>

<template>
  <ModuleShell>
    <div class="hidden-legacy-layout">
      <span>{{ t('modules.hidden.testTitle') }}</span>
    </div>
  </ModuleShell>
</template>

<style scoped>
.hidden-legacy-layout {
  display: flex;
  min-height: 300px;
  align-items: center;
  justify-content: center;
  text-align: center;
}

.hidden-legacy-layout span {
  font-size: 4rem;
  font-weight: 300;
  line-height: 1.1;
}

@media (max-width: 40rem) {
  .hidden-legacy-layout span {
    max-width: 100%;
    font-size: 2.5rem;
    overflow-wrap: anywhere;
  }
}
</style>
