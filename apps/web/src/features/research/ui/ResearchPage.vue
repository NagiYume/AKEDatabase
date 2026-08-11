<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { useQuery } from '@tanstack/vue-query'
import { House, List, ListTree } from '@lucide/vue'
import {
  DirectoryPanel,
  Dialog,
  EmptyState,
  ErrorState,
  ImageWithFallback,
  LoadingState,
  ResponsiveDrawer,
  SearchToolbar
} from '@ake/ui'
import { sharedRef } from '@ake/r2-contract'
import { useAppContext } from '../../../app/providers/app-context'
import { usePreferencesStore } from '../../../app/stores/preferences'
import { userErrorMessageKey } from '../../../shared/i18n'
import { getResearchRepository } from '../api/repository'
import {
  filterResearchDocuments,
  tokenizeMarkdown,
  type MarkdownInline,
  type ResearchDocument
} from '../model'
import ResearchMarkdownInline from './ResearchMarkdownInline.vue'

defineOptions({ name: 'ResearchPage' })

const route = useRoute()
const router = useRouter()
const { t, te, locale } = useI18n()
const preferences = usePreferencesStore()
const { client, dataState } = useAppContext()
const repository = getResearchRepository(client)
const lightboxOpen = ref(false)
const lightboxSrc = ref('')
const lightboxAlt = ref('')
const mobileDirectoryOpen = ref(false)
const tocOpen = ref(false)
const activeTocId = ref('')
const detailElement = ref<HTMLElement | null>(null)
let tocObserver: IntersectionObserver | undefined

function tr(key: string, chinese: string, english: string): string {
  if (te(key)) return String(t(key))
  return locale.value === 'CH' ? chinese : english
}
const search = computed({
  get: () => String(route.query.q ?? ''),
  set: (value: string) =>
    void router.replace({ query: { ...route.query, ...(value ? { q: value } : { q: undefined }) } })
})
function entityParam(): string {
  const value = route.query.id
  return Array.isArray(value) ? (value[0] ?? '') : typeof value === 'string' ? value : ''
}

const listKey = computed(() => [
  'research',
  'manifest',
  dataState.value.baseUrl,
  dataState.value.selected.id,
  dataState.value.manifest.sharedRevision
])
const listQuery = useQuery({
  queryKey: listKey,
  queryFn: ({ signal }) => repository.list(signal)
})
const accessibleDocuments = computed(() =>
  filterResearchDocuments(listQuery.data.value ?? [], {
    search: '',
    showHidden: preferences.showHidden,
    unlockedTokens: new Set(preferences.unlockedTokens)
  })
)
const visibleDocuments = computed(() =>
  filterResearchDocuments(accessibleDocuments.value, {
    search: search.value,
    showHidden: true,
    unlockedTokens: new Set(preferences.unlockedTokens)
  })
)
const selectedDocument = computed(() => {
  const id = entityParam()
  return id ? (accessibleDocuments.value.find((document) => document.id === id) ?? null) : null
})
const documentKey = computed(() => [
  'research',
  'document',
  dataState.value.baseUrl,
  dataState.value.selected.id,
  selectedDocument.value?.contentFile ?? ''
])
const documentQuery = useQuery({
  queryKey: documentKey,
  enabled: computed(() => selectedDocument.value !== null),
  queryFn: ({ signal }) => {
    const document = selectedDocument.value
    if (!document) throw new Error('Research document is not selected')
    return repository.read(document, signal)
  }
})
const markdown = computed(() => tokenizeMarkdown(documentQuery.data.value ?? ''))
const tableOfContents = computed(() =>
  markdown.value.flatMap((block) =>
    block.kind === 'heading' && block.level <= 3
      ? [{ id: block.id, level: block.level, label: inlineText(block.content) }]
      : []
  )
)
const documentGroups = computed(() => {
  const groups = new Map<string, { id: string; name: string; order: number; documents: ResearchDocument[] }>()
  for (const document of visibleDocuments.value) {
    const id = document.category || '__general__'
    const group = groups.get(id) ?? {
      id,
      name: document.category || tr('modules.research.topics.general', '常规', 'General'),
      order: document.categoryOrder,
      documents: []
    }
    group.documents.push(document)
    groups.set(id, group)
  }
  return [...groups.values()].sort(
    (left, right) => left.order - right.order || left.name.localeCompare(right.name)
  )
})

