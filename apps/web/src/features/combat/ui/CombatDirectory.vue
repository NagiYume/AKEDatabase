<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { ChevronDown, ChevronRight, Search } from '@lucide/vue'
import { EmptyState, ErrorState, ImageWithFallback, LoadingState, SearchToolbar } from '@ake/ui'
import { useAppContext } from '../../../app/providers/app-context'
import type { CombatDomain } from '@ake/combat-graph'
import type { CombatDirectoryGroup, CombatDirectoryOwner, CombatDirectorySection } from './legacy-layout'

const props = defineProps<{
  domain: CombatDomain
  sections: readonly CombatDirectorySection[]
  selectedId: string
  search: string
  expandedOwners: ReadonlySet<string>
  expandedGroups: ReadonlySet<string>
  loading?: boolean
  error?: boolean
}>()

const emit = defineEmits<{
  'update:search': [value: string]
  select: [id: string]
  retry: []
  toggleOwner: [id: string]
  toggleGroup: [id: string]
}>()

const { client } = useAppContext()
const { t } = useI18n({
  useScope: 'local',
  inheritLocale: true,
  fallbackLocale: 'EN',
  messages: {
    EN: {
      directory: {
        skillTitle: 'Skill list',
        buffTitle: 'Buff directory',
        meta: '{count} entries · grouped by owner',
        searchSkill: 'Search skills, owners, or groups',
        searchBuff: 'Search Buffs or owners',
        groups: {
          characters: 'Characters',
          monsters: 'Enemies',
          weapons: 'Weapons',
          equipment: 'Equipment',
          abilityEntities: 'Ability entities',
          modes: 'Modes and stages',
          common: 'Common',
          other: 'Other'
        }
      }
    },
    CH: {
      directory: {
        skillTitle: '技能列表',
        buffTitle: 'Buff目录',
        meta: '共 {count} 项 · 按归属分组',
        searchSkill: '搜索技能、角色或技能组',
        searchBuff: '搜索 Buff 或归属',
        groups: {
          characters: '角色',
          monsters: '怪物',
          weapons: '武器',
          equipment: '装备',
          abilityEntities: '能力实体',
          modes: '模式与关卡',
          common: '通用',
          other: '其他'
        }
      }
    }
  }
})

const title = computed(() => t(props.domain === 'skill' ? 'directory.skillTitle' : 'directory.buffTitle'))
const itemCount = computed(() => props.sections.reduce((total, section) => total + section.itemCount, 0))
const searchModel = computed({
  get: () => props.search,
  set: (value: string) => emit('update:search', value)
})

function sectionLabel(id: string): string {
  return t(`directory.groups.${id}`)
}

function ownerCount(owner: CombatDirectoryOwner): number {
  return owner.groups.reduce((total, group) => total + group.items.length, 0)
}

function isOwnerOpen(owner: CombatDirectoryOwner): boolean {
  return Boolean(props.search.trim()) || props.expandedOwners.has(owner.id)
}

function groupKey(owner: CombatDirectoryOwner, group: CombatDirectoryGroup): string {
  return `${owner.id}:${group.id}`
}

function isGroupOpen(owner: CombatDirectoryOwner, group: CombatDirectoryGroup): boolean {
  return Boolean(props.search.trim()) || props.expandedGroups.has(groupKey(owner, group))
}

function ownerName(owner: CombatDirectoryOwner): string {
  return owner.name || sectionLabel(owner.sectionId)
}

function imageUrl(path: string): string {
  return path ? client.resolveImageUrl(path) : ''
}

function groupIconUrl(iconId: string): string {
  if (!iconId) return ''
  return iconId.startsWith('/')
    ? client.resolveImageUrl(iconId.slice(1))
    : client.resolveImageUrl(
        `public/images/assets/beyond/dynamicassets/gameplay/ui/sprites/skillicon/${iconId}.png`
      )
}
</script>

