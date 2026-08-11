<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Check, KeyRound, LockKeyhole, ShieldAlert, Swords } from '@lucide/vue'
import { ImageWithFallback } from '@ake/ui'
import type { AppLocale } from '@ake/r2-contract'
import { useAppContext } from '../../../app/providers/app-context'
import type { CcContractTerm, CcTermAvailability } from '../model'
import { ccCopy, type CcCopyKey } from './copy'

const props = defineProps<{
  term: CcContractTerm
  selected: boolean
  availability: CcTermAvailability
  heldKeys: ReadonlySet<string>
  conflictWith: string
}>()

const emit = defineEmits<{ toggle: [id: string] }>()

const { client } = useAppContext()
const { locale, t, te } = useI18n()

function tr(key: CcCopyKey, params: Readonly<Record<string, string | number>> = {}): string {
  const path = `modules.cc.${key}`
  return te(path) ? String(t(path, params)) : ccCopy(locale.value as AppLocale, key, params)
}

function iconUrl(id: string): string {
  return client.resolveImageUrl(
    `public/images/assets/beyond/dynamicassets/gameplay/ui/sprites/contingencycontract/buff/${id}.png`
  )
}

function termType(type: number | string): string {
  if (Number(type) === 1) return tr('termTypes.enemyBuff')
  if (Number(type) === 2) return tr('termTypes.selfDebuff')
  if (Number(type) === 3) return tr('termTypes.timeReduction')
  return tr('termTypes.none')
}

function parameterValue(value: string | number): string {
  if (typeof value !== 'number') return value
  if (Number.isInteger(value)) return String(value)
  return `${Number((value * 100).toFixed(1))}%`
}

const lockReason = computed(() => {
  if (props.availability.reason === 'missing') return tr('conflicts.tagMissing')
  if (props.availability.reason === 'conflict') {
    return tr('conflicts.withTag', {
      tag: props.availability.conflictWith,
      conflict: props.term.conflictId
    })
  }
  if (props.availability.reason === 'keys') {
    return tr('conflicts.missingKeys', { keys: props.availability.missingKeys.join(', ') })
  }
  return ''
})
</script>

<template>
  <button
    type="button"
    class="cc-term"
    :class="{
      'is-selected': selected,
      'is-selectable': availability.selectable && !selected,
      'is-locked': !availability.selectable && !selected
    }"
    :disabled="!availability.selectable && !selected"
    :aria-pressed="selected"
    :aria-label="tr('contract.toggle', { name: term.name })"
    :aria-describedby="lockReason ? `cc-lock-${term.id}` : undefined"
    :data-term-id="term.id"
    @click="emit('toggle', term.id)"
  >
    <span class="cc-term-header">
      <span class="cc-term-check" aria-hidden="true"><Check v-if="selected" :size="14" /></span>
      <ImageWithFallback
        v-if="term.iconId"
        class="cc-term-icon"
        :src="iconUrl(term.iconId)"
        :alt="term.name"
        width="32"
        height="32"
      >
        <template #fallback><ShieldAlert :size="18" aria-hidden="true" /></template>
      </ImageWithFallback>
      <span class="cc-term-name">{{ term.name }}</span>
      <span v-if="term.roman" class="cc-term-roman">{{ term.roman }}</span>
      <span class="cc-term-score">+{{ term.score }}</span>
    </span>

    <span v-if="term.description" class="cc-term-description">{{ term.description }}</span>

    <span v-if="term.effects.length" class="cc-term-effects">
      <span v-for="(effect, index) in term.effects" :key="`${term.id}:${index}`" class="cc-term-effect">
        <b>{{ termType(effect.type) }}</b>
        <code v-if="effect.buffId">{{ effect.buffId }}</code>
        <span v-for="parameter in effect.parameters" :key="parameter.key">
          {{ parameter.key }}: {{ parameterValue(parameter.value) }}
        </span>
      </span>
    </span>

    <span
      v-if="term.keyId || term.lockIds.length || term.conflictId || !term.canPreview"
      class="cc-term-meta"
    >
      <span v-if="term.keyId" class="cc-term-badge is-key" :class="{ 'is-held': heldKeys.has(term.keyId) }">
        <KeyRound :size="12" aria-hidden="true" />{{ tr('contract.key', { key: term.keyId }) }}
      </span>
      <span
        v-for="key in term.lockIds"
        :key="key"
        class="cc-term-badge is-lock"
        :class="{ 'is-held': heldKeys.has(key) }"
      >
        <LockKeyhole :size="12" aria-hidden="true" />{{ tr('contract.requires', { key }) }}
      </span>
      <span v-if="term.conflictId" class="cc-term-badge is-conflict" :class="{ 'is-active': conflictWith }">
        <Swords :size="12" aria-hidden="true" />
        {{
          conflictWith
            ? tr('contract.conflictWith', { conflict: term.conflictId, tag: conflictWith })
            : tr('contract.conflict', { conflict: term.conflictId })
        }}
      </span>
      <span v-if="!term.canPreview" class="cc-term-badge is-preview">
        <LockKeyhole :size="12" aria-hidden="true" />{{ tr('contract.previewUnavailable') }}
      </span>
    </span>

    <span v-if="term.formationTip" class="cc-term-tip">{{ term.formationTip }}</span>
    <span v-if="term.battleTip" class="cc-term-tip">{{ term.battleTip }}</span>
    <span v-if="lockReason" :id="`cc-lock-${term.id}`" class="cc-term-lock-reason">{{ lockReason }}</span>
  </button>
