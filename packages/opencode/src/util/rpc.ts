export namespace Rpc {
  const CALL_TIMEOUT_MS = 15_000

  type Definition = {
    [method: string]: (input: any) => any
  }

  export function listen(rpc: Definition) {
    self.onmessage = async (evt: MessageEvent) => {
      const parsed = JSON.parse(evt.data)
      if (parsed.type === "rpc.request") {
        const fn = rpc[parsed.method]
        if (!fn) {
          self.postMessage(JSON.stringify({ type: "rpc.error", id: parsed.id, error: `Unknown RPC method: ${parsed.method}` }))
          return
        }
        try {
          const result = await fn(parsed.input)
          self.postMessage(JSON.stringify({ type: "rpc.result", result, id: parsed.id }))
        } catch (error) {
          const message = error instanceof Error ? error.stack || error.message : String(error)
          self.postMessage(JSON.stringify({ type: "rpc.error", id: parsed.id, error: message }))
        }
      }
    }
  }

  export function emit(event: string, data: unknown) {
    self.postMessage(JSON.stringify({ type: "rpc.event", event, data }))
  }

  export function client<T extends Definition>(target: {
    postMessage: (data: string) => void | null
    onmessage: ((this: Worker, ev: MessageEvent<any>) => any) | null
  }) {
    const pending = new Map<number, { resolve: (result: any) => void; reject: (error: Error) => void; timeout: ReturnType<typeof setTimeout> }>()
    const listeners = new Map<string, Set<(data: any) => void>>()
    let id = 0
    target.onmessage = async (evt) => {
      const parsed = JSON.parse(evt.data)
      if (parsed.type === "rpc.result") {
        const entry = pending.get(parsed.id)
        if (entry) {
          clearTimeout(entry.timeout)
          entry.resolve(parsed.result)
          pending.delete(parsed.id)
        }
      }
      if (parsed.type === "rpc.error") {
        const entry = pending.get(parsed.id)
        if (entry) {
          clearTimeout(entry.timeout)
          entry.reject(new Error(parsed.error || "RPC error"))
          pending.delete(parsed.id)
        }
      }
      if (parsed.type === "rpc.event") {
        const handlers = listeners.get(parsed.event)
        if (handlers) {
          for (const handler of handlers) {
            handler(parsed.data)
          }
        }
      }
    }
    return {
      call<Method extends keyof T>(
        method: Method,
        input: Parameters<T[Method]>[0],
        options?: { timeoutMs?: number },
      ): Promise<ReturnType<T[Method]>> {
        const requestId = id++
        return new Promise((resolve, reject) => {
          const timeoutMs = options?.timeoutMs ?? CALL_TIMEOUT_MS
          const timeout = setTimeout(() => {
            pending.delete(requestId)
            reject(new Error(`RPC call timed out: ${String(method)}`))
          }, timeoutMs)
          pending.set(requestId, {
            resolve,
            reject,
            timeout,
          })
          target.postMessage(JSON.stringify({ type: "rpc.request", method, input, id: requestId }))
        })
      },
      on<Data>(event: string, handler: (data: Data) => void) {
        let handlers = listeners.get(event)
        if (!handlers) {
          handlers = new Set()
          listeners.set(event, handlers)
        }
        handlers.add(handler)
        return () => {
          handlers!.delete(handler)
        }
      },
    }
  }
}