<template>
  <div class="combat-directory" :aria-label="title">
    <header class="combat-directory__header">
      <strong>{{ title }}</strong>
      <small>{{ t('directory.meta', { count: itemCount }) }}</small>
    </header>

    <SearchToolbar
      v-model="searchModel"
      class="combat-directory__search"
      :ariaLabel="title"
      :clear-label="$t('common.clear')"
      :placeholder="t(domain === 'skill' ? 'directory.searchSkill' : 'directory.searchBuff')"
    >
      <template #icon><Search :size="16" aria-hidden="true" /></template>
    </SearchToolbar>

    <LoadingState v-if="loading" compact :label="$t('common.loading')" />
    <ErrorState
      v-else-if="error"
      compact
      :title="$t('common.error')"
      :retry-label="$t('common.retry')"
      @retry="emit('retry')"
    />
    <EmptyState v-else-if="sections.length === 0" compact :title="$t('common.empty')" />

    <nav v-else class="combat-directory__sections" :aria-label="title">
      <section v-for="section in sections" :key="section.id" class="combat-directory__section">
        <h2>
          <span>{{ sectionLabel(section.id) }}</span>
          <small>{{ section.itemCount }}</small>
        </h2>

        <div v-for="owner in section.owners" :key="owner.id" class="combat-directory__owner">
          <button
            type="button"
            class="combat-directory__owner-toggle"
            :aria-expanded="isOwnerOpen(owner)"
            @click="emit('toggleOwner', owner.id)"
          >
            <span class="combat-directory__disclosure" aria-hidden="true">
              <ChevronDown v-if="isOwnerOpen(owner)" :size="15" />
              <ChevronRight v-else :size="15" />
            </span>
            <ImageWithFallback
              v-if="owner.iconPath"
              class="combat-directory__owner-icon"
              :src="imageUrl(owner.iconPath)"
              :alt="ownerName(owner)"
              width="34"
              height="34"
              loading="lazy"
            />
            <span v-else class="combat-directory__owner-placeholder" aria-hidden="true">
              {{ ownerName(owner).slice(0, 1) }}
            </span>
            <span class="combat-directory__owner-copy">
              <strong>{{ ownerName(owner) }}</strong>
              <small v-if="owner.secondaryName">{{ owner.secondaryName }}</small>
            </span>
            <span class="combat-directory__badge">{{ ownerCount(owner) }}</span>
          </button>

          <div v-if="isOwnerOpen(owner)" class="combat-directory__owner-items">
            <div v-for="group in owner.groups" :key="group.id" class="combat-directory__group">
              <button
                v-if="domain === 'skill' && group.name"
                type="button"
                class="combat-directory__group-toggle"
                :aria-expanded="isGroupOpen(owner, group)"
                @click="emit('toggleGroup', groupKey(owner, group))"
              >
                <span class="combat-directory__disclosure" aria-hidden="true">
                  <ChevronDown v-if="isGroupOpen(owner, group)" :size="14" />
                  <ChevronRight v-else :size="14" />
                </span>
                <ImageWithFallback
                  v-if="group.iconId"
                  class="combat-directory__group-icon"
                  :src="groupIconUrl(group.iconId)"
                  :alt="group.name"
                  width="26"
                  height="26"
                />
                <span>{{ group.name }}</span>
                <small>{{ group.items.length }}</small>
              </button>

              <div v-if="!group.name || isGroupOpen(owner, group)" class="combat-directory__items">
                <button
                  v-for="item in group.items"
                  :key="item.id"
                  type="button"
                  class="combat-directory__item"
                  :class="{ 'is-active': item.id === selectedId }"
                  :aria-current="item.id === selectedId ? 'page' : undefined"
                  @click="emit('select', item.id)"
                >
                  <span class="combat-directory__item-icon" aria-hidden="true">
                    {{ item.displayName.slice(0, 1) }}
                  </span>
                  <span>
                    <strong>{{ item.displayName }}</strong>
                    <small>{{ item.id }}</small>
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </nav>
  </div>
</template>

<style scoped>
.combat-directory {
  display: grid;
  min-width: 0;
  align-content: start;
  background: var(--ake-color-surface);
}

.combat-directory__header {
  display: grid;
  gap: 0.2rem;
  padding: var(--ake-space-4);
  border-block-end: var(--ake-border-width) solid var(--ake-color-border);
}

.combat-directory__header strong {
  font-size: var(--ake-font-size-lg);
}

