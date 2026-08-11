<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { ResponsiveDrawer } from '@ake/ui'
import {
  BookOpen,
  Camera,
  CalendarDays,
  Crosshair,
  Gauge,
  Info,
  Medal,
  Menu,
  MessagesSquare,
  Package,
  ScrollText,
  Settings,
  Shield,
  ShoppingCart,
  Skull,
  Sparkles,
  Swords,
  TowerControl,
  Users,
  Workflow,
  EyeOff,
  type LucideIcon
} from '@lucide/vue'
import { APP_MODULES } from './modules'
import { usePreferencesStore } from './stores/preferences'
import { useAppContext } from './providers/app-context'
import { downloadLongImage, exportTitle } from '../shared/export-long-image'

const iconByName: Readonly<Record<string, LucideIcon>> = {
  BookOpen,
  CalendarDays,
  Crosshair,
  Gauge,
  Info,
  Medal,
  MessagesSquare,
  Package,
  ScrollText,
  Settings,
  Shield,
  ShoppingCart,
  Skull,
  Sparkles,
  Swords,
  TowerControl,
  Users,
  Workflow,
  EyeOff
}

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const preferences = usePreferencesStore()
const { config, dataState } = useAppContext()
const mobileOpen = ref(false)
const exporting = ref(false)
const exportFailed = ref(false)
const isPreRelease = computed(() => config.appversion.toLocaleLowerCase().includes('pre'))
const navigationModules = computed(() =>
  APP_MODULES.filter((module) => module.id !== 'settings' && (preferences.showHidden || !module.hidden))
)
const hostname = typeof location === 'undefined' ? 'localhost' : location.hostname || 'localhost'
const watermarkCells = Array.from({ length: 30 }, (_, index) => index)

watch(
  () => preferences.theme,
  (theme) => {
    document.documentElement.dataset.theme = theme
  },
  { immediate: true }
)

watch(
  () => route.fullPath,
  () => {
    mobileOpen.value = false
  }
)

watch(
  () => preferences.showHidden,
  (showHidden) => {
    const module = APP_MODULES.find((entry) => entry.id === route.params.moduleId)
    if (!showHidden && module?.hidden) void router.push({ name: 'home' })
  }
)

async function exportCurrentPage(): Promise<void> {
  if (exporting.value) return
  const element = document.querySelector<HTMLElement>('.app-main > *')
  if (!element) return
  const moduleId = String(route.params.moduleId ?? '')
  const module = APP_MODULES.find((entry) => entry.id === moduleId)
  const fallback = module ? String(t(module.titleKey)) : String(t('home.title'))
  exporting.value = true
  exportFailed.value = false
  try {
    await downloadLongImage(element, exportTitle(element, fallback))
  } catch {
    exportFailed.value = true
  } finally {
    exporting.value = false
  }
}
</script>

<template>
  <div class="app-shell">
    <div v-if="isPreRelease" class="beta-watermark" aria-hidden="true">
      <div v-for="cell in watermarkCells" :key="cell" class="beta-watermark__cell">
        <span>{{ hostname }}</span>
        <span>{{ t('beta.warning') }}</span>
      </div>
    </div>

    <header class="mobile-header">
      <ResponsiveDrawer
        v-model:open="mobileOpen"
        :title="t('app.navigation')"
        :description="t('app.navigationDescription')"
        :close-label="t('common.close')"
        side="left"
      >
        <template #trigger>
          <button class="icon-button" type="button" :aria-label="t('app.openNavigation')">
            <Menu :size="20" aria-hidden="true" />
          </button>
        </template>

        <nav class="mobile-module-navigation" :aria-label="t('app.navigation')">
          <RouterLink
            v-for="module in navigationModules"
            :key="module.id"
            class="module-link"
            :to="{ name: 'module', params: { moduleId: module.id } }"
            @click="mobileOpen = false"
          >
            <component :is="iconByName[module.icon]" :size="18" aria-hidden="true" />
            <span>{{ t(module.titleKey) }}</span>
          </RouterLink>
        </nav>

        <template #footer>
          <div class="mobile-drawer-footer">
            <button
              v-if="preferences.showExport"
              class="export-link"
              type="button"
              :aria-label="t('common.export')"
              :aria-busy="exporting"
              @click="exportCurrentPage"
            >
              <Camera :size="18" aria-hidden="true" />
              <span>{{ t('common.export') }}</span>
            </button>
            <RouterLink
              class="settings-link"
              :to="{ name: 'module', params: { moduleId: 'settings' } }"
              @click="mobileOpen = false"
            >
              <Settings :size="18" aria-hidden="true" />
              <span>{{ t('settings.title') }}</span>
            </RouterLink>
            <div class="version-lines">
              <span>{{ config.appversion }}</span>
              <span>{{ dataState.selected.gameVersion }} · {{ dataState.selected.hotfixVersion }}</span>
            </div>
          </div>
        </template>
      </ResponsiveDrawer>
      <RouterLink class="mobile-brand" :to="{ name: 'home' }">
        AKEData <small>{{ isPreRelease ? t('app.beta') : t('app.wiki') }}</small>
      </RouterLink>
      <RouterLink
        class="icon-button"
        :to="{ name: 'module', params: { moduleId: 'settings' } }"
        :aria-label="t('settings.title')"
      >
        <Settings :size="20" aria-hidden="true" />
      </RouterLink>
    </header>

    <aside class="app-sidebar" :aria-label="t('app.navigation')">
      <div class="sidebar-head">
        <RouterLink class="brand" :to="{ name: 'home' }">
          <span>AKEData</span>
          <small>{{ isPreRelease ? t('app.beta') : t('app.wiki') }}</small>
        </RouterLink>
      </div>

      <nav class="module-navigation">
        <RouterLink
          v-for="module in navigationModules"
          :key="module.id"
          class="module-link"
          :to="{ name: 'module', params: { moduleId: module.id } }"
        >
          <component :is="iconByName[module.icon]" :size="18" aria-hidden="true" />
          <span>{{ t(module.titleKey) }}</span>
        </RouterLink>
      </nav>

      <footer class="sidebar-footer">
        <button
          v-if="preferences.showExport"
          class="export-link"
          type="button"
          :aria-label="t('common.export')"
          :aria-busy="exporting"
          @click="exportCurrentPage"
        >
          <Camera :size="18" aria-hidden="true" />
          <span>{{ t('common.export') }}</span>
        </button>
        <RouterLink class="settings-link" :to="{ name: 'module', params: { moduleId: 'settings' } }">
          <Settings :size="18" aria-hidden="true" />
          <span>{{ t('settings.title') }}</span>
        </RouterLink>
        <div class="version-lines">
          <span>{{ config.appversion }}</span>
          <span>{{ dataState.selected.gameVersion }} · {{ dataState.selected.hotfixVersion }}</span>
        </div>
      </footer>
    </aside>

    <main class="app-main">
      <RouterView v-slot="{ Component }">
        <KeepAlive :max="6">
          <component :is="Component" :key="String(route.params.moduleId ?? route.name)" />
        </KeepAlive>
      </RouterView>
    </main>
    <span v-if="exportFailed" class="visually-hidden" role="alert">{{ t('errors.exportFailed') }}</span>
  </div>
</template>
