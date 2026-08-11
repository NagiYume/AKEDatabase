<script setup lang="ts">
import { computed, ref, watch } from 'vue'

const props = withDefaults(
  defineProps<{
    src?: string
    alt: string
    fallbackSrc?: string
    width?: number | string
    height?: number | string
    aspectRatio?: string
    objectFit?: 'contain' | 'cover' | 'fill' | 'none' | 'scale-down'
    loading?: 'eager' | 'lazy'
    decoding?: 'async' | 'auto' | 'sync'
  }>(),
  {
    src: '',
    fallbackSrc: '/icon_default_missing.png',
    objectFit: 'contain',
    loading: 'lazy',
    decoding: 'async'
  }
)

const emit = defineEmits<{
  load: [event: Event]
  error: [event: Event]
  fallback: []
}>()

const activeSrc = ref(props.src || props.fallbackSrc)
const failed = ref(false)
const frameStyle = computed(() => ({
  aspectRatio: props.aspectRatio,
  '--ake-image-fit': props.objectFit
}))

watch(
  () => [props.src, props.fallbackSrc] as const,
  ([src, fallbackSrc]) => {
    activeSrc.value = src || fallbackSrc
    failed.value = false
  }
)

function handleError(event: Event): void {
  emit('error', event)
  if (activeSrc.value !== props.fallbackSrc) {
    activeSrc.value = props.fallbackSrc
    emit('fallback')
    return
  }
  failed.value = true
}
</script>

<template>
  <span class="ake-ui ake-image" :class="{ 'ake-image--failed': failed }" :style="frameStyle">
    <img
      v-if="!failed"
      class="ake-image__content"
      :src="activeSrc"
      :alt="alt"
      :width="width"
      :height="height"
      :loading="loading"
      :decoding="decoding"
      @load="emit('load', $event)"
      @error="handleError"
    />
    <span v-else class="ake-image__fallback" role="img" :aria-label="alt">
      <slot name="fallback" />
    </span>
  </span>
</template>

<style scoped>
.ake-image {
  display: inline-grid;
  width: 100%;
  min-width: 0;
  min-height: 0;
  place-items: center;
  overflow: hidden;
  border-radius: var(--ake-radius-sm);
  background: var(--ake-color-surface-muted);
}

.ake-image__content {
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  object-fit: var(--ake-image-fit);
}

.ake-image__fallback {
  display: grid;
  width: 100%;
  height: 100%;
  min-height: var(--ake-control-height-lg);
  place-items: center;
  color: var(--ake-color-text-muted);
}
</style>
