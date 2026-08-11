/// <reference lib="webworker" />

import ELK, { type ELK as ElkInstance } from 'elkjs/lib/elk-api.js'
import { isSafeNumber, parse } from 'lossless-json'
import {
  parseBuffActionGraph,
  parseSkillActionGraph,
  type ElkGraphInput,
  type GraphLayout
} from '@ake/combat-graph'

const scope = self as unknown as DedicatedWorkerGlobalScope
const cancelled = new Set<number>()
let elkPromise: Promise<ElkInstance> | null = null

type WorkerConstructor = new () => Worker

function workerConstructorFrom(module: unknown): WorkerConstructor {
  const record = module as Record<string, unknown>
  const defaultExport = record.default
  const defaultRecord =
    typeof defaultExport === 'object' && defaultExport !== null
      ? (defaultExport as Record<string, unknown>)
      : null
  const candidate = record.Worker ?? defaultRecord?.Worker ?? defaultRecord?.default ?? defaultExport
  if (typeof candidate !== 'function') throw new TypeError('ELK inline worker constructor is unavailable')
  return candidate as WorkerConstructor
}

async function createElk(): Promise<ElkInstance> {
  const workerScope = globalThis as unknown as Record<PropertyKey, unknown>
  const documentDescriptor = Object.getOwnPropertyDescriptor(workerScope, 'document')

  // elk-worker detects a worker global and otherwise installs itself as the outer
  // message handler. A temporary document sentinel selects its in-process Worker
  // export so ELK stays inside this data worker without spawning a nested worker.
  Object.defineProperty(workerScope, 'document', { configurable: true, value: Object.freeze({}) })
  try {
    // @ts-expect-error -- elkjs does not publish a declaration for its minified worker entry.
    const workerModule: unknown = await import('elkjs/lib/elk-worker.min.js')
    const InlineWorker = workerConstructorFrom(workerModule)
    return new ELK({ workerFactory: () => new InlineWorker() })
  } finally {
    if (documentDescriptor) Object.defineProperty(workerScope, 'document', documentDescriptor)
    else Reflect.deleteProperty(workerScope, 'document')
  }
}

function getElk(): Promise<ElkInstance> {
  elkPromise ??= createElk().catch((error: unknown) => {
    elkPromise = null
    throw error
  })
  return elkPromise
}

function parseJson(text: string): unknown {
  return parse(text, undefined, {
    parseNumber: (value) => (isSafeNumber(value, { approx: true }) ? Number(value) : value)
  })
}

function reply(requestId: number, result: unknown): void {
  if (cancelled.delete(requestId)) return
  scope.postMessage({ requestId, ok: true, result })
}

function fail(requestId: number, error: unknown): void {
  if (cancelled.delete(requestId)) return
  scope.postMessage({ requestId, ok: false, error: error instanceof Error ? error.message : String(error) })
}

scope.addEventListener('message', (event: MessageEvent<Record<string, unknown>>) => {
  const requestId = Number(event.data.requestId)
  if (event.data.type === 'cancel') {
    cancelled.add(requestId)
    return
  }
  void (async () => {
    try {
      if (event.data.type === 'parse-json') {
        const text = new TextDecoder().decode(event.data.buffer as ArrayBuffer)
        reply(requestId, parseJson(text))
        return
      }
      if (event.data.type === 'analyze-combat') {
        const text = new TextDecoder().decode(event.data.buffer as ArrayBuffer)
        const source = parseJson(text)
        const options = event.data.options as { nodeBudget: number; includePerformance: boolean }
        reply(
          requestId,
          event.data.domain === 'buff'
            ? parseBuffActionGraph(source, options)
            : parseSkillActionGraph(source, options)
        )
        return
      }
      if (event.data.type === 'index') {
        const rows = event.data.rows as Array<Record<string, unknown> & { id: string }>
        const fields = event.data.fields as string[]
        reply(
          requestId,
          Object.fromEntries(
            rows.map((row) => [
              row.id,
              fields
                .map((field) => String(row[field] ?? ''))
                .join('\n')
                .toLocaleLowerCase()
            ])
          )
        )
        return
      }
      if (event.data.type === 'layout') {
        const graph = event.data.graph as ElkGraphInput
        const direction = event.data.direction === 'DOWN' ? 'DOWN' : 'RIGHT'
        const elk = await getElk()
        const layout = await elk.layout(graph as unknown as Parameters<typeof elk.layout>[0])
        const nodes = (layout.children ?? []).map((node) => ({
          id: node.id,
          x: node.x ?? 0,
          y: node.y ?? 0,
          width: node.width ?? 230,
          height: node.height ?? 88
        }))
        const result: GraphLayout = {
          direction,
          width: layout.width ?? 0,
          height: layout.height ?? 0,
          nodes
        }
        reply(requestId, result)
        return
      }
      throw new Error(`Unknown worker operation: ${String(event.data.type)}`)
    } catch (error) {
      fail(requestId, error)
    }
  })()
})

export {}
