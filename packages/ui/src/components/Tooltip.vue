<script setup lang="ts">
import {
  TooltipArrow,
  TooltipContent,
  TooltipPortal,
  TooltipProvider,
  TooltipRoot,
  TooltipTrigger
} from 'reka-ui'

withDefaults(
  defineProps<{
    text?: string
    ariaLabel?: string
    side?: 'top' | 'right' | 'bottom' | 'left'
    align?: 'start' | 'center' | 'end'
    delayDuration?: number
    disabled?: boolean
  }>(),
  {
    side: 'top',
    align: 'center',
    delayDuration: 400,
    disabled: false
  }
)
</script>

<template>
  <TooltipProvider :delay-duration="delayDuration">
    <TooltipRoot :disabled="disabled">
      <TooltipTrigger as-child :aria-label="ariaLabel">
        <slot />
      </TooltipTrigger>
      <TooltipPortal>
        <TooltipContent class="ake-ui ake-tooltip" :side="side" :align="align" :side-offset="6">
          <slot name="content">{{ text }}</slot>
          <TooltipArrow class="ake-tooltip__arrow" :width="9" :height="5" />
        </TooltipContent>
      </TooltipPortal>
    </TooltipRoot>
  </TooltipProvider>
</template>

<style scoped>
.ake-tooltip {
  z-index: var(--ake-z-popover);
  max-width: min(18rem, calc(100vw - var(--ake-space-4)));
  padding: var(--ake-space-2) var(--ake-space-3);
  border: var(--ake-border-width) solid var(--ake-color-border-strong);
  border-radius: var(--ake-radius-md);
  color: var(--ake-color-text);
  background: var(--ake-color-surface-raised);
  box-shadow: var(--ake-shadow-popover);
  font-size: var(--ake-font-size-xs);
  line-height: 1.45;
  overflow-wrap: anywhere;
  animation: ake-tooltip-in var(--ake-duration-fast) var(--ake-ease-standard);
}

.ake-tooltip__arrow {
  fill: var(--ake-color-surface-raised);
  stroke: var(--ake-color-border-strong);
}

@keyframes ake-tooltip-in {
  from {
    opacity: 0;
    transform: scale(0.97);
  }
}
</style>
