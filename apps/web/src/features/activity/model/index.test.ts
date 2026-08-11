import { describe, expect, it } from 'vitest'
import type { TableSet } from '@ake/domain'
import {
  ACTIVITY_TABLE_NAMES,
  buildActivityCatalog,
  buildActivityTimeline,
  compareActivityCatalog,
  filterActivities,
  resolveActivityStatus,
  sortActivities,
  type ActivityEntry
} from './index'

const NOW = Date.parse('2026-08-11T12:00:00+08:00')

function text(id: string, value: string) {
  return { id, text: value }
}

function fixtures(): TableSet {
  return {
    ActivityTable: {
      active: {
        id: 'active',
        name: text('name_active', 'Active Event'),
        desc: text('desc_active', '<b>Active</b> details'),
        type: 2,
        sortId: 20,
        tagIds: ['story', 'benefit'],
        timeId: 'active_time',
        rewardId: 'main_reward',
        tabImg: 'active_tab',
        conditions: [
          {
            conditionId: 'unlock',
            conditionType: 19,
            desc: text('condition', 'Finish chapter'),
            tips: text('tips', 'Go now'),
            progressToCompare: 1
          }
        ]
      },
      upcoming: {
        id: 'upcoming',
        name: text('name_upcoming', 'Upcoming Event'),
        type: 1,
        sortId: 1,
        tagIds: ['story'],
        timeId: 'upcoming_time'
      },
      ended: {
        id: 'ended',
        name: text('name_ended', 'Ended Event'),
        type: 1,
        sortId: 1,
        tagIds: ['benefit'],
        timeId: 'ended_time'
      },
      permanent: {
        id: 'permanent',
        name: text('name_permanent', 'Permanent Event'),
        type: 3,
        sortId: 1,
        tagIds: [],
        timeId: 'permanent_time'
      },
      hidden: {
        id: 'hidden',
        name: text('name_hidden', 'Hidden Event'),
        sortId: 2,
        hidden: true,
        timeId: 'active_time'
      },
      dungeon_fighting: {
        id: 'dungeon_fighting',
        name: text('name_dungeon', 'Dungeon Event'),
        sortId: 30,
        timeId: 'active_time'
      }
    },
    ActivityTagTable: {
      story: { tagId: 'story', name: text('tag_story', 'Story') },
      benefit: { tagId: 'benefit', name: text('tag_benefit', 'Benefit') }
    },
    TimeRangeTable: {
      active_time: { timeRangeList: [{ openTime: '2026/8/1 00:00:00', closeTime: '2026/8/20 00:00:00' }] },
      upcoming_time: { timeRangeList: [{ openTime: '2026/9/1 00:00:00', closeTime: '2026/9/20 00:00:00' }] },
      ended_time: { timeRangeList: [{ openTime: '2026/7/1 00:00:00', closeTime: '2026/7/31 00:00:00' }] },
      permanent_time: { timeRangeList: [{ openTime: '2026/1/1 00:00:00', closeTime: '' }] },
      stage_time: { timeRangeList: [{ openTime: '2026/8/15 00:00:00', closeTime: '2026/8/18 00:00:00' }] }
    },
    RewardTable: {
      main_reward: { itemBundles: [{ id: 'gold', count: 10 }], probItemBundles: [{ id: 'rare', count: 1 }] },
      stage_reward: { itemBundles: [{ id: 'gold', count: 2 }], probItemBundles: [] },
      dungeon_reward: { itemBundles: [{ id: 'rare', count: 3 }], probItemBundles: [] }
    },
    ItemTable: {
      gold: { id: 'gold', name: text('item_gold', 'Gold'), iconId: 'item_gold' },
      rare: { id: 'rare', name: text('item_rare', 'Rare Drop'), iconId: 'item_rare' }
    },
    ActivityConditionalMultiStageTable: {
      active: {
        activityId: 'active',
        stageList: {
          stage_b: {
            stageId: 'stage_b',
            name: text('stage_b_name', 'Second'),
            desc: text('stage_b_desc', 'Stage two'),
            sortId: 2,
            timeId: 'stage_time',
            rewardId: 'stage_reward'
          },
          stage_a: {
            stageId: 'stage_a',
            name: text('stage_a_name', 'First'),
            sortId: 1,
            timeId: 'active_time'
          }
        }
      }
    },
    ActivityDungeonFightingStageTable: {
      dungeon_stage: { levelId: 'dungeon_1', questId: 'quest_1' }
    },
    DungeonTable: {
      dungeon_1: {
        dungeonId: 'dungeon_1',
        dungeonName: text('dungeon_name', 'Combat Stage'),
        dungeonDesc: text('dungeon_desc', 'Defeat enemies'),
        sortId: 4,
        rewardId: 'dungeon_reward'
      }
    }
  }
}

