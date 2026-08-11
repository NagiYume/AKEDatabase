export type ModuleId =
  | 'settings'
  | 'v3_weapon'
  | 'v3_character'
  | 'v3_enemy'
  | 'v3_equip'
  | 'v3_item'
  | 'v3_shop'
  | 'v3_achievement'
  | 'v3_dungeon'
  | 'research'
  | 'about'
  | 'v3_activity'
  | 'baker'
  | 'v3_cc'
  | 'season_tower'
  | 'v3_skill'
  | 'v3_buff'
  | 'hidden-example'
  | 'v3_mission'

export interface AppModule {
  id: ModuleId
  titleKey: string
  descriptionKey: string
  priority: number
  sourceOrder: number
  icon: string
  hidden: boolean
}

export const DISABLED_MODULE_IDS = Object.freeze([
  'weapon',
  'v2_weapon',
  'character',
  'v2_character',
  'enemy',
  'v2_enemy',
  'equip',
  'v2_equip',
  'item',
  'v2_item',
  'achievement',
  'dungeon',
  'v2_dungeon',
  'activity',
  'v2_cc',
  'buff',
  'skill',
  'skill_v2',
  'spawn'
])

const modules: readonly AppModule[] = [
  {
    id: 'hidden-example',
    titleKey: 'modules.hidden.title',
    descriptionKey: 'modules.hidden.description',
    priority: 9998,
    sourceOrder: 0,
    icon: 'EyeOff',
    hidden: true
  },
  {
    id: 'settings',
    titleKey: 'modules.settings.title',
    descriptionKey: 'modules.settings.description',
    priority: 9999,
    sourceOrder: 1,
    icon: 'Settings',
    hidden: false
  },
  {
    id: 'v3_weapon',
    titleKey: 'modules.weapon.title',
    descriptionKey: 'modules.weapon.description',
    priority: 8,
    sourceOrder: 4,
    icon: 'Crosshair',
    hidden: false
  },
  {
    id: 'v3_character',
    titleKey: 'modules.character.title',
    descriptionKey: 'modules.character.description',
    priority: 7,
    sourceOrder: 7,
    icon: 'Users',
    hidden: false
  },
  {
    id: 'v3_enemy',
    titleKey: 'modules.enemy.title',
    descriptionKey: 'modules.enemy.description',
    priority: 9,
    sourceOrder: 10,
    icon: 'Skull',
    hidden: false
  },
  {
    id: 'v3_equip',
    titleKey: 'modules.equip.title',
    descriptionKey: 'modules.equip.description',
    priority: 10,
    sourceOrder: 13,
    icon: 'Shield',
    hidden: false
  },
  {
    id: 'v3_item',
    titleKey: 'modules.item.title',
    descriptionKey: 'modules.item.description',
    priority: 20,
    sourceOrder: 16,
    icon: 'Package',
    hidden: false
  },
  {
    id: 'v3_shop',
    titleKey: 'modules.shop.title',
    descriptionKey: 'modules.shop.description',
    priority: 19,
    sourceOrder: 17,
    icon: 'ShoppingCart',
    hidden: false
  },
  {
    id: 'v3_achievement',
    titleKey: 'modules.achievement.title',
    descriptionKey: 'modules.achievement.description',
    priority: 22,
    sourceOrder: 19,
    icon: 'Medal',
    hidden: false
  },
  {
    id: 'v3_dungeon',
    titleKey: 'modules.dungeon.title',
    descriptionKey: 'modules.dungeon.description',
    priority: 21,
    sourceOrder: 22,
    icon: 'Swords',
    hidden: false
  },
  {
    id: 'research',
    titleKey: 'modules.research.title',
    descriptionKey: 'modules.research.description',
    priority: 25,
    sourceOrder: 23,
    icon: 'BookOpen',
    hidden: false
  },
  {
    id: 'about',
    titleKey: 'modules.about.title',
    descriptionKey: 'modules.about.description',
    priority: 100,
    sourceOrder: 24,
    icon: 'Info',
    hidden: false
  },
  {
    id: 'v3_activity',
    titleKey: 'modules.activity.title',
    descriptionKey: 'modules.activity.description',
    priority: 11,
    sourceOrder: 26,
    icon: 'CalendarDays',
    hidden: false
  },
  {
    id: 'v3_mission',
    titleKey: 'modules.mission.title',
    descriptionKey: 'modules.mission.description',
    priority: 12,
    sourceOrder: 27,
    icon: 'ScrollText',
    hidden: true
  },
  {
    id: 'baker',
    titleKey: 'modules.baker.title',
    descriptionKey: 'modules.baker.description',
    priority: 23,
    sourceOrder: 28,
    icon: 'MessagesSquare',
    hidden: false
  },
  {
    id: 'v3_cc',
    titleKey: 'modules.cc.title',
    descriptionKey: 'modules.cc.description',
    priority: 24,
    sourceOrder: 30,
    icon: 'Gauge',
    hidden: false
  },
  {
    id: 'season_tower',
    titleKey: 'modules.seasonTower.title',
    descriptionKey: 'modules.seasonTower.description',
    priority: 2,
    sourceOrder: 31,
    icon: 'TowerControl',
    hidden: false
  },
  {
    id: 'v3_skill',
    titleKey: 'modules.combat.title',
    descriptionKey: 'modules.combat.description',
    priority: 10,
    sourceOrder: 35,
    icon: 'Workflow',
    hidden: false
  },
  {
    id: 'v3_buff',
    titleKey: 'modules.buff.title',
    descriptionKey: 'modules.buff.description',
    priority: 11,
    sourceOrder: 36,
    icon: 'Sparkles',
    hidden: false
  }
]

export const APP_MODULES = Object.freeze(
  modules.toSorted((left, right) => left.priority - right.priority || left.sourceOrder - right.sourceOrder)
)

export const APP_MODULE_BY_ID = new Map(APP_MODULES.map((module) => [module.id, module]))

export function isModuleId(value: unknown): value is ModuleId {
  return typeof value === 'string' && APP_MODULE_BY_ID.has(value as ModuleId)
}
