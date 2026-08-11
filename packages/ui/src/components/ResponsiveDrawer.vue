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
import type { DrawerSide } from '../types'

withDefaults(
  defineProps<{
    title: string
    closeLabel: string
    description?: string
    side?: DrawerSide
    modal?: boolean
  }>(),
  {
    side: 'right',
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
      <DialogOverlay class="ake-ui ake-drawer__overlay" />
      <DialogContent class="ake-ui ake-drawer" :data-side="side">
        <header class="ake-drawer__header">
          <div class="ake-drawer__heading">
            <DialogTitle class="ake-drawer__title">
              <slot name="title">{{ title }}</slot>
            </DialogTitle>
            <DialogDescription v-if="description || $slots.description" class="ake-drawer__description">
              <slot name="description">{{ description }}</slot>
            </DialogDescription>
          </div>
          <DialogClose class="ake-drawer__close" :aria-label="closeLabel">
            <X :size="19" aria-hidden="true" />
          </DialogClose>
        </header>
        <div class="ake-drawer__body">
          <slot />
        </div>
        <footer v-if="$slots.footer" class="ake-drawer__footer">
          <slot name="footer" />
        </footer>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>

<style scoped>
.ake-drawer__overlay {
  position: fixed;
  z-index: var(--ake-z-dialog);
  inset: 0;
  background: var(--ake-color-overlay);
  animation: ake-drawer-fade var(--ake-duration-normal) var(--ake-ease-standard);
}

.ake-drawer {
  position: fixed;
  z-index: calc(var(--ake-z-dialog) + 1);
  top: 0;
  bottom: 0;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  width: var(--ake-drawer-width);
  min-width: 0;
  overflow: hidden;
  border-inline-start: var(--ake-border-width) solid var(--ake-color-border-strong);
  background: var(--ake-color-surface-raised);
  box-shadow: var(--ake-shadow-dialog);
}

.ake-drawer[data-side='right'] {
  right: 0;
  animation: ake-drawer-right var(--ake-duration-normal) var(--ake-ease-standard);
}

.ake-drawer[data-side='left'] {
  left: 0;
  border-inline-start: 0;
  border-inline-end: var(--ake-border-width) solid var(--ake-color-border-strong);
  animation: ake-drawer-left var(--ake-duration-normal) var(--ake-ease-standard);
}

.ake-drawer__header,
.ake-drawer__footer {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: var(--ake-space-3);
  padding: var(--ake-space-4);
}

.ake-drawer__header {
  justify-content: space-between;
  border-block-end: var(--ake-border-width) solid var(--ake-color-border);
}

.ake-drawer__footer {
  justify-content: flex-end;
  flex-wrap: wrap;
  border-block-start: var(--ake-border-width) solid var(--ake-color-border);
}

.ake-drawer__heading,
.ake-drawer__body {
  min-width: 0;
}

.ake-drawer__title {
  margin: 0;
  font-size: var(--ake-font-size-lg);
  font-weight: 700;
  line-height: var(--ake-line-height-tight);
  overflow-wrap: anywhere;
}

.ake-drawer__description {
  margin: var(--ake-space-1) 0 0;
  color: var(--ake-color-text-muted);
  font-size: var(--ake-font-size-sm);
  overflow-wrap: anywhere;
}

.ake-drawer__close {
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

.ake-drawer__close:hover {
  color: var(--ake-color-text);
  background: var(--ake-color-surface-hover);
}

.ake-drawer__body {
  min-height: 0;
  padding: var(--ake-space-4);
  overflow: auto;
  overscroll-behavior: contain;
}

@keyframes ake-drawer-fade {
  from {
    opacity: 0;
  }
}

@keyframes ake-drawer-right {
  from {
    transform: translateX(100%);
  }
}

@keyframes ake-drawer-left {
  from {
    transform: translateX(-100%);
  }
}

@media (max-width: 42rem) {
  .ake-drawer,
  .ake-drawer[data-side='left'],
  .ake-drawer[data-side='right'] {
    top: auto;
    right: 0;
    bottom: 0;
    left: 0;
    width: 100%;
    max-height: min(86dvh, 46rem);
    border: var(--ake-border-width) solid var(--ake-color-border-strong);
    border-block-end: 0;
    border-radius: var(--ake-radius-lg) var(--ake-radius-lg) 0 0;
    animation: ake-drawer-bottom var(--ake-duration-normal) var(--ake-ease-standard);
  }
}

@keyframes ake-drawer-bottom {
  from {
    transform: translateY(100%);
  }
}
</style>
