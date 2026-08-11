import type { R2DataClient } from '@ake/data-client'
import { sharedRef } from '@ake/r2-contract'
import { parseSponsors, type Sponsor } from '../model'

const SPONSOR_PATH = 'public/CH/about/sponsors.json'
const repositories = new WeakMap<R2DataClient, AboutRepository>()

export function getAboutRepository(client: R2DataClient): AboutRepository {
  const existing = repositories.get(client)
  if (existing) return existing
  const repository = new AboutRepository(client)
  repositories.set(client, repository)
  return repository
}

export class AboutRepository {
  constructor(private readonly client: R2DataClient) {}

  async sponsors(signal?: AbortSignal): Promise<Sponsor[]> {
    return parseSponsors(await this.client.getJson<unknown>(sharedRef(SPONSOR_PATH), { signal }))
  }
}
