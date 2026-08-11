<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useQueryClient } from '@tanstack/vue-query'
import { RefreshCw, RotateCcw, Trash2 } from '@lucide/vue'
import { LANGUAGE_INFO, type AppLocale } from '@ake/r2-contract'
import { Dialog, ModuleHeader, ModuleShell, Select, type SelectOption } from '@ake/ui'
import { useAppContext } from '../../../app/providers/app-context'
import { usePreferencesStore, type AppTheme } from '../../../app/stores/preferences'
import { userErrorMessageKey, type UserErrorMessageKey } from '../../../shared/i18n'

const i18n = useI18n()
const { t, locale } = i18n
const preferences = usePreferencesStore()
const context = useAppContext()
const queryClient = useQueryClient()
const saving = ref(false)
const refreshingCache = ref(false)
const error = ref<UserErrorMessageKey | ''>('')
const hiddenConfirmationOpen = ref(false)
const tokenText = ref(preferences.unlockedTokens.join(', '))
const draftBaseUrl = ref(preferences.dataBaseUrl || context.config.dataBaseUrl)
const versions = computed(() => context.dataState.value.manifest.versions)
const versionUpdatedBy = computed(() =>
  typeof context.config.updatedBy === 'string' && context.config.updatedBy.trim()
    ? ` (${context.config.updatedBy.trim()})`
    : ''
)
const localeOptions = computed<SelectOption[]>(() =>
  Object.entries(LANGUAGE_INFO).map(([value, info]) => ({ value, label: info.label }))
)
const versionOptions = computed<SelectOption[]>(() => [
  { value: 'latest', label: `latest · ${context.dataState.value.manifest.latest}` },
  ...versions.value.map((version) => ({
    value: version.id,
    label: `${version.gameVersion} · ${version.hotfixVersion}`
  }))
])
const themeOptions = computed<SelectOption[]>(() =>
  (['light', 'yellow', 'dark'] as AppTheme[]).map((value) => ({
    value,
    label: String(t(`settings.themes.${value}`))
  }))
)
const skillLevelText = computed({
  get: () => preferences.levels.skill.join(','),
  set: (value: string) => {
    preferences.levels.skill = [
      ...new Set(
        value
          .split(',')
          .map((entry) => Number(entry.trim()))
          .filter((entry) => Number.isInteger(entry) && entry >= 1 && entry <= 12)
      )
    ].toSorted((left, right) => left - right)
  }
})

async function applyDataSettings(): Promise<void> {
  saving.value = true
  error.value = ''
  try {
    await context.reconfigure({
      baseUrl: draftBaseUrl.value,
      selection: preferences.dataVersion,
      locale: preferences.locale
    })
    preferences.dataBaseUrl = draftBaseUrl.value === context.config.dataBaseUrl ? '' : draftBaseUrl.value
    await queryClient.invalidateQueries()
  } catch (reason) {
    error.value = userErrorMessageKey(reason)
  } finally {
    saving.value = false
  }
}

async function changeLocale(selected: string | undefined): Promise<void> {
  if (!selected || !(selected in LANGUAGE_INFO)) return
  const value = selected as AppLocale
  preferences.setLocale(value)
  await context.reconfigure({ locale: value })
  try {
    const payload = await context.client.getJson<{ messages?: Record<string, unknown> }>({
      kind: 'locale',
      path: `public/${LANGUAGE_INFO[value].directory}/i18n.json`
    })
    if (payload.messages) i18n.mergeLocaleMessage(value, payload.messages)
  } catch {
    // The bundled shell translations remain available while R2 is unreachable.
  }
  document.documentElement.lang = LANGUAGE_INFO[value].htmlLang
  locale.value = value
  await queryClient.invalidateQueries()
}

async function changeDataVersion(value: string | undefined): Promise<void> {
  if (!value || value === preferences.dataVersion) return
  preferences.dataVersion = value
  await applyDataSettings()
}

function changeTheme(theme: AppTheme): void {
  preferences.setTheme(theme)
}

function changeThemeValue(value: string | undefined): void {
  if (value === 'light' || value === 'yellow' || value === 'dark') changeTheme(value)
}

