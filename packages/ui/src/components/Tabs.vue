<script setup lang="ts">
import { TabsContent, TabsList, TabsRoot, TabsTrigger } from 'reka-ui'
import { watchEffect } from 'vue'
import type { TabItem } from '../types'

const props = withDefaults(
  defineProps<{
    items: readonly TabItem[]
    ariaLabel: string
    orientation?: 'horizontal' | 'vertical'
    activationMode?: 'automatic' | 'manual'
  }>(),
  {
    orientation: 'horizontal',
    activationMode: 'automatic'
  }
)

const modelValue = defineModel<string | undefined>({ default: undefined })

watchEffect(() => {
  if (!modelValue.value) modelValue.value = props.items.find((item) => !item.disabled)?.value
})
</script>

<template>
  <TabsRoot
    v-model="modelValue"
    class="ake-ui ake-tabs"
    :orientation="orientation"
    :activation-mode="activationMode"
  >
    <TabsList class="ake-tabs__list" :aria-label="ariaLabel">
      <TabsTrigger
        v-for="item in items"
        :key="item.value"
        class="ake-tabs__trigger"
        :value="item.value"
        :disabled="item.disabled"
      >
        <slot name="tab" :item="item">{{ item.label }}</slot>
      </TabsTrigger>
    </TabsList>
    <TabsContent v-for="item in items" :key="item.value" class="ake-tabs__content" :value="item.value">
      <slot :name="`panel-${item.value}`" :item="item">
        <slot name="panel" :item="item" />
      </slot>
    </TabsContent>
  </TabsRoot>
</template>

<style scoped>
.ake-tabs {
  display: flex;
  min-width: 0;
  flex-direction: column;
}

.ake-tabs[data-orientation='vertical'] {
  display: grid;
  grid-template-columns: minmax(9rem, auto) minmax(0, 1fr);
  align-items: start;
  gap: var(--ake-space-4);
}

.ake-tabs__list {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: var(--ake-space-1);
  overflow-x: auto;
  border-block-end: var(--ake-border-width) solid var(--ake-color-border);
  scrollbar-width: thin;
}

.ake-tabs[data-orientation='vertical'] .ake-tabs__list {
  align-items: stretch;
  flex-direction: column;
  overflow-x: visible;
  border-block-end: 0;
  border-inline-end: var(--ake-border-width) solid var(--ake-color-border);
}

.ake-tabs__trigger {
  position: relative;
  display: inline-flex;
  min-width: 0;
  min-height: var(--ake-control-height);
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  padding-inline: var(--ake-space-3);
  border: 0;
  border-radius: var(--ake-radius-sm) var(--ake-radius-sm) 0 0;
  color: var(--ake-color-text-muted);
  background: transparent;
  cursor: pointer;
  white-space: nowrap;
}

.ake-tabs__trigger::after {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  height: 2px;
  background: transparent;
  content: '';
}

.ake-tabs__trigger:hover:not([data-disabled]) {
  color: var(--ake-color-text);
  background: var(--ake-color-surface-hover);
}

.ake-tabs__trigger[data-state='active'] {
  color: var(--ake-color-accent);
  font-weight: 700;
}

.ake-tabs__trigger[data-state='active']::after {
  background: var(--ake-color-accent);
}

.ake-tabs__trigger[data-disabled] {
  cursor: not-allowed;
  opacity: 0.45;
}

.ake-tabs[data-orientation='vertical'] .ake-tabs__trigger {
  justify-content: flex-start;
  border-radius: var(--ake-radius-sm) 0 0 var(--ake-radius-sm);
  white-space: normal;
}

.ake-tabs[data-orientation='vertical'] .ake-tabs__trigger::after {
  top: 0;
  right: 0;
  bottom: 0;
  left: auto;
  width: 2px;
  height: auto;
}

.ake-tabs__content {
  min-width: 0;
  padding-block-start: var(--ake-space-4);
}

.ake-tabs__content:focus-visible {
  outline: 2px solid var(--ake-color-focus);
  outline-offset: 2px;
}

@media (max-width: 38rem) {
  .ake-tabs[data-orientation='vertical'] {
    display: flex;
  }

  .ake-tabs[data-orientation='vertical'] .ake-tabs__list {
    align-items: center;
    flex-direction: row;
    overflow-x: auto;
    border-inline-end: 0;
    border-block-end: var(--ake-border-width) solid var(--ake-color-border);
  }

  .ake-tabs[data-orientation='vertical'] .ake-tabs__trigger {
    justify-content: center;
    border-radius: var(--ake-radius-sm) var(--ake-radius-sm) 0 0;
    white-space: nowrap;
  }

  .ake-tabs[data-orientation='vertical'] .ake-tabs__trigger::after {
    top: auto;
    right: 0;
    bottom: 0;
    left: 0;
    width: auto;
    height: 2px;
  }
}
</style>
