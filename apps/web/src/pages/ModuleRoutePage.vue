<script setup lang="ts">
import { computed, defineAsyncComponent, type Component } from 'vue'
import { useRoute } from 'vue-router'
import type { ModuleId } from '../app/modules'

const route = useRoute()

const loaders: Record<ModuleId, () => Promise<{ default: Component }>> = {
  settings: () => import('../features/settings/ui/SettingsPage.vue'),
  v3_weapon: () => import('../features/weapon/ui/WeaponPage.vue'),
  v3_character: () => import('../features/character/ui/CharacterPage.vue'),
  v3_enemy: () => import('../features/enemy/ui/EnemyPage.vue'),
  v3_equip: () => import('../features/equip/ui/EquipPage.vue'),
  v3_item: () => import('../features/item/ui/ItemPage.vue'),
  v3_shop: () => import('../features/shop/ui/ShopPage.vue'),
  v3_achievement: () => import('../features/achievement/ui/AchievementPage.vue'),
  v3_dungeon: () => import('../features/dungeon/ui/DungeonPage.vue'),
  research: () => import('../features/research/ui/ResearchPage.vue'),
  about: () => import('../features/about/ui/AboutPage.vue'),
  v3_activity: () => import('../features/activity/ui/ActivityPage.vue'),
  baker: () => import('../features/baker/ui/BakerPage.vue'),
  v3_cc: () => import('../features/cc/ui/CcPage.vue'),
  season_tower: () => import('../features/season-tower/ui/SeasonTowerPage.vue'),
  v3_skill: () => import('../features/skill/ui/SkillPage.vue'),
  v3_buff: () => import('../features/buff/ui/BuffPage.vue'),
  'hidden-example': () => import('../features/hidden/ui/HiddenPage.vue'),
  v3_mission: () => import('../features/mission/ui/MissionPage.vue')
}

const activeComponent = computed(() => {
  const moduleId = String(route.params.moduleId) as ModuleId
  return defineAsyncComponent(loaders[moduleId])
})
</script>

<template>
  <component :is="activeComponent" />
</template>
