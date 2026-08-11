<script setup lang="ts">
import { ImageWithFallback } from '@ake/ui'
import type { MarkdownInline } from '../model'

defineProps<{
  nodes: readonly MarkdownInline[]
  resolveHref: (value: string) => string
  resolveMedia: (value: string) => string
  openLabel: string
}>()

const emit = defineEmits<{
  'navigate-heading': [id: string]
  'open-image': [src: string, alt: string]
}>()

function handleLink(event: MouseEvent, href: string): void {
  if (!href.startsWith('#')) return
  event.preventDefault()
  emit('navigate-heading', href.slice(1))
}
</script>

<template>
  <template v-for="(node, nodeIndex) in nodes" :key="nodeIndex">
    <strong v-if="node.kind === 'strong'">{{ node.text }}</strong>
    <em v-else-if="node.kind === 'emphasis'">{{ node.text }}</em>
    <del v-else-if="node.kind === 'delete'">{{ node.text }}</del>
    <code v-else-if="node.kind === 'code'">{{ node.text }}</code>
    <br v-else-if="node.kind === 'break'" />
    <a
      v-else-if="node.kind === 'link'"
      :href="resolveHref(node.href)"
      :target="node.href.startsWith('#') ? undefined : '_blank'"
      rel="noopener noreferrer"
      @click="handleLink($event, node.href)"
    >
      {{ node.text }}
    </a>
    <button
      v-else-if="node.kind === 'image'"
      class="research-image-button"
      type="button"
      :title="openLabel"
      @click="emit('open-image', node.src, node.text)"
    >
      <ImageWithFallback class="research-image" :src="resolveMedia(node.src)" :alt="node.text" />
    </button>
    <span v-else>{{ node.text }}</span>
  </template>
</template>
