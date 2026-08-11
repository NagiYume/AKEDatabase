<script setup lang="ts">
import { Check, ChevronRight, Copy } from '@lucide/vue'
import { CollapsibleContent, CollapsibleRoot, CollapsibleTrigger } from 'reka-ui'
import { computed, ref } from 'vue'

const props = withDefaults(
  defineProps<{
    value: unknown
    label: string
    copyLabel: string
    copiedLabel: string
    indent?: number
  }>(),
  { indent: 2 }
)

const emit = defineEmits<{
  copied: [value: string]
  copyError: [error: unknown]
}>()

const open = defineModel<boolean>('open', { default: false })
const copied = ref(false)
let copiedTimer: ReturnType<typeof setTimeout> | undefined

const serialized = computed(() => {
  if (typeof props.value === 'string') return props.value
  try {
    return JSON.stringify(props.value, null, props.indent) ?? String(props.value)
  } catch {
    return String(props.value)
  }
})

async function copyValue(): Promise<void> {
  try {
    await navigator.clipboard.writeText(serialized.value)
    copied.value = true
    if (copiedTimer) clearTimeout(copiedTimer)
    copiedTimer = setTimeout(() => {
      copied.value = false
    }, 1600)
    emit('copied', serialized.value)
  } catch (error) {
    emit('copyError', error)
  }
}
</script>

<template>
  <CollapsibleRoot v-model:open="open" class="ake-ui ake-raw-inspector">
    <div class="ake-raw-inspector__header">
      <CollapsibleTrigger class="ake-raw-inspector__trigger">
        <ChevronRight class="ake-raw-inspector__chevron" :size="17" aria-hidden="true" />
        <span>{{ label }}</span>
      </CollapsibleTrigger>
      <button
        v-if="open"
        class="ake-raw-inspector__copy"
        type="button"
        :aria-label="copied ? copiedLabel : copyLabel"
        @click="copyValue"
      >
        <Check v-if="copied" :size="15" aria-hidden="true" />
        <Copy v-else :size="15" aria-hidden="true" />
        <span>{{ copied ? copiedLabel : copyLabel }}</span>
      </button>
    </div>
    <CollapsibleContent class="ake-raw-inspector__content">
      <pre><code>{{ serialized }}</code></pre>
    </CollapsibleContent>
  </CollapsibleRoot>
</template>

<style scoped>
.ake-raw-inspector {
  min-width: 0;
  overflow: hidden;
  border: var(--ake-border-width) solid var(--ake-color-border);
  border-radius: var(--ake-radius-md);
  background: var(--ake-color-surface);
}

.ake-raw-inspector__header {
  display: flex;
  min-width: 0;
  min-height: var(--ake-control-height);
  align-items: center;
  justify-content: space-between;
  gap: var(--ake-space-2);
  padding-inline: var(--ake-space-2);
  background: var(--ake-color-surface-muted);
}

.ake-raw-inspector__trigger,
.ake-raw-inspector__copy {
  display: inline-flex;
  min-width: 0;
  min-height: var(--ake-control-height-sm);
  align-items: center;
  gap: var(--ake-space-2);
  border: 0;
  border-radius: var(--ake-radius-sm);
  color: var(--ake-color-text);
  background: transparent;
  cursor: pointer;
}

.ake-raw-inspector__trigger {
  flex: 1 1 auto;
  justify-content: flex-start;
  padding-inline: var(--ake-space-1);
  font-weight: 650;
  text-align: start;
}

.ake-raw-inspector__trigger span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ake-raw-inspector__copy {
  flex: 0 0 auto;
  padding-inline: var(--ake-space-2);
  color: var(--ake-color-text-muted);
  font-size: var(--ake-font-size-xs);
}

.ake-raw-inspector__trigger:hover,
.ake-raw-inspector__copy:hover {
  background: var(--ake-color-surface-hover);
}

.ake-raw-inspector__chevron {
  flex: 0 0 auto;
  transition: transform var(--ake-duration-fast) var(--ake-ease-standard);
}

.ake-raw-inspector__trigger[data-state='open'] .ake-raw-inspector__chevron {
  transform: rotate(90deg);
}

.ake-raw-inspector__content {
  max-height: min(34rem, 65dvh);
  overflow: auto;
  border-block-start: var(--ake-border-width) solid var(--ake-color-border);
  background: var(--ake-color-code);
}

.ake-raw-inspector__content pre {
  min-width: max-content;
  margin: 0;
  padding: var(--ake-space-4);
  color: var(--ake-color-code-text);
  font-family: var(--ake-font-mono);
  font-size: var(--ake-font-size-xs);
  line-height: 1.6;
  tab-size: 2;
}
</style>