async function resetSource(): Promise<void> {
  preferences.resetDataSource()
  draftBaseUrl.value = context.config.dataBaseUrl
  await applyDataSettings()
}

function requestHiddenChange(event: Event): void {
  const input = event.target as HTMLInputElement
  if (input.checked && !preferences.showHidden) {
    input.checked = false
    hiddenConfirmationOpen.value = true
    return
  }
  preferences.showHidden = false
}

function confirmHidden(): void {
  preferences.showHidden = true
  hiddenConfirmationOpen.value = false
}

function applyTokens(): void {
  preferences.unlockedTokens = [
    ...new Set(
      tokenText.value
        .split(',')
        .map((token) => token.trim())
        .filter(Boolean)
    )
  ]
  tokenText.value = preferences.unlockedTokens.join(', ')
}

function clearTokens(): void {
  preferences.unlockedTokens = []
  tokenText.value = ''
}

async function resetAllSettings(): Promise<void> {
  preferences.resetAll()
  draftBaseUrl.value = context.config.dataBaseUrl
  tokenText.value = ''
  document.documentElement.dataset.theme = preferences.theme
  await applyDataSettings()
  await changeLocale(preferences.locale)
}

async function forceRefreshCache(): Promise<void> {
  if (refreshingCache.value) return
  refreshingCache.value = true
  await context.client.clearCache()
  queryClient.clear()
  window.location.reload()
}
</script>

