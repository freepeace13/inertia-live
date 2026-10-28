import type {
  ChangeSignal,
  ConnectionLike,
  EchoChannelLike,
  EchoLike,
  FetchCursors,
} from './types.js'

/**
 * A fake Echo for tests. Drive it with `emit()` and `setConnectionState()`, then assert on
 * `reloads` and `joined`. Framework-agnostic; adapters build on it.
 */
export function createFakeLive(options: { channelPrefix?: string } = {}) {
  const prefix = options.channelPrefix ?? 'live'
  const listeners = new Map<string, Array<(payload: ChangeSignal) => void>>()
  const stateListeners = new Set<(payload: { current: string }) => void>()
  const subscribedCallbacks = new Map<string, Array<() => void>>()
  let socketId: string | undefined
  const joined = new Set<string>()
  const left: string[] = []
  const reloads: string[][] = []
  const cursorRequests: Array<{ url: string; topics: string[] }> = []
  const serverCursors = new Map<string, number | undefined>()
  let cursorsFailing = false

  const connection: ConnectionLike = {
    state: 'connected',
    bind(event, callback) {
      if (event === 'state_change') stateListeners.add(callback)
    },
    unbind(event, callback) {
      if (event === 'state_change' && callback) stateListeners.delete(callback)
    },
  }

  const join = (name: string): EchoChannelLike => {
    joined.add(name)
    const channel: EchoChannelLike = {
      listen(_event, callback) {
        listeners.set(name, [...(listeners.get(name) ?? []), callback])
        return channel
      },
      subscribed(callback) {
        subscribedCallbacks.set(name, [...(subscribedCallbacks.get(name) ?? []), callback])
        return channel
      },
    }
    return channel
  }

  const echo: EchoLike = {
    private: join,
    channel: join,
    leave(name) {
      joined.delete(name)
      listeners.delete(name)
      subscribedCallbacks.delete(name)
      left.push(name)
    },
    socketId: () => socketId,
    connector: { pusher: { connection } },
  }

  const fetchCursors: FetchCursors = async (url, topics) => {
    cursorRequests.push({ url, topics })
    if (cursorsFailing) throw new Error('cursors request failed')
    const result: Record<string, number> = {}
    for (const topic of topics) {
      const cursor = serverCursors.has(topic) ? serverCursors.get(topic) : 0
      if (cursor !== undefined) result[topic] = cursor // undefined: the server leaves the topic out
    }
    return result
  }

  return {
    echo,
    /** Every `only` list passed to the reloader, in order. */
    reloads,
    /** Channels currently joined. @experimental */
    joined,
    /** Channels left, in order. @experimental */
    left,
    /** `fetchCursors` for `LiveClient`: answers from `setServerCursor()` and records each request. @experimental */
    fetchCursors,
    /** Every request made to the cursors endpoint, in order. @experimental */
    cursorRequests,
    /** The cursor the fake server reports for a topic (default 0). `undefined` leaves it out of the answer. @experimental */
    setServerCursor(topic: string, cursor: number | undefined): void {
      serverCursors.set(topic, cursor)
    },
    /** Make the cursors endpoint fail, to test the fallback to re-reading `_live`. @experimental */
    failCursors(failing = true): void {
      cursorsFailing = failing
    },
    /** Reloader for `LiveClient`; records the call. */
    reload: async (only: string[]): Promise<void> => {
      reloads.push(only)
    },
    /**
     * Deliver a change signal for `topic` as if broadcast on `<prefix>.<topic>`. Pass `protocol`
     * to simulate a server that sends the field; omit it to simulate one that does not.
     */
    emit(topic: string, version: number, props: string[] = [], protocol?: number): void {
      const signal: ChangeSignal = { topic, version, props }
      if (protocol !== undefined) signal.protocol = protocol
      for (const callback of listeners.get(`${prefix}.${topic}`) ?? []) callback(signal)
    },
    /** The socket id Echo reports; set it to test sender exclusion. @experimental */
    setSocketId(id: string | undefined): void {
      socketId = id
    },
    /** Simulate the server confirming the subscription to `<prefix>.<topic>`. @experimental */
    confirmSubscription(topic: string): void {
      for (const callback of subscribedCallbacks.get(`${prefix}.${topic}`) ?? []) callback()
    },
    /** Simulate a Pusher connection state change (`connected`, `unavailable`, `disconnected`, …). @experimental */
    setConnectionState(state: string): void {
      connection.state = state
      for (const callback of stateListeners) callback({ current: state })
    },
  }
}

export type FakeLive = ReturnType<typeof createFakeLive>