.combat-directory__header small,
.combat-directory__section h2 small,
.combat-directory__owner-copy small,
.combat-directory__group-toggle small,
.combat-directory__item small {
  color: var(--ake-color-text-muted);
  font-size: var(--ake-font-size-xs);
}

.combat-directory__search {
  margin: var(--ake-space-3);
}

.combat-directory__sections,
.combat-directory__owner-items,
.combat-directory__items {
  display: grid;
}

.combat-directory__section h2 {
  display: flex;
  min-height: 2rem;
  align-items: center;
  justify-content: space-between;
  gap: var(--ake-space-2);
  margin: 0;
  padding: var(--ake-space-2) var(--ake-space-3);
  border-block: var(--ake-border-width) solid var(--ake-color-border);
  color: var(--ake-color-text-muted);
  background: var(--ake-color-surface-muted);
  font-size: var(--ake-font-size-xs);
  text-transform: uppercase;
}

.combat-directory__owner-toggle,
.combat-directory__group-toggle,
.combat-directory__item {
  width: 100%;
  min-width: 0;
  border: 0;
  color: var(--ake-color-text);
  background: transparent;
  text-align: start;
  cursor: pointer;
}

.combat-directory__owner-toggle {
  display: grid;
  grid-template-columns: 1rem 2.125rem minmax(0, 1fr) auto;
  min-height: 3.5rem;
  align-items: center;
  gap: var(--ake-space-2);
  padding: var(--ake-space-2) var(--ake-space-3);
  border-block-end: var(--ake-border-width) solid var(--ake-color-border);
}

.combat-directory__owner-toggle:hover,
.combat-directory__group-toggle:hover,
.combat-directory__item:hover,
.combat-directory__item.is-active {
  background: var(--ake-color-surface-hover);
}

.combat-directory__owner-icon,
.combat-directory__owner-placeholder {
  width: 2.125rem;
  height: 2.125rem;
}

.combat-directory__owner-placeholder,
.combat-directory__item-icon {
  display: grid;
  place-items: center;
  border: var(--ake-border-width) solid var(--ake-color-border);
  border-radius: var(--ake-radius-sm);
  color: var(--ake-color-accent);
  background: var(--ake-color-surface-muted);
  font-size: var(--ake-font-size-xs);
  font-weight: 700;
}

.combat-directory__owner-copy {
  display: grid;
  min-width: 0;
  gap: 1px;
}

.combat-directory__owner-copy strong,
.combat-directory__owner-copy small,
.combat-directory__group-toggle span,
.combat-directory__item strong,
.combat-directory__item small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.combat-directory__badge {
  min-width: 1.5rem;
  padding: 0.1rem 0.35rem;
  border-radius: var(--ake-radius-sm);
  color: var(--ake-color-text-muted);
  background: var(--ake-color-surface-muted);
  font-size: var(--ake-font-size-xs);
  text-align: center;
}

.combat-directory__disclosure {
  display: grid;
  place-items: center;
  color: var(--ake-color-text-muted);
}

.combat-directory__group-toggle {
  display: grid;
  grid-template-columns: 1rem 1.625rem minmax(0, 1fr) auto;
  min-height: 2.75rem;
  align-items: center;
  gap: var(--ake-space-2);
  padding: var(--ake-space-2) var(--ake-space-3) var(--ake-space-2) var(--ake-space-5);
  border-block-end: var(--ake-border-width) solid var(--ake-color-border);
}

.combat-directory__group-icon {
  width: 1.625rem;
  height: 1.625rem;
}

.combat-directory__item {
  display: grid;
  grid-template-columns: 1.625rem minmax(0, 1fr);
  min-height: 3rem;
  align-items: center;
  gap: var(--ake-space-2);
  padding: var(--ake-space-2) var(--ake-space-3) var(--ake-space-2) var(--ake-space-6);
  border-block-end: var(--ake-border-width) solid var(--ake-color-border);
}

.combat-directory__item.is-active {
  box-shadow: inset 3px 0 var(--ake-color-accent);
}

.combat-directory__item > span:last-child {
  display: grid;
  min-width: 0;
  gap: 1px;
}

.combat-directory__item-icon {
  width: 1.625rem;
  height: 1.625rem;
}
</style>
