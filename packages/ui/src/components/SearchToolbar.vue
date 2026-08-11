<script setup lang="ts">
import { Search, X } from '@lucide/vue'
import { useId } from 'vue'

const props = withDefaults(
  defineProps<{
    modelValue: string
    ariaLabel: string
    clearLabel: string
    placeholder?: string
    disabled?: boolean
    name?: string
  }>(),
  { disabled: false }
)

const emit = defineEmits<{
  'update:modelValue': [value: string]
  submit: [value: string]
}>()

const inputId = useId()

function update(event: Event): void {
  emit('update:modelValue', (event.target as HTMLInputElement).value)
}

function clear(): void {
  emit('update:modelValue', '')
}

function submit(): void {
  emit('submit', props.modelValue)
}
</script>

<template>
  <form class="ake-ui ake-search-toolbar" role="search" @submit.prevent="submit">
    <div class="ake-search-toolbar__field">
      <Search class="ake-search-toolbar__search-icon" :size="18" aria-hidden="true" />
      <label class="ake-visually-hidden" :for="inputId">{{ ariaLabel }}</label>
      <input
        :id="inputId"
        class="ake-search-toolbar__input"
        type="search"
        :name="name"
        :value="modelValue"
        :placeholder="placeholder"
        :disabled="disabled"
        autocomplete="off"
        @input="update"
      />
      <button
        v-if="modelValue"
        class="ake-search-toolbar__clear"
        type="button"
        :aria-label="clearLabel"
        :disabled="disabled"
        @click="clear"
      >
        <X :size="17" aria-hidden="true" />
      </button>
    </div>
    <div v-if="$slots.actions" class="ake-search-toolbar__actions">
      <slot name="actions" />
    </div>
  </form>
</template>

<style scoped>
.ake-search-toolbar {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: var(--ake-space-2);
}

.ake-search-toolbar__field {
  position: relative;
  display: flex;
  min-width: 8rem;
  flex: 1 1 16rem;
  align-items: center;
}

.ake-search-toolbar__search-icon {
  position: absolute;
  inset-inline-start: var(--ake-space-3);
  color: var(--ake-color-text-muted);
  pointer-events: none;
}

.ake-search-toolbar__input {
  width: 100%;
  min-width: 0;
  height: var(--ake-control-height);
  padding: 0 calc(var(--ake-space-8) + var(--ake-space-2));
  border: var(--ake-border-width) solid var(--ake-color-border);
  border-radius: var(--ake-radius-md);
  background: var(--ake-color-surface);
}

.ake-search-toolbar__input:hover:not(:disabled) {
  border-color: var(--ake-color-border-strong);
}

.ake-search-toolbar__input:disabled {
  cursor: not-allowed;
  opacity: 0.58;
}

.ake-search-toolbar__input::-webkit-search-cancel-button {
  display: none;
}

.ake-search-toolbar__clear {
  position: absolute;
  inset-inline-end: var(--ake-space-1);
  display: grid;
  width: var(--ake-control-height-sm);
  height: var(--ake-control-height-sm);
  padding: 0;
  place-items: center;
  border: 0;
  border-radius: var(--ake-radius-sm);
  color: var(--ake-color-text-muted);
  background: transparent;
  cursor: pointer;
}

.ake-search-toolbar__clear:hover:not(:disabled) {
  color: var(--ake-color-text);
  background: var(--ake-color-surface-hover);
}

.ake-search-toolbar__actions {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: var(--ake-space-2);
}

@media (max-width: 30rem) {
  .ake-search-toolbar {
    align-items: stretch;
    flex-direction: column;
  }

  .ake-search-toolbar__field,
  .ake-search-toolbar__actions {
    width: 100%;
  }
}
</style>
