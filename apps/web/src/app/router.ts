import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import type { usePreferencesStore } from './stores/preferences'
import { APP_MODULE_BY_ID, DISABLED_MODULE_IDS, isModuleId } from './modules'

type PreferencesStore = ReturnType<typeof usePreferencesStore>

const routes: RouteRecordRaw[] = [
  { path: '/', name: 'home', component: () => import('../pages/OverviewPage.vue') },
  {
    path: '/module/:moduleId/:entityId',
    redirect: (to) => ({
      name: 'module',
      params: { moduleId: to.params.moduleId },
      query: { ...to.query, id: String(to.params.entityId) }
    })
  },
  {
    path: '/m/:moduleId/:entityId?',
    redirect: (to) => {
      const entityId = to.params.entityId
      return {
        name: 'module',
        params: { moduleId: to.params.moduleId },
        query: {
          ...to.query,
          ...(typeof entityId === 'string' && entityId ? { id: entityId } : {})
        }
      }
    }
  },
  {
    path: '/module/:moduleId',
    name: 'module',
    component: () => import('../pages/ModuleRoutePage.vue'),
    props: true
  },
  {
    path: '/not-found',
    name: 'not-found',
    component: () => import('../pages/NotFoundPage.vue'),
    props: (route) => ({ hidden: route.query.hidden === '1' })
  },
  { path: '/:pathMatch(.*)*', redirect: { name: 'not-found' } }
]

export function createAppRouter(preferences: PreferencesStore) {
  const router = createRouter({
    history: createWebHistory(),
    routes,
    scrollBehavior(to, from, savedPosition) {
      if (savedPosition) return savedPosition
      if (to.name === from.name && to.params.moduleId === from.params.moduleId) return false
      return { top: 0 }
    }
  })

  router.beforeEach((to) => {
    if (to.path === '/' && typeof to.query.plugin === 'string') {
      const legacyModule = to.query.plugin
      if (!isModuleId(legacyModule)) return { name: 'not-found', replace: true }
      const query = { ...to.query }
      delete query.plugin
      return {
        name: 'module',
        params: { moduleId: legacyModule },
        query,
        replace: true
      }
    }
    if (to.name !== 'module') return true
    const moduleId = String(to.params.moduleId ?? '')
    if ((DISABLED_MODULE_IDS as readonly string[]).includes(moduleId) || !isModuleId(moduleId))
      return { name: 'not-found', replace: true }
    const module = APP_MODULE_BY_ID.get(moduleId)
    if (module?.hidden && !preferences.showHidden)
      return { name: 'not-found', query: { hidden: '1' }, replace: true }
    return true
  })

  return router
}
