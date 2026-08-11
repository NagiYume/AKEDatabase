<script setup lang="ts">
import { computed } from 'vue'
import { ImageWithFallback } from '@ake/ui'
import { parseControlledRichText } from '@ake/domain'

const props = defineProps<{
  value: string
  resolveImageUrl: (path: string) => string
}>()

const tokens = computed(() => parseControlledRichText(props.value))

function safeColor(value: string | undefined): string | undefined {
  if (!value) return undefined
  return /^(?:#[0-9a-f]{3,8}|[a-z]+)$/i.test(value) ? value : undefined
}
</script>

<template>
  <span class="catalog-rich-text">
    <template v-for="(token, index) in tokens" :key="`${index}-${token.type}`">
      <br v-if="token.type === 'break'" />
      <ImageWithFallback
        v-else-if="token.type === 'image'"
        class="catalog-rich-text__image"
        :src="resolveImageUrl(token.value)"
        alt=""
        width="20"
        height="20"
        aspect-ratio="1"
      />
      <strong v-else-if="token.strong" :style="{ color: safeColor(token.color) }">{{ token.value }}</strong>
      <span v-else :style="{ color: safeColor(token.color) }">{{ token.value }}</span>
    </template>
  </span>
</template>

<style scoped>
.catalog-rich-text {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.catalog-rich-text__image {
  display: inline-block;
  width: 1.25em;
  height: 1.25em;
  margin-inline: 0.15em;
  vertical-align: -0.25em;
}
</style>
