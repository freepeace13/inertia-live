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

describe('protocol version', () => {
  it('treats a signal without a protocol field as protocol 1', async () => {
    const { fake, client } = setup()
    client.sync(page(binding('documents.a', ['document'])))

    fake.emit('documents.a', 1, ['document'])
    await vi.advanceTimersByTimeAsync(150)

    expect(fake.reloads).toEqual([['document']])
  })

  it('handles a signal that states protocol 1 like any other', async () => {
    const onError = vi.fn()
    const fake = createFakeLive()
    const client = new LiveClient({ echo: fake.echo, reload: fake.reload, onError })
    client.sync(page(binding('documents.a', ['document', 'comments'])))

    fake.emit('documents.a', 1, ['comments'], 1)
    fake.emit('documents.a', 1, ['comments'], 1) // stale: dropped as usual
    await vi.advanceTimersByTimeAsync(150)

    expect(fake.reloads).toEqual([['comments']])
    expect(onError).not.toHaveBeenCalled()
  })

  it('reloads every bound prop for a newer protocol and reports it once per topic', async () => {
    const onError = vi.fn()
    const fake = createFakeLive()
    const client = new LiveClient({ echo: fake.echo, reload: fake.reload, onError })
    client.sync(
      page(binding('documents.a', ['document', 'comments']), binding('documents.b', ['folder'])),
    )

    fake.emit('documents.a', 5, ['comments'], 2)
    await vi.advanceTimersByTimeAsync(150)
    fake.emit('documents.a', 6, ['comments'], 2)
    fake.emit('documents.b', 1, [], 2)
    await vi.advanceTimersByTimeAsync(150)

    expect(fake.reloads).toEqual([
      ['document', 'comments'],
      ['document', 'comments', 'folder'],
    ])
    expect(onError).toHaveBeenCalledTimes(2) // documents.a once, documents.b once
    expect(String(onError.mock.calls[0][0])).toContain('documents.a')
    expect(String(onError.mock.calls[1][0])).toContain('documents.b')
  })

  it('stays subscribed and ignores the version of a newer-protocol signal', async () => {
    const { fake, client } = setup()
    client.sync(page(binding('documents.a', ['document'], 10)))

    fake.emit('documents.a', 1, [], 2) // below the cursor, but its version cannot be trusted
    await vi.advanceTimersByTimeAsync(150)
    fake.emit('documents.a', 11, [], 1)
    await vi.advanceTimersByTimeAsync(150)

    expect(fake.reloads).toEqual([['document'], ['document']])
    expect([...fake.joined]).toEqual(['live.documents.a'])
  })

  it('treats a non-numeric protocol field as protocol 1', async () => {
    const onError = vi.fn()
    const fake = createFakeLive()
    const client = new LiveClient({ echo: fake.echo, reload: fake.reload, onError })
    client.sync(page(binding('documents.a', ['document'])))

    fake.emit('documents.a', 1, ['document'], Number.NaN)
    await vi.advanceTimersByTimeAsync(150)

    expect(fake.reloads).toEqual([['document']])
    expect(onError).not.toHaveBeenCalled()
  })

  it('reports an unsupported protocol again after the topic was left and rejoined', async () => {
    const onError = vi.fn()
    const fake = createFakeLive()
    const client = new LiveClient({ echo: fake.echo, reload: fake.reload, onError })

    client.sync(page(binding('documents.a', ['document'])))
    fake.emit('documents.a', 1, [], 2)
    client.sync(page())
    client.sync(page(binding('documents.a', ['document'])))
    fake.emit('documents.a', 2, [], 2)

    expect(onError).toHaveBeenCalledTimes(2)
  })
})