</template>

<style scoped>
.cc-term {
  display: block;
  width: 100%;
  margin: 0 0 var(--ake-space-2);
  padding: var(--ake-space-3);
  border: 2px solid var(--ake-color-border);
  border-radius: var(--ake-radius-sm);
  color: var(--ake-color-text);
  background: var(--ake-color-surface);
  text-align: left;
  cursor: pointer;
}

.cc-term.is-selectable:hover {
  border-color: var(--ake-color-accent);
  box-shadow: var(--ake-shadow-sm);
}

.cc-term.is-selected {
  border-color: var(--ake-color-success, #21875a);
  background: var(--ake-color-success-soft);
}

.cc-term.is-locked {
  border-style: dashed;
  opacity: 0.58;
  cursor: not-allowed;
}

.cc-term-header {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: var(--ake-space-2);
}

.cc-term-check {
  display: grid;
  width: 22px;
  height: 22px;
  flex: 0 0 auto;
  place-items: center;
  border: 2px solid var(--ake-color-border-strong);
  border-radius: 50%;
}

.is-selected .cc-term-check {
  border-color: var(--ake-color-success, #21875a);
  color: white;
  background: var(--ake-color-success, #21875a);
}

.cc-term-icon {
  width: 32px;
  height: 32px;
  flex: 0 0 auto;
}

.cc-term-name {
  min-width: 0;
  flex: 1;
  overflow: hidden;
  font-size: 0.9rem;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cc-term-roman,
.cc-term-score {
  flex: 0 0 auto;
  font-size: 0.76rem;
  font-weight: 700;
}

.cc-term-roman {
  padding: 1px 6px;
  border-radius: var(--ake-radius-xs, 3px);
  color: var(--ake-color-accent);
  background: var(--ake-color-surface-hover);
}

.cc-term-score {
  color: var(--ake-color-warning, #ad6100);
}

.cc-term-description,
.cc-term-effects,
.cc-term-meta,
.cc-term-tip,
.cc-term-lock-reason {
  display: flex;
  margin-top: var(--ake-space-2);
}

.cc-term-description,
.cc-term-tip {
  color: var(--ake-color-text-muted);
  font-size: 0.78rem;
  line-height: 1.45;
  white-space: pre-line;
}

.cc-term-effects {
  flex-direction: column;
  gap: var(--ake-space-1);
}

.cc-term-effect {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--ake-space-2);
  padding: 4px 8px;
  border-radius: var(--ake-radius-sm);
  background: var(--ake-color-surface-muted);
  font-size: 0.72rem;
}

.cc-term-effect code {
  overflow-wrap: anywhere;
}

.cc-term-meta {
  flex-wrap: wrap;
  gap: var(--ake-space-1);
}

.cc-term-badge {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 2px 7px;
  border: var(--ake-border-width) solid var(--ake-color-border-strong);
  border-radius: 999px;
  color: var(--ake-color-text-muted);
  font-size: 0.68rem;
}

.cc-term-badge.is-key,
.cc-term-badge.is-lock.is-held {
  border-color: var(--ake-color-success, #21875a);
  color: var(--ake-color-success, #21875a);
}

.cc-term-badge.is-lock {
  border-color: var(--ake-color-danger, #c83b3b);
  color: var(--ake-color-danger, #c83b3b);
}

.cc-term-badge.is-conflict {
  border-color: var(--ake-color-warning, #ad6100);
  color: var(--ake-color-warning, #ad6100);
}

.cc-term-badge.is-conflict.is-active,
.cc-term-lock-reason {
  color: var(--ake-color-danger, #c83b3b);
}

.cc-term-lock-reason {
  padding: 4px 8px;
  border-radius: var(--ake-radius-sm);
  background: var(--ake-color-danger-soft);
  font-size: 0.72rem;
}
</style>
