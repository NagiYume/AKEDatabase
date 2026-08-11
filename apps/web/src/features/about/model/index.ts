import { isRecord } from '@ake/r2-contract'

export interface Sponsor {
  id: string
  name: string
  money: string
  rarity: number
  time: string
  content: string
  priority: number
  searchText: string
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

export function parseSponsors(value: unknown): Sponsor[] {
  if (!Array.isArray(value)) throw new Error('Sponsor payload must be an array')
  return value
    .flatMap((entry, sourceOrder) => {
      if (!isRecord(entry)) return []
      const name = text(entry.name).trim()
      if (!name) return []
      const money = text(entry.money)
      const time = text(entry.time)
      const content = text(entry.content)
      const stableName = text(entry.id) || `${name}-${time}-${money}`
      const slug = stableName
        .normalize('NFKC')
        .toLocaleLowerCase()
        .replace(/[^\p{Letter}\p{Number}]+/gu, '-')
        .replace(/^-|-$/g, '')
      return [
        {
          id: slug || `sponsor-${sourceOrder + 1}`,
          name,
          money,
          rarity: Math.max(1, Math.min(6, Number(entry.rarity) || 1)),
          time,
          content,
          priority: Number.isFinite(Number(entry.priority))
            ? Number(entry.priority)
            : Number.POSITIVE_INFINITY,
          searchText: [name, money, time, content].join('\n').toLocaleLowerCase()
        }
      ]
    })
    .toSorted((left, right) => left.priority - right.priority || right.time.localeCompare(left.time, 'en'))
}

export function filterSponsors(
  sponsors: readonly Sponsor[],
  options: { search?: string; rarity?: string }
): Sponsor[] {
  const search = options.search?.trim().toLocaleLowerCase() ?? ''
  return sponsors.filter((sponsor) => {
    if (options.rarity && options.rarity !== 'all' && String(sponsor.rarity) !== options.rarity) return false
    return !search || sponsor.searchText.includes(search)
  })
}