describe('cursors endpoint', () => {
  const CURSORS = '/inertia-live/cursors'
  const livePage = (...bindings: Binding[]): LiveProp => ({ bindings, cursors: CURSORS })

  function setupCursors() {
    const fake = createFakeLive()
    const onError = vi.fn()
    const client = new LiveClient({
      echo: fake.echo,
      reload: fake.reload,
      fetchCursors: fake.fetchCursors,
      onError,
    })
    fake.setConnectionState('connected')
    return { fake, client, onError }
  }

  it('asks the endpoint instead of re-reading _live, and does nothing when the cursor matches', async () => {
    const { fake, client } = setupCursors()
    client.sync(livePage(binding('documents.a', ['document'], 7)))
    fake.setServerCursor('documents.a', 7)

    fake.confirmSubscription('documents.a')
    await vi.advanceTimersByTimeAsync(500)

    expect(fake.cursorRequests).toEqual([{ url: CURSORS, topics: ['documents.a'] }])
    expect(fake.reloads).toEqual([])
  })

  it('reloads the bound props when the server cursor is ahead, and keeps the new cursor', async () => {
    const { fake, client } = setupCursors()
    client.sync(livePage(binding('documents.a', ['document', 'comments'], 0)))
    fake.setServerCursor('documents.a', 5)

    fake.confirmSubscription('documents.a')
    await vi.advanceTimersByTimeAsync(150)
    expect(fake.reloads).toEqual([['document', 'comments']])

    fake.emit('documents.a', 5) // the cursor already covers it
    await vi.advanceTimersByTimeAsync(150)
    expect(fake.reloads).toHaveLength(1)
  })

  it('sends one request for every channel confirmed in the same burst', async () => {
    const { fake, client } = setupCursors()
    client.sync(livePage(binding('documents.a', ['document']), binding('comments.a', ['comments'])))

    fake.confirmSubscription('documents.a')
    fake.confirmSubscription('comments.a')
    await vi.advanceTimersByTimeAsync(0)

    expect(fake.cursorRequests).toEqual([{ url: CURSORS, topics: ['documents.a', 'comments.a'] }])
  })

  it('reloads the props of a topic the server left out, because it cannot be verified', async () => {
    const { fake, client } = setupCursors()
    client.sync(livePage(binding('documents.a', ['document']), binding('comments.a', ['comments'])))
    fake.setServerCursor('documents.a', undefined)

    fake.confirmSubscription('documents.a')
    fake.confirmSubscription('comments.a')
    await vi.advanceTimersByTimeAsync(150)

    expect(fake.reloads).toEqual([['document']])
  })

  it('falls back to re-reading _live when the request fails', async () => {
    const { fake, client, onError } = setupCursors()
    client.sync(livePage(binding('documents.a', ['document'])))
    fake.failCursors()

    fake.confirmSubscription('documents.a')
    await vi.advanceTimersByTimeAsync(150)

    expect(fake.reloads).toEqual([['_live']])
    expect(onError).not.toHaveBeenCalled()
  })

  it('re-reads _live when the page carries no cursors URL', async () => {
    const { fake, client } = setupCursors()
    client.sync(page(binding('documents.a', ['document'])))

    fake.confirmSubscription('documents.a')
    await vi.advanceTimersByTimeAsync(150)

    expect(fake.cursorRequests).toEqual([])
    expect(fake.reloads).toEqual([['_live']])
  })

  it('splits more than 50 topics across requests', async () => {
    const { fake, client } = setupCursors()
    const topics = Array.from({ length: 51 }, (_, i) => `documents.${i}`)
    client.sync(livePage(...topics.map((topic) => binding(topic, ['document']))))

    for (const topic of topics) fake.confirmSubscription(topic)
    await vi.advanceTimersByTimeAsync(0)

    expect(fake.cursorRequests.map((request) => request.topics.length)).toEqual([50, 1])
  })

  it('does not reload for a signal that arrived while the request was in flight', async () => {
    const fake = createFakeLive()
    let answer: (value: Record<string, number>) => void = () => {}
    const client = new LiveClient({
      echo: fake.echo,
      reload: fake.reload,
      fetchCursors: () => new Promise((resolve) => (answer = resolve)),
    })
    fake.setConnectionState('connected')
    client.sync(livePage(binding('documents.a', ['document'], 0)))

    fake.confirmSubscription('documents.a')
    await vi.advanceTimersByTimeAsync(0)
    fake.emit('documents.a', 5, ['document'])
    await vi.advanceTimersByTimeAsync(150)
    expect(fake.reloads).toEqual([['document']])

    answer({ 'documents.a': 5 }) // the signal already covered it
    await vi.advanceTimersByTimeAsync(500)
    expect(fake.reloads).toHaveLength(1)
  })

  it('falls back for every channel when one chunk of a large burst fails', async () => {
    const fake = createFakeLive()
    let calls = 0
    const client = new LiveClient({
      echo: fake.echo,
      reload: fake.reload,
      fetchCursors: async (_url, topics) => {
        calls += 1
        if (calls === 2) throw new Error('boom')
        return Object.fromEntries(topics.map((topic) => [topic, 0]))
      },
    })
    fake.setConnectionState('connected')
    const topics = Array.from({ length: 51 }, (_, i) => `documents.${i}`)
    client.sync(livePage(...topics.map((topic) => binding(topic, ['document']))))

    for (const topic of topics) fake.confirmSubscription(topic)
    await vi.advanceTimersByTimeAsync(150)

    expect(calls).toBe(2)
    expect(fake.reloads).toEqual([['_live']])
  })

  it('reloads only the bindings that are ahead or unverifiable in a mixed answer', async () => {
    const { fake, client } = setupCursors()
    client.sync(
      livePage(
        binding('documents.a', ['document'], 3),
        binding('comments.a', ['comments'], 3),
        binding('folders.a', ['folder'], 3),
      ),
    )
    fake.setServerCursor('documents.a', 3) // in step
    fake.setServerCursor('comments.a', 4) // ahead
    fake.setServerCursor('folders.a', undefined) // left out

    for (const topic of ['documents.a', 'comments.a', 'folders.a']) fake.confirmSubscription(topic)
    await vi.advanceTimersByTimeAsync(150)

    expect(fake.reloads).toHaveLength(1)
    expect(new Set(fake.reloads[0])).toEqual(new Set(['comments', 'folder']))
  })

  it('ignores the answer for a channel that was left or a client that was destroyed', async () => {
    const { fake, client } = setupCursors()
    client.sync(livePage(binding('documents.a', ['document'])))
    fake.setServerCursor('documents.a', 9)

    fake.confirmSubscription('documents.a')
    client.sync(livePage()) // left the page before the answer
    await vi.advanceTimersByTimeAsync(500)
    expect(fake.reloads).toEqual([])

    client.sync(livePage(binding('documents.b', ['document'])))
    fake.setServerCursor('documents.b', 9)
    fake.confirmSubscription('documents.b')
    client.destroy()
    await vi.advanceTimersByTimeAsync(500)
    expect(fake.reloads).toEqual([])
  })
})

