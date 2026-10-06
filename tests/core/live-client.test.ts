import type { Binding, LiveProp } from '@freepeace13/inertia-live-core'
import { LiveClient, ReloadCancelled } from '@freepeace13/inertia-live-core'
import { createFakeLive } from '@freepeace13/inertia-live-core/testing'

const binding = (
  topic: string,
  props: string[],
  cursor = 0,
  extra: Partial<Binding> = {},
): Binding => ({
  topic,
  channel: `live.${topic}`,
  props,
  cursor,
  ...extra,
})

const page = (...bindings: Binding[]): LiveProp => ({ bindings })

function setup(options: { debounceMs?: number } = {}) {
  const fake = createFakeLive()
  const client = new LiveClient({ echo: fake.echo, reload: fake.reload, ...options })
  fake.setConnectionState('connected')
  return { fake, client }
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('subscriptions', () => {
  it('joins channels for new bindings', () => {
    const { fake, client } = setup()

    client.sync(page(binding('documents.a', ['document'])))

    expect([...fake.joined]).toEqual(['live.documents.a'])
  })

  it('leaves channels that are no longer bound', () => {
    const { fake, client } = setup()

    client.sync(page(binding('documents.a', ['document']), binding('documents.b', ['document'])))
    client.sync(page(binding('documents.b', ['document'])))

    expect([...fake.joined]).toEqual(['live.documents.b'])
    expect(fake.left).toEqual(['live.documents.a'])
  })

  it('leaves everything on pages without _live', () => {
    const { fake, client } = setup()

    client.sync(page(binding('documents.a', ['document'])))
    client.sync(undefined)

    expect(fake.joined.size).toBe(0)
  })

  it('does not rejoin on an identical sync', () => {
    const { fake, client } = setup()
    const live = page(binding('documents.a', ['document']))

    client.sync(live)
    client.sync(live)

    expect(fake.left).toEqual([])
  })

  it('uses a public channel for public bindings', () => {
    const fake = createFakeLive()
    const echo = {
      ...fake.echo,
      private: vi.fn(fake.echo.private),
      channel: vi.fn(fake.echo.channel),
    }
    const client = new LiveClient({ echo, reload: fake.reload })

    client.sync(page(binding('workspaces.1', ['docs'], 0, { public: true })))

    expect(echo.channel).toHaveBeenCalledWith('live.workspaces.1')
    expect(echo.private).not.toHaveBeenCalled()
  })
})

describe('reloading', () => {
  it('debounces a burst of signals into one reload', async () => {
    const { fake, client } = setup()
    client.sync(page(binding('documents.a', ['document'])))

    fake.emit('documents.a', 1)
    fake.emit('documents.a', 2)
    fake.emit('documents.a', 3)
    await vi.advanceTimersByTimeAsync(149)
    expect(fake.reloads).toEqual([])

    await vi.advanceTimersByTimeAsync(1)
    expect(fake.reloads).toEqual([['document']])
  })

  it('unions the props of every topic into one reload', async () => {
    const { fake, client } = setup()
    client.sync(
      page(
        binding('documents.a', ['document', 'activity']),
        binding('comments.a', ['activity', 'comments']),
      ),
    )

    fake.emit('documents.a', 1)
    fake.emit('comments.a', 1)
    await vi.advanceTimersByTimeAsync(150)

    expect(fake.reloads).toHaveLength(1)
    expect(new Set(fake.reloads[0])).toEqual(new Set(['document', 'activity', 'comments']))
  })

  it('reloads only the props a signal lists that the page binds', async () => {
    const { fake, client } = setup()
    client.sync(page(binding('documents.a', ['document', 'comments'])))

    fake.emit('documents.a', 1, ['comments'])
    await vi.advanceTimersByTimeAsync(150)

    expect(fake.reloads).toEqual([['comments']])
  })

  it('skips the reload when the signal only lists props the page does not bind', async () => {
    const { fake, client } = setup()
    client.sync(page(binding('documents.a', ['document'])))

    fake.emit('documents.a', 1, ['audit'])
    await vi.advanceTimersByTimeAsync(500)

    expect(fake.reloads).toEqual([])
  })

  it('falls back to every bound prop when the signal lists none', async () => {
    const { fake, client } = setup()
    client.sync(page(binding('documents.a', ['document', 'comments'])))

    fake.emit('documents.a', 1, [])
    await vi.advanceTimersByTimeAsync(150)

    expect(fake.reloads).toEqual([['document', 'comments']])
  })

  it('still advances the cursor when the signal is skipped as irrelevant', async () => {
    const { fake, client } = setup()
    client.sync(page(binding('documents.a', ['document'])))

    fake.emit('documents.a', 5, ['audit'])
    fake.emit('documents.a', 4, ['document']) // older than the skipped signal: stale
    await vi.advanceTimersByTimeAsync(500)

    expect(fake.reloads).toEqual([])
  })

  it('drops signals at or below the cursor', async () => {
    const { fake, client } = setup()
    client.sync(page(binding('documents.a', ['document'], 10)))

    fake.emit('documents.a', 10)
    fake.emit('documents.a', 4)
    await vi.advanceTimersByTimeAsync(500)

    expect(fake.reloads).toEqual([])
  })

  it('ignores older signals that arrive out of order', async () => {
    const { fake, client } = setup()
    client.sync(page(binding('documents.a', ['document'])))

    fake.emit('documents.a', 9)
    await vi.advanceTimersByTimeAsync(150)
    fake.emit('documents.a', 7)
    await vi.advanceTimersByTimeAsync(150)

    expect(fake.reloads).toHaveLength(1)
  })

  it('reloads immediately when debounceMs is 0', async () => {
    const { fake, client } = setup({ debounceMs: 0 })
    client.sync(page(binding('documents.a', ['document'])))

    fake.emit('documents.a', 1)
    await vi.advanceTimersByTimeAsync(0)

    expect(fake.reloads).toEqual([['document']])
  })

  it('queues one follow-up reload for signals that arrive mid-flight', async () => {
    const reloads: string[][] = []
    const resolvers: Array<() => void> = []
    const fake = createFakeLive()
    const client = new LiveClient({
      echo: fake.echo,
      reload: (only) => {
        reloads.push(only)
        return new Promise<void>((resolve) => resolvers.push(resolve))
      },
    })
    client.sync(page(binding('documents.a', ['document']), binding('comments.a', ['comments'])))

    fake.emit('documents.a', 1)
    await vi.advanceTimersByTimeAsync(150)
    expect(reloads).toEqual([['document']])

    fake.emit('comments.a', 1)
    fake.emit('comments.a', 2)
    await vi.advanceTimersByTimeAsync(500)
    expect(reloads).toHaveLength(1) // held until the first reload ends

    resolvers[0]()
    await vi.advanceTimersByTimeAsync(150)
    expect(reloads).toEqual([['document'], ['comments']])
  })

  it('reports reload errors without breaking later reloads', async () => {
    const onError = vi.fn()
    const fake = createFakeLive()
    let calls = 0
    const client = new LiveClient({
      echo: fake.echo,
      reload: async () => {
        calls++
        if (calls === 1) throw new Error('boom')
      },
      onError,
    })
    client.sync(page(binding('documents.a', ['document'])))

    fake.emit('documents.a', 1)
    await vi.advanceTimersByTimeAsync(150)
    fake.emit('documents.a', 2)
    await vi.advanceTimersByTimeAsync(1000) // the failed props and the new signal retry together

    expect(onError).toHaveBeenCalledTimes(1)
    expect(calls).toBe(2)
  })
})

describe('pause, resume and refresh', () => {
  it('holds reloads while paused and flushes on resume', async () => {
    const { fake, client } = setup()
    client.sync(page(binding('documents.a', ['document'])))

    client.pause()
    fake.emit('documents.a', 1)
    await vi.advanceTimersByTimeAsync(1000)
    expect(fake.reloads).toEqual([])

    client.resume()
    await vi.advanceTimersByTimeAsync(150)
    expect(fake.reloads).toEqual([['document']])
  })

  it('does not reload on resume when nothing is queued', async () => {
    const { fake, client } = setup()
    client.sync(page(binding('documents.a', ['document'])))

    client.pause()
    client.resume()
    await vi.advanceTimersByTimeAsync(500)

    expect(fake.reloads).toEqual([])
  })

  it('refresh reloads all bound props immediately and clears the queue', async () => {
    const { fake, client } = setup()
    client.sync(
      page(binding('documents.a', ['document', 'activity']), binding('comments.a', ['comments'])),
    )

    fake.emit('documents.a', 1)
    await client.refresh()
    await vi.advanceTimersByTimeAsync(500)

    expect(fake.reloads).toHaveLength(1)
    expect(new Set(fake.reloads[0])).toEqual(new Set(['document', 'activity', 'comments']))
  })

  it('refresh does nothing without bindings', async () => {
    const { fake, client } = setup()

    await client.refresh()

    expect(fake.reloads).toEqual([])
  })
})

describe('afterReload', () => {
  it('advances cursors from the fresh _live prop and stamps lastSyncedAt', async () => {
    const { fake, client } = setup()
    client.sync(page(binding('documents.a', ['document'])))
    expect(client.lastSyncedAt).toBeNull()

    client.afterReload(page(binding('documents.a', ['document'], 8)))
    fake.emit('documents.a', 8)
    await vi.advanceTimersByTimeAsync(500)

    expect(fake.reloads).toEqual([])
    expect(client.lastSyncedAt).toBeInstanceOf(Date)
  })
})

describe('onSynced', () => {
  it('notifies after a reload and after afterReload, until unsubscribed', async () => {
    const { fake, client } = setup()
    const seen: Date[] = []
    const off = client.onSynced((at) => seen.push(at))
    client.sync(page(binding('documents.a', ['document'])))

    fake.emit('documents.a', 1)
    await vi.advanceTimersByTimeAsync(150)
    client.afterReload(page(binding('documents.a', ['document'], 1)))
    expect(seen).toHaveLength(2)

    off()
    await client.refresh()
    expect(seen).toHaveLength(2)
  })
})

describe('connection status', () => {
  it('tracks the connection state', () => {
    const { fake, client } = setup()
    const seen: string[] = []
    client.onStatus((status) => seen.push(status))

    fake.setConnectionState('unavailable')
    fake.setConnectionState('connecting')
    fake.setConnectionState('connected')
    fake.setConnectionState('disconnected')

    expect(seen).toEqual(['reconnecting', 'live', 'offline'])
    expect(client.status).toBe('offline')
  })

  it('does not reload on the first connect', async () => {
    const fake = createFakeLive()
    fake.setConnectionState('connecting')
    const client = new LiveClient({ echo: fake.echo, reload: fake.reload })
    client.sync(page(binding('documents.a', ['document'])))

    fake.setConnectionState('connected')
    await vi.advanceTimersByTimeAsync(500)

    expect(client.status).toBe('live')
    expect(fake.reloads).toEqual([])
  })

  it('reloads all bound props exactly once after a reconnect', async () => {
    const { fake, client } = setup()
    client.sync(page(binding('documents.a', ['document']), binding('comments.a', ['comments'])))

    fake.setConnectionState('unavailable')
    fake.setConnectionState('connecting')
    fake.setConnectionState('connected')
    await vi.advanceTimersByTimeAsync(500)

    expect(fake.reloads).toHaveLength(1)
    expect(new Set(fake.reloads[0])).toEqual(new Set(['document', 'comments']))
  })
})

describe('destroy', () => {
  it('leaves channels, clears timers and ignores later signals', async () => {
    const { fake, client } = setup()
    client.sync(page(binding('documents.a', ['document'])))
    fake.emit('documents.a', 1)

    client.destroy()
    await vi.advanceTimersByTimeAsync(500)
    fake.emit('documents.a', 2)
    await vi.advanceTimersByTimeAsync(500)

    expect(fake.reloads).toEqual([])
    expect(fake.joined.size).toBe(0)
  })
})

describe('silent-stale guards', () => {
  it('reloads within maxWaitMs even while signals keep arriving', async () => {
    const { fake, client } = setup({ debounceMs: 150 })
    client.sync(page(binding('documents.a', ['document'])))

    for (let version = 1; version <= 100; version++) {
      fake.emit('documents.a', version)
      await vi.advanceTimersByTimeAsync(100)
    }

    expect(fake.reloads.length).toBeGreaterThanOrEqual(10)
  })

  it('re-queues props and retries with backoff when a reload fails', async () => {
    const fake = createFakeLive()
    const errors: unknown[] = []
    let attempts = 0
    const client = new LiveClient({
      echo: fake.echo,
      debounceMs: 0,
      onError: (error) => errors.push(error),
      reload: async (only) => {
        attempts += 1
        if (attempts === 1) throw new Error('boom')
        fake.reloads.push(only)
      },
    })
    client.sync(page(binding('documents.a', ['document'])))

    fake.emit('documents.a', 1)
    await vi.advanceTimersByTimeAsync(0)
    expect(errors).toHaveLength(1)
    expect(fake.reloads).toEqual([])

    await vi.advanceTimersByTimeAsync(1000)
    expect(fake.reloads).toEqual([['document']])
  })

  it('gives up after repeated failures', async () => {
    const fake = createFakeLive()
    let attempts = 0
    const client = new LiveClient({
      echo: fake.echo,
      debounceMs: 0,
      reload: async () => {
        attempts += 1
        throw new Error('down')
      },
    })
    client.sync(page(binding('documents.a', ['document'])))

    fake.emit('documents.a', 1)
    await vi.advanceTimersByTimeAsync(120_000)

    expect(attempts).toBe(6)
  })

  it('re-reads _live on subscription and reloads props if the cursor moved', async () => {
    const { fake, client } = setup({ debounceMs: 0 })
    client.sync(page(binding('documents.a', ['document'], 1)))

    fake.confirmSubscription('documents.a')
    await vi.advanceTimersByTimeAsync(0)
    expect(fake.reloads).toEqual([['_live']])

    // The _live-only reload comes back with a newer cursor: a signal was missed.
    client.sync(page(binding('documents.a', ['document'], 2)))
    await vi.advanceTimersByTimeAsync(0)

    expect(fake.reloads).toEqual([['_live'], ['document']])
  })

  it('does not reload props when the cursor did not move after subscribing', async () => {
    const { fake, client } = setup({ debounceMs: 0 })
    client.sync(page(binding('documents.a', ['document'], 1)))

    fake.confirmSubscription('documents.a')
    await vi.advanceTimersByTimeAsync(0)
    client.sync(page(binding('documents.a', ['document'], 1)))
    await vi.advanceTimersByTimeAsync(0)

    expect(fake.reloads).toEqual([['_live']])
  })
})

describe('pause and reconnect', () => {
  it('counts pauses: reloads wait for every holder to release', async () => {
    const { fake, client } = setup({ debounceMs: 0 })
    client.sync(page(binding('documents.a', ['document'])))

    const releaseA = client.pause()
    const releaseB = client.pause()
    fake.emit('documents.a', 1)

    releaseA()
    releaseA() // releasing twice must not release B's hold
    await vi.advanceTimersByTimeAsync(0)
    expect(fake.reloads).toEqual([])

    releaseB()
    await vi.advanceTimersByTimeAsync(0)
    expect(fake.reloads).toEqual([['document']])
  })

  it('resetPause releases every hold and flushes the queue', async () => {
    const { fake, client } = setup({ debounceMs: 0 })
    client.sync(page(binding('documents.a', ['document'])))

    client.pause()
    client.pause()
    fake.emit('documents.a', 1)
    client.resetPause()
    await vi.advanceTimersByTimeAsync(0)

    expect(fake.reloads).toEqual([['document']])
  })

  it('queues the reconnect reload while paused instead of overwriting a form', async () => {
    const { fake, client } = setup({ debounceMs: 0 })
    client.sync(page(binding('documents.a', ['document'])))
    fake.setConnectionState('unavailable')

    const release = client.pause()
    fake.setConnectionState('connected')
    await vi.advanceTimersByTimeAsync(0)
    expect(fake.reloads).toEqual([])

    release()
    await vi.advanceTimersByTimeAsync(0)
    expect(fake.reloads).toEqual([['document']])
  })
})

describe('pause tokens', () => {
  it('a release from before resetPause does not lift a newer pause', async () => {
    const { fake, client } = setup({ debounceMs: 0 })
    client.sync(page(binding('documents.a', ['document'])))

    const stale = client.pause()
    client.resetPause() // navigation
    client.pause() // the next page pauses
    fake.emit('documents.a', 1)

    stale()
    await vi.advanceTimersByTimeAsync(0)

    expect(fake.reloads).toEqual([])
  })
})

describe('reload pipeline', () => {
  it('retries a cancelled reload without counting a failure', async () => {
    const errors: unknown[] = []
    const fake = createFakeLive()
    let calls = 0
    const client = new LiveClient({
      echo: fake.echo,
      debounceMs: 0,
      onError: (error) => errors.push(error),
      reload: async (only) => {
        calls += 1
        if (calls === 1) throw new ReloadCancelled()
        fake.reloads.push(only)
      },
    })
    fake.setConnectionState('connected')
    client.sync(page(binding('documents.a', ['document'])))

    fake.emit('documents.a', 1)
    await vi.advanceTimersByTimeAsync(0)

    expect(errors).toEqual([])
    expect(fake.reloads).toEqual([['document']])
  })

  it('refresh queues behind an in-flight reload instead of overlapping it', async () => {
    const fake = createFakeLive()
    let active = 0
    let maxActive = 0
    const client = new LiveClient({
      echo: fake.echo,
      debounceMs: 0,
      reload: async (only) => {
        active += 1
        maxActive = Math.max(maxActive, active)
        await new Promise((resolve) => setTimeout(resolve, 50))
        fake.reloads.push(only)
        active -= 1
      },
    })
    fake.setConnectionState('connected')
    client.sync(page(binding('documents.a', ['document'])))

    fake.emit('documents.a', 1)
    const refreshed = client.refresh()
    await vi.advanceTimersByTimeAsync(200)
    await refreshed

    expect(maxActive).toBe(1)
    expect(fake.reloads.length).toBe(2)
  })

  it('verifies several new channels with a single _live read', async () => {
    const { fake, client } = setup()
    client.sync(page(binding('a', ['x'], 1), binding('b', ['y'], 1), binding('c', ['z'], 1)))

    for (const topic of ['a', 'b', 'c']) fake.confirmSubscription(topic)
    await vi.advanceTimersByTimeAsync(150)

    expect(fake.reloads).toEqual([['_live']])
  })

  it('ignores a response that predates the subscription ack', async () => {
    const fake = createFakeLive()
    let release!: () => void
    let first = true
    const client = new LiveClient({
      echo: fake.echo,
      debounceMs: 0,
      reload: async (only) => {
        fake.reloads.push(only)
        if (first) {
          first = false
          await new Promise<void>((resolve) => {
            release = resolve
          })
        }
      },
    })
    fake.setConnectionState('connected')
    client.sync(page(binding('a', ['x'], 1), binding('b', ['y'], 1)))
    fake.emit('b', 2) // starts a reload for `y`
    await vi.advanceTimersByTimeAsync(0)

    fake.confirmSubscription('a') // acked while that reload is still in flight
    client.sync(page(binding('a', ['x'], 5), binding('b', ['y'], 2))) // its response arrives
    release()
    await vi.advanceTimersByTimeAsync(0)

    // The in-flight response cannot vouch for `a`; a fresh `_live` read follows.
    expect(fake.reloads).toEqual([['y'], ['_live']])
  })
})

describe('stale', () => {
  it('flags the client stale after giving up and clears it on the next good reload', async () => {
    const fake = createFakeLive()
    let failing = true
    const client = new LiveClient({
      echo: fake.echo,
      debounceMs: 0,
      reload: async () => {
        if (failing) throw new Error('boom')
      },
    })
    fake.setConnectionState('connected')
    const changes: boolean[] = []
    client.onStale((stale) => changes.push(stale))
    client.sync(page(binding('documents.a', ['document'])))

    fake.emit('documents.a', 1)
    await vi.advanceTimersByTimeAsync(120_000)
    expect(client.stale).toBe(true)

    failing = false
    await client.refresh()

    expect(client.stale).toBe(false)
    expect(changes).toEqual([true, false])
  })
})