<template>
  <ModuleShell>
    <template #header>
      <ModuleHeader :title="t('settings.heading')" />
    </template>

    <div class="settings-band settings-band--legacy" data-settings-section="global">
      <div class="field-row">
        <span>{{ t('settings.language') }}</span>
        <Select
          :model-value="preferences.locale"
          :options="localeOptions"
          :ariaLabel="t('settings.language')"
          @update:model-value="changeLocale"
        />
      </div>
      <div class="field-row">
        <span>{{ t('settings.theme') }}</span>
        <Select
          :model-value="preferences.theme"
          :options="themeOptions"
          :ariaLabel="t('settings.theme')"
          @update:model-value="changeThemeValue"
        />
      </div>
      <label class="toggle-row"
        ><input :checked="preferences.showHidden" type="checkbox" @change="requestHiddenChange" /><span>{{
          t('settings.showHidden')
        }}</span></label
      >
      <label class="toggle-row"
        ><input v-model="preferences.showExport" type="checkbox" /><span>{{
          t('settings.showExport')
        }}</span></label
      >
      <label class="toggle-row"
        ><input v-model="preferences.showVersionChanges" type="checkbox" /><span>{{
          t('settings.showVersionChanges')
        }}</span></label
      >
      <label class="toggle-row"
        ><input type="checkbox" checked disabled /><span>{{ t('settings.keepUrlSync') }}</span></label
      >
    </div>

    <div class="settings-band" data-settings-section="data-source">
      <h2>{{ t('settings.dataSource.title') }}</h2>
      <div class="field-row">
        <span>{{ t('settings.dataSource.version') }}</span>
        <Select
          :model-value="preferences.dataVersion"
          :options="versionOptions"
          :ariaLabel="t('settings.dataSource.version')"
          @update:model-value="changeDataVersion"
        />
      </div>
      <label class="field-row field-row--stack">
        <span>{{ t('settings.dataSource.baseUrl') }}</span>
        <div class="inline-field">
          <input v-model.trim="draftBaseUrl" type="url" inputmode="url" @change="applyDataSettings" />
          <button
            class="icon-button"
            type="button"
            :aria-label="t('settings.dataSource.reset')"
            @click="resetSource"
          >
            <RotateCcw :size="18" aria-hidden="true" />
          </button>
        </div>
      </label>
      <p v-if="error" class="field-error" role="alert">{{ t(error) }}</p>
      <p v-if="saving" class="quiet-status" aria-live="polite">{{ t('common.loading') }}</p>
    </div>

    <div class="settings-band" data-settings-section="levels">
      <h2>{{ t('settings.levels.title') }}</h2>
      <label class="toggle-row"
        ><input v-model="preferences.levels.enabled" type="checkbox" /><span>{{
          t('settings.levels.enabled')
        }}</span></label
      >
      <p class="quiet-status">{{ t('settings.levels.hint') }}</p>
      <label class="field-row"
        ><span>{{ t('settings.levels.character') }}</span
        ><input v-model="preferences.levels.character" :placeholder="t('settings.levels.levelPlaceholder')"
      /></label>
      <label class="field-row"
        ><span>{{ t('settings.levels.weapon') }}</span
        ><input v-model="preferences.levels.weapon" :placeholder="t('settings.levels.levelPlaceholder')"
      /></label>
      <label class="field-row"
        ><span>{{ t('settings.levels.enemy') }}</span
        ><input v-model="preferences.levels.enemy" :placeholder="t('settings.levels.levelPlaceholder')"
      /></label>
      <label class="field-row"
        ><span>{{ t('settings.levels.skill') }}</span
        ><input v-model="skillLevelText" :placeholder="t('settings.levels.skillPlaceholder')"
      /></label>
      <div class="settings-actions">
        <button class="command-button" type="button" @click="resetAllSettings">
          <RotateCcw :size="17" aria-hidden="true" />
          <span>{{ t('settings.reset') }}</span>
        </button>
      </div>
    </div>

    <div class="settings-band" data-settings-section="tokens">
      <h2>{{ t('settings.tokens.title') }}</h2>
      <p class="quiet-status">{{ t('settings.tokens.hint') }}</p>
      <label class="field-row">
        <span>{{ t('settings.tokens.label') }}</span>
        <div class="inline-field">
          <input v-model="tokenText" autocomplete="off" :placeholder="t('settings.tokens.placeholder')" />
          <button class="command-button" type="button" @click="applyTokens">
            {{ t('settings.tokens.submit') }}
          </button>
        </div>
      </label>
      <div class="settings-actions">
        <button
          class="command-button"
          type="button"
          :disabled="preferences.unlockedTokens.length === 0"
          @click="clearTokens"
        >
          <Trash2 :size="17" aria-hidden="true" />
          <span>{{ t('settings.tokens.clear') }}</span>
        </button>
      </div>
      <p class="quiet-status">
        {{ t('settings.tokens.count', { count: preferences.unlockedTokens.length }) }}
      </p>
    </div>

    <div class="settings-band" data-settings-section="cache">
      <button class="command-button" type="button" :disabled="refreshingCache" @click="forceRefreshCache">
        <RefreshCw :size="17" aria-hidden="true" />
        <span>{{ refreshingCache ? t('settings.cache.refreshing') : t('settings.cache.forceRefresh') }}</span>
      </button>
      <p class="quiet-status">{{ t('settings.cache.description') }}</p>
    </div>

    <div class="settings-band settings-version-info" data-settings-section="version">
      <p>{{ t('version.appLine', { version: context.config.appversion }) }}</p>
      <p>{{ t('version.gameLine', { version: context.dataState.value.selected.gameVersion }) }}</p>
      <p>{{ t('version.hotfixLine', { version: context.dataState.value.selected.hotfixVersion }) }}</p>
      <p>
        {{
          t('version.updatedLine', {
            updatedAt: context.config.updatedAt ?? '-',
            updatedBy: versionUpdatedBy
          })
        }}
      </p>
    </div>

    <Dialog
      v-model:open="hiddenConfirmationOpen"
      :title="t('settings.showHidden')"
      :description="t('settings.showHiddenConfirm')"
      :close-label="t('common.close')"
      size="sm"
    >
      <template #footer>
        <button class="command-button" type="button" @click="hiddenConfirmationOpen = false">
          {{ t('common.cancel') }}
        </button>
        <button class="command-button" type="button" @click="confirmHidden">
          {{ t('common.confirm') }}
        </button>
      </template>
    </Dialog>
  </ModuleShell>
</template>

<style scoped>
.settings-band--legacy {
  border-block-start: 0;
}

.settings-actions {
  display: flex;
  justify-content: flex-end;
  margin-block-start: var(--ake-space-4);
}

.settings-version-info p {
  margin: var(--ake-space-1) 0;
  color: var(--ake-color-text-muted);
}

@media (max-width: 40rem) {
  .settings-actions,
  .settings-actions .command-button {
    width: 100%;
  }
}
</style>
