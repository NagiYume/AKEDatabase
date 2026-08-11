import type { CombatManifestEntry } from '../api/repository'

export type CombatRouteId = string | null | readonly (string | null)[] | undefined

export interface CombatEntrySelection {
  accessibleEntries: readonly CombatManifestEntry[]
  explicit: boolean
  selectedId: string
  selectedEntry: CombatManifestEntry | undefined
}

export function resolveCombatEntrySelection(
  routeId: CombatRouteId,
  entries: readonly CombatManifestEntry[],
  showHidden: boolean
): CombatEntrySelection {
  const accessibleEntries = entries.filter((entry) => showHidden || !entry.hidden)
  const explicit = routeId !== undefined
  const candidate = Array.isArray(routeId) ? routeId[0] : routeId
  const requestedId = typeof candidate === 'string' ? candidate : ''
  const selectedId = explicit ? requestedId : (accessibleEntries[0]?.id ?? '')

  return {
    accessibleEntries,
    explicit,
    selectedId,
    selectedEntry: accessibleEntries.find((entry) => entry.id === selectedId)
  }
}