describe('default cursors request', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  function setupFetch(respond: () => Promise<Partial<Response>>) {
    const request = vi.fn(respond)
    vi.stubGlobal('fetch', request)
    const fake = createFakeLive()
    const client = new LiveClient({ echo: fake.echo, reload: fake.reload })
    fake.setConnectionState('connected')
    return { fake, client, request }
  }

  const livePage = (...bindings: Binding[]): LiveProp => ({
    bindings,
    cursors: '/inertia-live/cursors',
  })

  it('sends a same-origin GET with the topics encoded', async () => {
    const { fake, client, request } = setupFetch(async () => ({
      ok: true,
      json: async () => ({ cursors: { 'documents.a b&c': 0 } }),
    }))
    client.sync(livePage(binding('documents.a b&c', ['document'])))

    fake.confirmSubscription('documents.a b&c')
    await vi.advanceTimersByTimeAsync(150)

    expect(request).toHaveBeenCalledWith(
      '/inertia-live/cursors?topics[]=documents.a%20b%26c',
      expect.objectContaining({ credentials: 'same-origin' }),
    )
    expect(fake.reloads).toEqual([])
  })

  it('falls back to re-reading _live when the response is not ok', async () => {
    const { fake, client } = setupFetch(async () => ({ ok: false, status: 429 }))
    client.sync(livePage(binding('documents.a', ['document'])))

    fake.confirmSubscription('documents.a')
    await vi.advanceTimersByTimeAsync(150)

    expect(fake.reloads).toEqual([['_live']])
  })

  it('treats a body without cursors as nothing verifiable and reloads the bound props', async () => {
    const { fake, client } = setupFetch(async () => ({ ok: true, json: async () => ({}) }))
    client.sync(livePage(binding('documents.a', ['document'])))

    fake.confirmSubscription('documents.a')
    await vi.advanceTimersByTimeAsync(150)

    expect(fake.reloads).toEqual([['document']])
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

describe('onSynced', () => {
  it('notifies after each reload, until unsubscribed', async () => {
    const { fake, client } = setup()
    const seen: Date[] = []
    const off = client.onSynced((at) => seen.push(at))
    client.sync(page(binding('documents.a', ['document'])))

    fake.emit('documents.a', 1)
    await vi.advanceTimersByTimeAsync(150)
    expect(seen).toHaveLength(1)
    expect(client.lastSyncedAt).toBeInstanceOf(Date)

    off()
    await client.refresh()
    expect(seen).toHaveLength(1)
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

describe('malformed signals', () => {
  it('ignores a non-numeric version and tolerates missing props', async () => {
    const { fake, client } = setup({ debounceMs: 0 })
    client.sync(page(binding('documents.a', ['document'])))

    fake.emit('documents.a', Number.NaN)
    await vi.advanceTimersByTimeAsync(0)
    expect(fake.reloads).toEqual([])

    fake.emit('documents.a', 1, undefined as unknown as string[])
    await vi.advanceTimersByTimeAsync(0)
    expect(fake.reloads).toEqual([['document']])
  })
})

describe('connection state mapping', () => {
  it.each([
    ['unavailable', 'reconnecting'],
    ['failed', 'offline'],
    ['disconnected', 'offline'],
  ])('maps %s to %s once live', (state, expected) => {
    const { fake, client } = setup()
    fake.setConnectionState(state)
    expect(client.status).toBe(expected)
  })

  it('treats initialized as reconnecting after having been live', () => {
    const { fake, client } = setup()
    fake.setConnectionState('initialized')
    expect(client.status).toBe('reconnecting')
  })

  it('ignores unknown states', () => {
    const { fake, client } = setup()
    fake.setConnectionState('mystery')
    expect(client.status).toBe('live')
  })
})
