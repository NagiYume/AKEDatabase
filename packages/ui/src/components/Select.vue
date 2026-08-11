<script setup lang="ts">
import { Check, ChevronDown, ChevronUp } from '@lucide/vue'
import {
  SelectContent,
  SelectIcon,
  SelectItem,
  SelectItemIndicator,
  SelectItemText,
  SelectPortal,
  SelectRoot,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectTrigger,
  SelectValue,
  SelectViewport
} from 'reka-ui'
import { computed } from 'vue'
import type { SelectOption } from '../types'

const props = withDefaults(
  defineProps<{
    options: readonly SelectOption[]
    ariaLabel: string
    placeholder?: string
    disabled?: boolean
    required?: boolean
    name?: string
  }>(),
  {
    disabled: false,
    required: false
  }
)

const modelValue = defineModel<string | undefined>({ default: undefined })
const selectedLabel = computed(() => props.options.find((option) => option.value === modelValue.value)?.label)
</script>

<template>
  <SelectRoot v-model="modelValue" :disabled="disabled" :required="required" :name="name">
    <SelectTrigger class="ake-ui ake-select__trigger" :aria-label="ariaLabel">
      <SelectValue :placeholder="placeholder">
        <span v-if="selectedLabel" class="ake-select__value">{{ selectedLabel }}</span>
      </SelectValue>
      <SelectIcon class="ake-select__icon">
        <ChevronDown :size="17" aria-hidden="true" />
      </SelectIcon>
    </SelectTrigger>
    <SelectPortal>
      <SelectContent class="ake-ui ake-select__content" position="popper" :side-offset="4">
        <SelectScrollUpButton class="ake-select__scroll">
          <ChevronUp :size="16" aria-hidden="true" />
        </SelectScrollUpButton>
        <SelectViewport class="ake-select__viewport">
          <SelectItem
            v-for="option in options"
            :key="option.value"
            class="ake-select__item"
            :value="option.value"
            :disabled="option.disabled"
          >
            <SelectItemText class="ake-select__item-text">{{ option.label }}</SelectItemText>
            <SelectItemIndicator class="ake-select__indicator">
              <Check :size="16" aria-hidden="true" />
            </SelectItemIndicator>
          </SelectItem>
        </SelectViewport>
        <SelectScrollDownButton class="ake-select__scroll">
          <ChevronDown :size="16" aria-hidden="true" />
        </SelectScrollDownButton>
      </SelectContent>
    </SelectPortal>
  </SelectRoot>
</template>

<style scoped>
.ake-select__trigger {
  display: inline-flex;
  width: 100%;
  min-width: 8rem;
  max-width: 100%;
  height: var(--ake-control-height);
  align-items: center;
  justify-content: space-between;
  gap: var(--ake-space-2);
  padding-inline: var(--ake-space-3);
  border: var(--ake-border-width) solid var(--ake-color-border);
  border-radius: var(--ake-radius-md);
  color: var(--ake-color-text);
  background: var(--ake-color-surface);
  cursor: pointer;
}

.ake-select__trigger:hover:not([data-disabled]) {
  border-color: var(--ake-color-border-strong);
  background: var(--ake-color-surface-hover);
}

.ake-select__trigger[data-disabled] {
  cursor: not-allowed;
  opacity: 0.58;
}

.ake-select__trigger[data-placeholder] {
  color: var(--ake-color-text-muted);
}

.ake-select__value {
  display: block;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ake-select__icon {
  flex: 0 0 auto;
  color: var(--ake-color-text-muted);
}

.ake-select__content {
  z-index: var(--ake-z-popover);
  width: var(--reka-select-trigger-width);
  max-height: min(var(--reka-select-content-available-height), 22rem);
  overflow: hidden;
  border: var(--ake-border-width) solid var(--ake-color-border-strong);
  border-radius: var(--ake-radius-md);
  background: var(--ake-color-surface-raised);
  box-shadow: var(--ake-shadow-popover);
}

.ake-select__viewport {
  padding: var(--ake-space-1);
}

.ake-select__item {
  position: relative;
  display: flex;
  min-width: 0;
  min-height: var(--ake-control-height-sm);
  align-items: center;
  padding: var(--ake-space-1) calc(var(--ake-space-6) + var(--ake-space-2)) var(--ake-space-1)
    var(--ake-space-2);
  border-radius: var(--ake-radius-sm);
  color: var(--ake-color-text);
  cursor: pointer;
  user-select: none;
}

.ake-select__item[data-highlighted] {
  outline: none;
  background: var(--ake-color-surface-hover);
}

.ake-select__item[data-state='checked'] {
  color: var(--ake-color-accent);
  background: var(--ake-color-accent-soft);
}

.ake-select__item[data-disabled] {
  cursor: not-allowed;
  opacity: 0.48;
}

.ake-select__item-text {
  min-width: 0;
  overflow-wrap: anywhere;
}

.ake-select__indicator {
  position: absolute;
  inset-inline-end: var(--ake-space-2);
}

.ake-select__scroll {
  display: grid;
  height: var(--ake-control-height-sm);
  place-items: center;
  color: var(--ake-color-text-muted);
  background: var(--ake-color-surface-muted);
}
</style>