describe('activity model', () => {
  it('publishes the complete eight-table contract', () => {
    expect(ACTIVITY_TABLE_NAMES).toEqual([
      'ActivityTable',
      'ActivityTagTable',
      'TimeRangeTable',
      'RewardTable',
      'ItemTable',
      'ActivityConditionalMultiStageTable',
      'ActivityDungeonFightingStageTable',
      'DungeonTable'
    ])
  })

  it('builds immutable entries, tags, conditions, rewards and both stage kinds', () => {
    const tables = fixtures()
    const snapshot = JSON.stringify(tables)
    const catalog = buildActivityCatalog(tables, NOW)
    const active = catalog.details.active
    const dungeon = catalog.details.dungeon_fighting

    expect(active).toMatchObject({
      id: 'active',
      name: 'Active Event',
      description: 'Active details',
      status: 'active',
      tagIds: ['story', 'benefit'],
      image: expect.stringContaining('/activity/active_tab.png')
    })
    expect(active?.searchText).toBe('active\nactive event')
    expect(active?.conditions[0]).toMatchObject({
      id: 'unlock',
      description: 'Finish chapter',
      tips: 'Go now'
    })
    expect(active?.reward.items).toEqual([
      expect.objectContaining({ id: 'gold', count: 10, probable: false }),
      expect.objectContaining({ id: 'rare', count: 1, probable: true })
    ])
    expect(active?.stages.map((stage) => stage.id)).toEqual(['stage_a', 'stage_b'])
    expect(active?.stages[1]).toMatchObject({ status: 'upcoming', reward: { id: 'stage_reward' } })
    expect(dungeon?.stages[0]).toMatchObject({
      kind: 'dungeon',
      dungeonId: 'dungeon_1',
      dungeonName: 'Combat Stage',
      reward: { id: 'dungeon_reward' }
    })
    expect(catalog.tags.map((tag) => tag.id).toSorted()).toEqual(['benefit', 'story'])
    expect(Object.isFrozen(active)).toBe(true)
    expect(JSON.stringify(tables)).toBe(snapshot)
  })

  it('calculates all statuses and orders by status, sortId, sourceOrder and id', () => {
    const catalog = buildActivityCatalog(fixtures(), NOW)
    expect(catalog.statusCounts).toEqual({ active: 3, upcoming: 1, ended: 1, permanent: 1 })
    expect(resolveActivityStatus(catalog.details.upcoming!, NOW)).toBe('upcoming')
    expect(resolveActivityStatus(catalog.details.ended!, NOW)).toBe('ended')
    expect(resolveActivityStatus(catalog.details.permanent!, NOW)).toBe('permanent')
    expect(sortActivities(catalog.entries, NOW).map((entry) => entry.id)).toEqual([
      'hidden',
      'active',
      'dungeon_fighting',
      'upcoming',
      'ended',
      'permanent'
    ])
  })

  it('filters by name or id, any selected tag, statuses and hidden visibility', () => {
    const entries = buildActivityCatalog(fixtures(), NOW).entries
    expect(filterActivities(entries, { search: 'ACTIVE EVENT', now: NOW }).map((entry) => entry.id)).toEqual([
      'active'
    ])
    expect(filterActivities(entries, { search: 'upcoming', now: NOW }).map((entry) => entry.id)).toEqual([
      'upcoming'
    ])
    expect(
      filterActivities(entries, {
        tags: new Set(['benefit', 'missing']),
        statuses: ['active', 'ended'],
        now: NOW
      }).map((entry) => entry.id)
    ).toEqual(['active', 'ended'])
    expect(filterActivities(entries, { search: 'hidden', now: NOW })).toEqual([])
    expect(
      filterActivities(entries, { search: 'hidden', showHidden: true, now: NOW }).map((entry) => entry.id)
    ).toEqual(['hidden'])
  })

  it('builds a clipped past-14/future-90 timeline and spans permanent rows across the window', () => {
    const timeline = buildActivityTimeline(buildActivityCatalog(fixtures(), NOW).entries, NOW)
    expect(timeline).toMatchObject({ pastDays: 14, futureDays: 90, dayCount: 105 })
    expect(timeline.items.map((item) => item.activityId)).toEqual([
      'permanent',
      'ended',
      'active',
      'hidden',
      'dungeon_fighting',
      'upcoming'
    ])
    expect(timeline.items[0]).toMatchObject({
      clippedStart: timeline.windowStart,
      clippedEnd: timeline.windowEnd,
      durationDays: 105,
      status: 'permanent'
    })
    expect(
      timeline.items.every(
        (item) => item.clippedStart >= timeline.windowStart && item.clippedEnd <= timeline.windowEnd
      )
    ).toBe(true)
  })

  it('marks added and deeply modified entries against the latest baseline', () => {
    const baselineTables = fixtures()
    delete baselineTables.ActivityTable?.upcoming
    const baseline = buildActivityCatalog(baselineTables, NOW)
    const currentTables = fixtures()
    const active = currentTables.ActivityTable?.active as Record<string, unknown>
    active.sortId = 99
    const current = buildActivityCatalog(currentTables, NOW)
    const compared = compareActivityCatalog(current, baseline, '1.2.8')

    expect(compared.comparisonVersion).toBe('1.2.8')
    expect(compared.details.upcoming).toMatchObject({ changeType: 'added', diffCount: 1 })
    expect(compared.details.active?.changeType).toBe('modified')
    expect(compared.details.active?.diffCount).toBeGreaterThan(0)
    expect(
      compared.details.active?.differences?.some((difference) => difference.path.includes('sortId'))
    ).toBe(true)
  })

  it('does not trust a stale status field when filtering or sorting', () => {
    const entry = buildActivityCatalog(fixtures(), NOW).details.upcoming!
    const stale = { ...entry, status: 'active' as const } satisfies ActivityEntry
    expect(filterActivities([stale], { statuses: ['upcoming'], now: NOW })).toHaveLength(1)
  })
})
