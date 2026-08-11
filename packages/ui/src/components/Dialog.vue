<script setup lang="ts">
import { X } from '@lucide/vue'
import {
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogRoot,
  DialogTitle,
  DialogTrigger
} from 'reka-ui'

withDefaults(
  defineProps<{
    title: string
    closeLabel: string
    description?: string
    size?: 'sm' | 'md' | 'lg'
    modal?: boolean
  }>(),
  {
    size: 'md',
    modal: true
  }
)

const open = defineModel<boolean>('open', { default: false })
</script>

<template>
  <DialogRoot v-model:open="open" :modal="modal">
    <DialogTrigger v-if="$slots.trigger" as-child>
      <slot name="trigger" />
    </DialogTrigger>
    <DialogPortal>
      <DialogOverlay class="ake-ui ake-dialog__overlay" />
      <DialogContent class="ake-ui ake-dialog" :data-size="size">
        <header class="ake-dialog__header">
          <div class="ake-dialog__heading">
            <DialogTitle class="ake-dialog__title">
              <slot name="title">{{ title }}</slot>
            </DialogTitle>
            <DialogDescription v-if="description || $slots.description" class="ake-dialog__description">
              <slot name="description">{{ description }}</slot>
            </DialogDescription>
          </div>
          <DialogClose class="ake-dialog__close" :aria-label="closeLabel">
            <X :size="19" aria-hidden="true" />
          </DialogClose>
        </header>
        <div class="ake-dialog__body">
          <slot />
        </div>
        <footer v-if="$slots.footer" class="ake-dialog__footer">
          <slot name="footer" />
        </footer>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>

<style scoped>
.ake-dialog__overlay {
  position: fixed;
  z-index: var(--ake-z-dialog);
  inset: 0;
  background: var(--ake-color-overlay);
  animation: ake-dialog-fade var(--ake-duration-normal) var(--ake-ease-standard);
}

.ake-dialog {
  position: fixed;
  z-index: calc(var(--ake-z-dialog) + 1);
  top: 50%;
  left: 50%;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  width: min(92vw, 42rem);
  max-height: min(88dvh, 52rem);
  overflow: hidden;
  border: var(--ake-border-width) solid var(--ake-color-border-strong);
  border-radius: var(--ake-radius-lg);
  background: var(--ake-color-surface-raised);
  box-shadow: var(--ake-shadow-dialog);
  transform: translate(-50%, -50%);
  animation: ake-dialog-in var(--ake-duration-normal) var(--ake-ease-standard);
}

.ake-dialog[data-size='sm'] {
  width: min(92vw, 28rem);
}

.ake-dialog[data-size='lg'] {
  width: min(94vw, 68rem);
}

.ake-dialog__header,
.ake-dialog__footer {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: var(--ake-space-3);
  padding: var(--ake-space-4);
}

.ake-dialog__header {
  justify-content: space-between;
  border-block-end: var(--ake-border-width) solid var(--ake-color-border);
}

.ake-dialog__footer {
  justify-content: flex-end;
  flex-wrap: wrap;
  border-block-start: var(--ake-border-width) solid var(--ake-color-border);
}

.ake-dialog__heading {
  min-width: 0;
}

.ake-dialog__title {
  margin: 0;
  font-size: var(--ake-font-size-lg);
  font-weight: 700;
  line-height: var(--ake-line-height-tight);
  overflow-wrap: anywhere;
}

.ake-dialog__description {
  margin: var(--ake-space-1) 0 0;
  color: var(--ake-color-text-muted);
  font-size: var(--ake-font-size-sm);
  overflow-wrap: anywhere;
}

.ake-dialog__close {
  display: grid;
  width: var(--ake-control-height-sm);
  height: var(--ake-control-height-sm);
  flex: 0 0 auto;
  padding: 0;
  place-items: center;
  border: 0;
  border-radius: var(--ake-radius-sm);
  color: var(--ake-color-text-muted);
  background: transparent;
  cursor: pointer;
}

.ake-dialog__close:hover {
  color: var(--ake-color-text);
  background: var(--ake-color-surface-hover);
}

.ake-dialog__body {
  min-width: 0;
  min-height: 0;
  padding: var(--ake-space-4);
  overflow: auto;
  overscroll-behavior: contain;
}

@keyframes ake-dialog-fade {
  from {
    opacity: 0;
  }
}

@keyframes ake-dialog-in {
  from {
    opacity: 0;
    transform: translate(-50%, calc(-50% + 0.75rem));
  }
}

@media (max-width: 34rem) {
  .ake-dialog {
    width: calc(100vw - var(--ake-space-4));
    max-height: calc(100dvh - var(--ake-space-4));
  }
}
</style>
