import { createElkGraph, type ActionGraph, type CombatDomain, type GraphLayout } from '@ake/combat-graph'

interface WorkerSuccess {
  requestId: number
  ok: true
  result: unknown
}

interface WorkerFailure {
  requestId: number
  ok: false
  error: string
}

type WorkerResponse = WorkerSuccess | WorkerFailure

interface PendingRequest {
  resolve(value: unknown): void
  reject(reason: unknown): void
}

export class DataWorkerClient {
  private worker: Worker | null = null
  private nextRequestId = 1
  private readonly pending = new Map<number, PendingRequest>()

  parseJson<T>(text: string, signal?: AbortSignal): Promise<T> {
    const buffer = new TextEncoder().encode(text).buffer
    return this.request<T>({ type: 'parse-json', buffer }, [buffer], signal)
  }

  analyzeCombat(
    domain: CombatDomain,
    text: string,
    options: { nodeBudget: number; includePerformance: boolean },
    signal?: AbortSignal
  ): Promise<ActionGraph> {
    const buffer = new TextEncoder().encode(text).buffer
    return this.request<ActionGraph>({ type: 'analyze-combat', domain, buffer, options }, [buffer], signal)
  }

  layout(graph: ActionGraph, direction: 'RIGHT' | 'DOWN', signal?: AbortSignal): Promise<GraphLayout> {
    return this.request<GraphLayout>(
      { type: 'layout', graph: createElkGraph(graph, direction), direction },
      [],
      signal
    )
  }

  buildSearchIndex<T extends { id: string }>(
    rows: readonly T[],
    fields: readonly (keyof T)[],
    signal?: AbortSignal
  ): Promise<Record<string, string>> {
    return this.request<Record<string, string>>({ type: 'index', rows, fields }, [], signal)
  }

  terminate(): void {
    this.worker?.terminate()
    this.worker = null
    for (const request of this.pending.values())
      request.reject(new DOMException('Worker terminated', 'AbortError'))
    this.pending.clear()
  }

  private getWorker(): Worker {
    if (this.worker) return this.worker
    this.worker = new Worker(new URL('../../workers/data.worker.ts', import.meta.url), {
      type: 'module',
      name: 'ake-data-worker'
    })
    this.worker.addEventListener('message', (event: MessageEvent<WorkerResponse>) => {
      const message = event.data
      const pending = this.pending.get(message.requestId)
      if (!pending) return
      this.pending.delete(message.requestId)
      if (message.ok) pending.resolve(message.result)
      else pending.reject(new Error(message.error))
    })
    this.worker.addEventListener('error', (event) => {
      for (const request of this.pending.values()) request.reject(event.error ?? new Error(event.message))
      this.pending.clear()
      this.worker?.terminate()
      this.worker = null
    })
    return this.worker
  }

  private request<T>(
    payload: Record<string, unknown>,
    transfer: Transferable[],
    signal?: AbortSignal
  ): Promise<T> {
    if (signal?.aborted) return Promise.reject(signal.reason)
    const requestId = this.nextRequestId++
    return new Promise<T>((resolve, reject) => {
      this.pending.set(requestId, { resolve: (value) => resolve(value as T), reject })
      const abort = () => {
        this.pending.delete(requestId)
        this.worker?.postMessage({ type: 'cancel', requestId })
        reject(signal?.reason ?? new DOMException('Request cancelled', 'AbortError'))
      }
      signal?.addEventListener('abort', abort, { once: true })
      this.getWorker().postMessage({ ...payload, requestId }, transfer)
    })
  }
}

export const dataWorker = new DataWorkerClient()