function openDocument(document: ResearchDocument): void {
  mobileDirectoryOpen.value = false
  tocOpen.value = false
  void router.push({
    name: 'module',
    params: { moduleId: 'research' },
    query: { ...route.query, id: document.id }
  })
}

function showOverview(): void {
  activeTocId.value = ''
  tocOpen.value = false
  void router.push({
    name: 'module',
    params: { moduleId: 'research' },
    query: { ...route.query, id: undefined }
  })
}

function errorMessage(error: unknown): string {
  return String(t(userErrorMessageKey(error)))
}

function inlineText(tokens: readonly MarkdownInline[]): string {
  return tokens.map((token) => token.text).join('')
}

function resolveMedia(value: string): string {
  if (/^https?:\/\//i.test(value)) return value
  try {
    return client.resolveUrl(sharedRef(value))
  } catch {
    return ''
  }
}

function resolvedHref(value: string): string {
  if (value.startsWith('#') || /^https?:\/\//i.test(value)) return value
  try {
    return client.resolveUrl(sharedRef(value))
  } catch {
    return '#'
  }
}

function openLightbox(value: string, alt: string): void {
  const source = resolveMedia(value)
  if (!source) return
  lightboxSrc.value = source
  lightboxAlt.value = alt || String(t('modules.research.title'))
  lightboxOpen.value = true
}

function scrollToHeading(id: string): void {
  const container = detailElement.value
  const target = container?.querySelector<HTMLElement>(`#${CSS.escape(id)}`)
  if (!container || !target) return
  const top = target.getBoundingClientRect().top - container.getBoundingClientRect().top + container.scrollTop
  container.scrollTo({ top: Math.max(0, top - 16), behavior: 'smooth' })
  activeTocId.value = id
  tocOpen.value = false
}

function setupTocObserver(): void {
  tocObserver?.disconnect()
  tocObserver = undefined
  activeTocId.value = tableOfContents.value[0]?.id ?? ''
  const container = detailElement.value
  if (!container || tableOfContents.value.length < 2 || typeof IntersectionObserver === 'undefined') return
  const headings = tableOfContents.value
    .map((heading) => container.querySelector<HTMLElement>(`#${CSS.escape(heading.id)}`))
    .filter((heading): heading is HTMLElement => Boolean(heading))
  tocObserver = new IntersectionObserver(
    (entries) => {
      const visible = entries.find((entry) => entry.isIntersecting)
      if (visible) activeTocId.value = visible.target.id
    },
    { root: container, rootMargin: '-10% 0px -80% 0px', threshold: 0 }
  )
  for (const heading of headings) tocObserver.observe(heading)
}

watch(
  [markdown, selectedDocument],
  () => {
    void nextTick(setupTocObserver)
  },
  { flush: 'post' }
)

onBeforeUnmount(() => tocObserver?.disconnect())
</script>

<template>
  <div class="research-module">
    <aside class="research-sidebar">
      <DirectoryPanel :ariaLabel="tr('modules.research.select', '研究文档', 'Research documents')">
        <template #toolbar>
          <div class="research-search-row">
            <button
              class="research-home-button"
              type="button"
              :aria-label="tr('nav.home', '返回起始页', 'Back to overview')"
              @click="showOverview"
            >
              <House :size="18" aria-hidden="true" />
            </button>
            <SearchToolbar
              v-model="search"
              :ariaLabel="tr('modules.research.search', '搜索研究文档', 'Search research documents')"
              :clear-label="t('common.clear')"
              :placeholder="tr('modules.research.search', '搜索研究文档', 'Search research documents')"
            />
          </div>
        </template>
        <LoadingState
          v-if="listQuery.isPending.value"
          compact
          :label="tr('modules.research.loading', '正在读取研究索引', 'Loading research index')"
        />
        <ErrorState
          v-else-if="listQuery.isError.value"
          compact
          :title="t('common.error')"
          :description="errorMessage(listQuery.error.value)"
          :retry-label="t('common.retry')"
          @retry="listQuery.refetch()"
        />
        <EmptyState
          v-else-if="visibleDocuments.length === 0"
          compact
          :title="tr('modules.research.empty.noMatches', '没有符合条件的文档', 'No matching documents')"
        />
        <div v-else class="research-directory">
          <button
            v-for="document in visibleDocuments"
            :key="document.id"
            class="research-directory__item"
            :class="{ 'is-active': selectedDocument?.id === document.id }"
            type="button"
            @click="openDocument(document)"
          >
            <strong>{{ document.name }}</strong>
          </button>
        </div>
      </DirectoryPanel>
    </aside>

    <div
      ref="detailElement"
      class="research-detail"
      role="region"
      :aria-label="tr('modules.research.overview.title', '研究文档', 'Research documents')"
    >
      <LoadingState
        v-if="listQuery.isPending.value"
        :label="tr('modules.research.loading', '正在读取研究索引', 'Loading research index')"
      />
      <ErrorState
        v-else-if="listQuery.isError.value"
        :title="t('common.error')"
        :description="errorMessage(listQuery.error.value)"
        :retry-label="t('common.retry')"
        @retry="listQuery.refetch()"
      />
      <ErrorState
        v-else-if="entityParam() && !selectedDocument"
        :title="tr('modules.research.notFound.title', '未找到研究文档', 'Research document not found')"
        :description="
          tr(
            'modules.research.notFound.description',
            '该文档不存在，或访问令牌尚未解锁。',
            'The document is unavailable or its access token is locked.'
          )
        "
      />
      <template v-else-if="selectedDocument">
        <LoadingState
          v-if="documentQuery.isPending.value"
          :label="tr('modules.research.document.loading', '正在读取文档', 'Loading document')"
        />
        <ErrorState
          v-else-if="documentQuery.isError.value"
          :title="t('common.error')"
          :description="errorMessage(documentQuery.error.value)"
          :retry-label="t('common.retry')"
          @retry="documentQuery.refetch()"
        />
        <div v-else class="research-article">
          <article class="research-document article-content">
            <template v-for="(block, blockIndex) in markdown" :key="blockIndex">
              <component
                :is="`h${block.level}`"
                v-if="block.kind === 'heading'"
                :id="block.id"
                class="research-heading"
              >
                <ResearchMarkdownInline
                  :nodes="block.content"
                  :resolve-href="resolvedHref"
                  :resolve-media="resolveMedia"
                  :open-label="t('common.open')"
                  @navigate-heading="scrollToHeading"
                  @open-image="openLightbox"
                />
              </component>
              <p v-else-if="block.kind === 'paragraph'" class="research-paragraph">
                <ResearchMarkdownInline
                  :nodes="block.content"
                  :resolve-href="resolvedHref"
                  :resolve-media="resolveMedia"
                  :open-label="t('common.open')"
                  @navigate-heading="scrollToHeading"
                  @open-image="openLightbox"
                />
              </p>
              <blockquote v-else-if="block.kind === 'quote'">
                <ResearchMarkdownInline
                  :nodes="block.content"
                  :resolve-href="resolvedHref"
                  :resolve-media="resolveMedia"
                  :open-label="t('common.open')"
                  @navigate-heading="scrollToHeading"
                  @open-image="openLightbox"
                />
              </blockquote>
              <pre
                v-else-if="block.kind === 'code'"
              ><code :data-language="block.language">{{ block.text }}</code></pre>
              <component :is="block.ordered ? 'ol' : 'ul'" v-else-if="block.kind === 'list'">
                <li v-for="(item, itemIndex) in block.items" :key="itemIndex">
                  <ResearchMarkdownInline
                    :nodes="item"
                    :resolve-href="resolvedHref"
                    :resolve-media="resolveMedia"
                    :open-label="t('common.open')"
                    @navigate-heading="scrollToHeading"
                    @open-image="openLightbox"
                  />
                </li>
              </component>
              <div v-else-if="block.kind === 'table'" class="research-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th v-for="(cell, cellIndex) in block.headers" :key="cellIndex">
                        <ResearchMarkdownInline
                          :nodes="cell"
                          :resolve-href="resolvedHref"
                          :resolve-media="resolveMedia"
                          :open-label="t('common.open')"
                          @navigate-heading="scrollToHeading"
                          @open-image="openLightbox"
                        />
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="(row, rowIndex) in block.rows" :key="rowIndex">
                      <td v-for="(cell, cellIndex) in row" :key="cellIndex">
                        <ResearchMarkdownInline
                          :nodes="cell"
                          :resolve-href="resolvedHref"
                          :resolve-media="resolveMedia"
                          :open-label="t('common.open')"
                          @navigate-heading="scrollToHeading"
                          @open-image="openLightbox"
                        />
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <hr v-else />
            </template>
          </article>
        </div>
      </template>
      <section v-else class="ake-overview research-overview">
        <header class="ake-overview__header">
          <div class="ake-overview__eyebrow">
            {{ t('common.count', { count: visibleDocuments.length }) }}
          </div>
          <h1>{{ tr('modules.research.overview.title', '研究文档', 'Research documents') }}</h1>
          <p>
            {{
              tr(
                'modules.research.overview.description',
                '技术研究、机制分析与数据参考。',
                'Technical research, mechanics analysis and data references.'
              )
            }}
          </p>
        </header>
        <section v-for="group in documentGroups" :key="group.id" class="ake-overview__section">
          <h2>
            <span>{{ group.name }}</span>
            <b>{{ group.documents.length }}</b>
          </h2>
          <div class="ake-overview__grid">
            <button
              v-for="document in group.documents"
              :key="document.id"
              class="ake-overview__card"
              type="button"
              @click="openDocument(document)"
            >
              <span class="ake-overview__visual is-empty" aria-hidden="true">DATA</span>
              <span class="ake-overview__body">
                <span class="ake-overview__title-row">
                  <strong>{{ document.name }}</strong>
                </span>
                <code class="ake-overview__id">{{ document.id }}</code>
                <span v-if="document.summary" class="ake-overview__tags">
                  <span>{{ document.summary }}</span>
                </span>
              </span>
            </button>
          </div>
        </section>
      </section>
    </div>

    <aside
      class="research-toc"
      :class="{ 'is-open': tocOpen }"
      :aria-label="tr('modules.research.index', '目录', 'Contents')"
    >
      <template v-if="selectedDocument && tableOfContents.length >= 2">
        <strong class="research-toc__title">{{ tr('modules.research.index', '目录', 'Contents') }}</strong>
        <nav class="research-toc__nav">
          <a
            v-for="heading in tableOfContents"
            :key="heading.id"
            :href="`#${heading.id}`"
            :data-level="heading.level"
            :class="{ 'is-active': activeTocId === heading.id }"
            @click.prevent="scrollToHeading(heading.id)"
          >
            {{ heading.label }}
          </a>
        </nav>
      </template>
    </aside>

    <button
      v-if="selectedDocument && tableOfContents.length >= 2"
      class="research-toc-toggle"
      :class="{ 'is-open': tocOpen }"
      type="button"
      :aria-expanded="tocOpen"
      :aria-label="tr('modules.research.index', '目录', 'Contents')"
      @click="tocOpen = !tocOpen"
    >
      <ListTree :size="18" aria-hidden="true" />
      <span>{{ tr('modules.research.index', '目录', 'Contents') }}</span>
    </button>

    <ResponsiveDrawer
      v-model:open="mobileDirectoryOpen"
      side="left"
      :title="tr('modules.research.select', '选择研究文档', 'Select a research document')"
      :close-label="t('common.close')"
    >
      <template #trigger>
        <button
          class="research-mobile-list-button"
          type="button"
          :aria-label="tr('modules.research.select', '选择研究文档', 'Select a research document')"
        >
          <List :size="18" aria-hidden="true" />
          <span>{{ t('common.list') }}</span>
        </button>
      </template>
      <EmptyState
        v-if="visibleDocuments.length === 0"
        compact
        :title="tr('modules.research.empty.noMatches', '没有符合条件的文档', 'No matching documents')"
      />
      <div v-else class="research-mobile-directory">
        <button
          v-for="document in visibleDocuments"
          :key="document.id"
          class="research-mobile-directory__item"
          :class="{ 'is-active': selectedDocument?.id === document.id }"
          type="button"
          @click="openDocument(document)"
        >
          {{ document.name }}
        </button>
      </div>
    </ResponsiveDrawer>

    <Dialog
      v-model:open="lightboxOpen"
      size="lg"
      :title="lightboxAlt || String(t('modules.research.title'))"
      :close-label="t('common.close')"
    >
      <ImageWithFallback
        class="research-lightbox-image"
        :src="lightboxSrc"
        :alt="lightboxAlt"
        loading="eager"
      />
    </Dialog>
  </div>
</template>

<style scoped>
.research-directory {
  display: grid;
}
.research-directory__item {
  display: grid;
  gap: var(--ake-space-1);
  width: 100%;
  padding: var(--ake-space-3);
  border: 0;
  border-block-end: var(--ake-border-width) solid var(--ake-color-border);
  color: var(--ake-color-text);
  background: transparent;
  text-align: start;
  cursor: pointer;
}
.research-directory__item:hover,
.research-directory__item.is-active {
  background: var(--ake-color-surface-hover);
}
.research-directory__item.is-active {
  box-shadow: inset 3px 0 var(--ake-color-accent);
}
.research-directory__item span {
  color: var(--ake-color-text-muted);
  font-size: var(--ake-font-size-xs);
  overflow-wrap: anywhere;
}
.research-document {
  min-width: 0;
  width: min(100%, 76ch);
  line-height: var(--ake-line-height-relaxed);
}
.research-heading {
  margin: var(--ake-space-7) 0 var(--ake-space-3);
  scroll-margin-block-start: var(--ake-space-5);
  letter-spacing: 0;
}
.research-heading:first-child {
  margin-block-start: 0;
}
.research-paragraph {
  margin: 0 0 var(--ake-space-4);
}
.research-document blockquote {
  margin: var(--ake-space-4) 0;
  padding: var(--ake-space-3) var(--ake-space-4);
  border-inline-start: 3px solid var(--ake-color-accent);
  color: var(--ake-color-text-muted);
  background: var(--ake-color-surface-muted);
}
.research-document pre {
  max-width: 100%;
  overflow: auto;
  padding: var(--ake-space-4);
  border: var(--ake-border-width) solid var(--ake-color-border);
  border-radius: var(--ake-radius-md);
  background: var(--ake-color-surface-muted);
}
.research-document code {
  overflow-wrap: anywhere;
}
.research-image-button {
  display: block;
  width: 100%;
  max-width: 100%;
  margin-block: var(--ake-space-4);
  padding: 0;
  border: var(--ake-border-width) solid transparent;
  border-radius: var(--ake-radius-sm);
  background: transparent;
  cursor: zoom-in;
}
.research-image-button:hover,
.research-image-button:focus-visible {
  border-color: var(--ake-color-accent);
}
.research-image {
  display: grid;
  max-width: 100%;
}
.research-lightbox-image {
  max-width: 100%;
  max-height: calc(88dvh - 8rem);
}
.research-table-wrap {
  max-width: 100%;
  overflow: auto;
  margin-block: var(--ake-space-4);
}
.research-table-wrap table {
  width: 100%;
  border-collapse: collapse;
}
.research-table-wrap th,
.research-table-wrap td {
  padding: var(--ake-space-2) var(--ake-space-3);
  border: var(--ake-border-width) solid var(--ake-color-border);
  text-align: start;
}
/* Legacy research layout contract: directory, reading surface, then right-hand contents. */
.research-module {
  position: relative;
  display: grid;
  grid-template-columns: 260px minmax(0, 1fr) 210px;
  width: 100%;
  height: 100%;
  min-height: 31.25rem;
  overflow: hidden;
  background: var(--ake-color-surface);
}

.research-sidebar {
  min-width: 0;
  overflow: hidden;
  border-inline-end: var(--ake-border-width) solid var(--ake-color-border);
  background: var(--ake-color-surface-muted);
}

.research-search-row {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: var(--ake-space-2);
}

.research-search-row > :deep(.ake-search-toolbar) {
  min-width: 0;
  flex: 1;
}

.research-home-button {
  display: grid;
  width: var(--ake-control-height-md);
  height: var(--ake-control-height-md);
  flex: 0 0 auto;
  padding: 0;
  place-items: center;
  border: var(--ake-border-width) solid var(--ake-color-border);
  border-radius: var(--ake-radius-sm);
  color: var(--ake-color-accent);
  background: var(--ake-color-surface);
  cursor: pointer;
}

.research-home-button:hover,
.research-home-button:focus-visible {
  border-color: var(--ake-color-accent);
  background: var(--ake-color-surface-hover);
}

.research-detail {
  min-width: 0;
  overflow: auto;
  overscroll-behavior: contain;
  background: var(--ake-color-surface);
}

.research-article {
  width: min(100%, 68.75rem);
  min-height: 100%;
  margin-inline: auto;
  padding: var(--ake-space-6);
  box-sizing: border-box;
}

.research-toc {
  position: sticky;
  top: 0;
  display: block;
  width: 210px;
  height: 100dvh;
  max-height: none;
  padding: var(--ake-space-5) var(--ake-space-3);
  overflow: auto;
  border: 0;
  border-inline-start: var(--ake-border-width) solid var(--ake-color-border);
  background: var(--ake-color-surface);
  box-sizing: border-box;
}

.research-toc__title {
  display: block;
  margin-block-end: var(--ake-space-2);
  padding-block-end: var(--ake-space-2);
  border-block-end: var(--ake-border-width) solid var(--ake-color-border);
  font-size: var(--ake-font-size-sm);
}

.research-toc__nav {
  display: grid;
  gap: 2px;
}

.research-toc__nav a {
  display: block;
  padding: 3px 0 3px var(--ake-space-2);
  overflow: hidden;
  border-inline-start: 2px solid transparent;
  border-radius: 0;
  color: var(--ake-color-text-muted);
  font-size: var(--ake-font-size-sm);
  line-height: 1.5;
  text-decoration: none;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.research-toc__nav a:hover,
.research-toc__nav a.is-active {
  color: var(--ake-color-accent);
}

.research-toc__nav a.is-active {
  border-inline-start-color: var(--ake-color-accent);
  font-weight: 700;
}

.research-toc__nav a[data-level='2'] {
  padding-inline-start: var(--ake-space-4);
}

.research-toc__nav a[data-level='3'] {
  padding-inline-start: var(--ake-space-6);
  font-size: var(--ake-font-size-xs);
}

.research-toc-toggle,
.research-mobile-list-button {
  position: fixed;
  z-index: var(--ake-z-sticky);
  right: var(--ake-space-4);
  display: none;
  min-height: var(--ake-control-height-md);
  align-items: center;
  gap: var(--ake-space-2);
  padding: var(--ake-space-2) var(--ake-space-4);
  border: 0;
  border-radius: 999px;
  color: var(--ake-color-on-accent);
  background: var(--ake-color-accent);
  box-shadow: var(--ake-shadow-dialog);
  cursor: pointer;
}

.research-toc-toggle {
  bottom: 4.375rem;
}

.research-toc-toggle.is-open {
  background: var(--ake-color-text);
}

.research-mobile-list-button {
  bottom: 4.375rem;
}

.research-mobile-directory {
  display: grid;
}

.research-mobile-directory__item {
  width: 100%;
  padding: var(--ake-space-3) var(--ake-space-4);
  border: 0;
  border-block-end: var(--ake-border-width) solid var(--ake-color-border);
  color: var(--ake-color-text);
  background: transparent;
  text-align: start;
  cursor: pointer;
}

.research-mobile-directory__item:hover,
.research-mobile-directory__item.is-active {
  color: var(--ake-color-accent);
  background: var(--ake-color-surface-hover);
}

.research-overview {
  min-height: 100%;
  padding: clamp(1.125rem, 3vw, 2.375rem);
}

.ake-overview__header {
  margin-block-end: var(--ake-space-6);
  padding: var(--ake-space-5);
  border: var(--ake-border-width) solid var(--ake-color-border);
  border-inline-start: 5px solid var(--ake-color-accent);
  border-radius: var(--ake-radius-md);
  background: var(--ake-color-surface);
}

.ake-overview__eyebrow {
  margin-block-end: var(--ake-space-2);
  color: var(--ake-color-accent);
  font-size: var(--ake-font-size-xs);
  font-weight: 800;
  text-transform: uppercase;
}

.ake-overview__header h1,
.ake-overview__header p {
  margin: 0;
  letter-spacing: 0;
}

.ake-overview__header p {
  margin-block-start: var(--ake-space-2);
  color: var(--ake-color-text-muted);
}

.ake-overview__section {
  margin-block-start: var(--ake-space-6);
}

.ake-overview__section > h2 {
  display: flex;
  align-items: baseline;
  gap: var(--ake-space-2);
  margin: 0 0 var(--ake-space-3);
  font-size: var(--ake-font-size-lg);
  letter-spacing: 0;
}

.ake-overview__section > h2::after {
  height: var(--ake-border-width);
  flex: 1;
  background: var(--ake-color-border);
  content: '';
}

.ake-overview__section > h2 b {
  order: 2;
  padding: 2px var(--ake-space-2);
  border-radius: 999px;
  color: var(--ake-color-text-muted);
  background: var(--ake-color-surface-muted);
  font-size: var(--ake-font-size-xs);
}

.ake-overview__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 12.8125rem), 1fr));
  gap: var(--ake-space-3);
}

