import type { ChangeSignal, ConnectionLike, EchoChannelLike, EchoLike } from './types.js'

/**
 * A fake Echo for tests. Drive it with `emit()` and `setConnectionState()`, then assert on
 * `reloads` and `joined`. Framework-agnostic; adapters build on it.
 */
export function createFakeLive(options: { channelPrefix?: string } = {}) {
  const prefix = options.channelPrefix ?? 'live'
  const listeners = new Map<string, Array<(payload: ChangeSignal) => void>>()
  const stateListeners = new Set<(payload: { current: string }) => void>()
  const joined = new Set<string>()
  const left: string[] = []
  const reloads: string[][] = []

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
    }
    return channel
  }

  const echo: EchoLike = {
    private: join,
    channel: join,
    leave(name) {
      joined.delete(name)
      listeners.delete(name)
      left.push(name)
    },
    connector: { pusher: { connection } },
  }

  return {
    echo,
    /** Every `only` list passed to the reloader, in order. */
    reloads,
    /** Channels currently joined. */
    joined,
    /** Channels left, in order. */
    left,
    /** Reloader for `LiveClient`; records the call. */
    reload: async (only: string[]): Promise<void> => {
      reloads.push(only)
    },
    /** Deliver a change signal for `topic` as if broadcast on `<prefix>.<topic>`. */
    emit(topic: string, version: number, props: string[] = []): void {
      const signal: ChangeSignal = { topic, version, props }
      for (const callback of listeners.get(`${prefix}.${topic}`) ?? []) callback(signal)
    },
    /** Simulate a Pusher connection state change (`connected`, `unavailable`, `disconnected`, …). */
    setConnectionState(state: string): void {
      connection.state = state
      for (const callback of stateListeners) callback({ current: state })
    },
  }
}

export type FakeLive = ReturnType<typeof createFakeLive>
