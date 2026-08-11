import type { R2DataClient } from '@ake/data-client'
import { isRecord, sharedRef } from '@ake/r2-contract'
import type { ResearchDocument } from '../model'

const MANIFEST_PATH = 'public/CH/research/manifest.json'

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function parseManifest(value: unknown): ResearchDocument[] {
  if (!Array.isArray(value)) throw new Error('Research manifest must be an array')
  return value
    .flatMap((entry, sourceOrder) => {
      if (!isRecord(entry)) return []
      const id = stringValue(entry.id).trim()
      const contentFile = stringValue(entry.contentFile).trim()
      if (!id || !contentFile) return []
      return [
        {
          id,
          name: stringValue(entry.name) || id,
          contentFile,
          hidden: entry.hidden === true,
          priority: Number.isFinite(Number(entry.priority)) ? Number(entry.priority) : 999,
          category: stringValue(entry.category),
          categoryOrder: Number.isFinite(Number(entry.categoryOrder)) ? Number(entry.categoryOrder) : 999,
          summary: stringValue(entry.summary),
          token: stringValue(entry.token),
          sourceOrder
        }
      ]
    })
    .toSorted((left, right) => left.priority - right.priority || left.sourceOrder - right.sourceOrder)
    .map(({ sourceOrder: _sourceOrder, ...document }) => document)
}

const repositories = new WeakMap<R2DataClient, ResearchRepository>()

export function getResearchRepository(client: R2DataClient): ResearchRepository {
  const existing = repositories.get(client)
  if (existing) return existing
  const repository = new ResearchRepository(client)
  repositories.set(client, repository)
  return repository
}

export class ResearchRepository {
  constructor(private readonly client: R2DataClient) {}

  async list(signal?: AbortSignal): Promise<ResearchDocument[]> {
    return parseManifest(await this.client.getJson<unknown>(sharedRef(MANIFEST_PATH), { signal }))
  }

  async read(document: ResearchDocument, signal?: AbortSignal): Promise<string> {
    return this.client.getText(sharedRef(document.contentFile), { signal })
  }
}