.ake-overview__card {
  display: grid;
  grid-template-columns: 4.75rem minmax(0, 1fr);
  min-width: 0;
  min-height: 5.5rem;
  padding: 0;
  overflow: hidden;
  border: 2px solid var(--ake-color-accent);
  border-radius: var(--ake-radius-md);
  color: var(--ake-color-text);
  background: var(--ake-color-surface);
  text-align: start;
  cursor: pointer;
}

.ake-overview__card:hover,
.ake-overview__card:focus-visible {
  background: var(--ake-color-surface-hover);
  box-shadow: var(--ake-shadow-card);
}

.ake-overview__visual {
  display: grid;
  min-height: 5.5rem;
  place-items: center;
  color: var(--ake-color-text-muted);
  background: var(--ake-color-surface-muted);
  font-size: var(--ake-font-size-xs);
  font-weight: 800;
}

.ake-overview__body {
  display: block;
  min-width: 0;
  padding: var(--ake-space-3);
}

.ake-overview__title-row strong,
.ake-overview__id {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ake-overview__id {
  margin-block-start: var(--ake-space-1);
  color: var(--ake-color-text-muted);
  font-size: var(--ake-font-size-xs);
}

.ake-overview__tags {
  display: flex;
  margin-block-start: var(--ake-space-2);
}

.ake-overview__tags span {
  max-width: 100%;
  padding: 2px var(--ake-space-2);
  overflow: hidden;
  border: var(--ake-border-width) solid var(--ake-color-border);
  border-radius: var(--ake-radius-sm);
  color: var(--ake-color-text-muted);
  font-size: var(--ake-font-size-xs);
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (max-width: 75rem) {
  .research-module {
    grid-template-columns: 260px minmax(0, 1fr);
  }

  .research-toc {
    position: fixed;
    z-index: calc(var(--ake-z-sticky) - 1);
    top: auto;
    right: var(--ake-space-4);
    bottom: 7.5rem;
    display: none;
    width: 15rem;
    height: auto;
    max-height: 60dvh;
    border: var(--ake-border-width) solid var(--ake-color-border);
    border-radius: var(--ake-radius-md);
    box-shadow: var(--ake-shadow-dialog);
  }

  .research-toc.is-open,
  .research-toc-toggle {
    display: block;
  }

  .research-toc-toggle {
    display: inline-flex;
  }
}

@media (max-width: 48rem) {
  .research-module {
    grid-template-columns: minmax(0, 1fr);
  }

  .research-sidebar {
    display: none;
  }

  .research-mobile-list-button {
    display: inline-flex;
  }

  .research-toc-toggle {
    bottom: 8.125rem;
  }

  .research-article {
    padding: var(--ake-space-4);
  }
}
</style>
