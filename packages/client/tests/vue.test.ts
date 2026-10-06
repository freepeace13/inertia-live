import * as inertia from '@inertiajs/vue3'
import { createApp, nextTick } from 'vue'
import type { Binding } from '../src/core/types'
import { InertiaLive, inertiaReloader, useLive } from '../src/vue'
import { createFakeLive } from '../src/vue/testing'

vi.mock('@inertiajs/vue3', async () => {
  const { reactive } = await import('vue')
  const page = reactive<{ props: Record<string, unknown> }>({ props: {} })

  return {
    usePage: () => page,
    router: { reload: vi.fn((options: { onFinish?: () => void }) => options.onFinish?.()) },
    __page: page,
  }
})

const page = (inertia as unknown as { __page: { props: Record<string, unknown> } }).__page

const binding = (topic: string, props: string[], cursor = 0): Binding => ({
  topic,
  channel: `live.${topic}`,
  props,
  cursor,
})

const navigate = (...bindings: Binding[]) => {
  page.props = bindings.length > 0 ? { _live: { bindings } } : {}
}

function install(options: Parameters<typeof createFakeLive>[0] = {}) {
  const fake = createFakeLive(options)
  const app = createApp({ render: () => null })
  app.use(InertiaLive, fake.options)
  return { fake, app }
}

beforeEach(() => {
  vi.useFakeTimers()
  page.props = {}
  vi.mocked(inertia.router.reload).mockClear()
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('InertiaLive plugin', () => {
  it('subscribes to the bindings of the current page', async () => {
    const { fake } = install()

    navigate(binding('documents.a', ['document']))
    await nextTick()

    expect([...fake.joined]).toEqual(['live.documents.a'])
  })

  it('syncs subscriptions on every navigation', async () => {
    const { fake } = install()

    navigate(binding('documents.a', ['document']))
    await nextTick()
    navigate(binding('documents.b', ['document']))
    await nextTick()

    expect([...fake.joined]).toEqual(['live.documents.b'])
    expect(fake.left).toEqual(['live.documents.a'])
  })

  it('leaves all channels on pages without _live', async () => {
    const { fake } = install()

    navigate(binding('documents.a', ['document']))
    await nextTick()
    navigate()
    await nextTick()

    expect(fake.joined.size).toBe(0)
  })

  it('subscribes immediately when the first page already has bindings', () => {
    navigate(binding('documents.a', ['document']))

    const { fake } = install()

    expect([...fake.joined]).toEqual(['live.documents.a'])
  })

  it('reloads the bound props once after a debounced burst of signals', async () => {
    const { fake } = install()
    navigate(binding('documents.a', ['document', 'activity']))
    await nextTick()

    fake.emit('documents.a', 1)
    fake.emit('documents.a', 2)
    await vi.advanceTimersByTimeAsync(150)

    expect(fake.reloads).toEqual([['document', 'activity']])
  })

  it('drops signals the page has already seen', async () => {
    const { fake } = install()
    navigate(binding('documents.a', ['document'], 5))
    await nextTick()

    fake.emit('documents.a', 5)
    await vi.advanceTimersByTimeAsync(500)

    expect(fake.reloads).toEqual([])
  })

  it('catches cursors up from the fresh _live prop of a reload', async () => {
    const { fake } = install()
    navigate(binding('documents.a', ['document'], 0))
    await nextTick()

    navigate(binding('documents.a', ['document'], 9)) // what a reload response carries
    await nextTick()
    fake.emit('documents.a', 9)
    await vi.advanceTimersByTimeAsync(500)

    expect(fake.reloads).toEqual([])
  })

  it('leaves channels and stops reloading when the app unmounts', async () => {
    const { fake, app } = install()
    vi.spyOn(console, 'warn').mockImplementation(() => {}) // no DOM here, so the app was never mounted
    navigate(binding('documents.a', ['document']))
    await nextTick()

    app.unmount()
    fake.emit('documents.a', 1)
    await vi.advanceTimersByTimeAsync(500)

    expect(fake.joined.size).toBe(0)
    expect(fake.reloads).toEqual([])
  })
})

describe('inertiaReloader', () => {
  it('calls router.reload with the props and resolves when the visit finishes', async () => {
    await inertiaReloader(['document'])

    expect(inertia.router.reload).toHaveBeenCalledWith(
      expect.objectContaining({ only: ['document'], onFinish: expect.any(Function) }),
    )
  })
})

describe('useLive', () => {
  it('throws a clear error without the plugin', () => {
    const app = createApp({ render: () => null })

    expect(() => app.runWithContext(() => useLive())).toThrow('InertiaLive plugin')
  })

  it('exposes reactive status and lastSyncedAt', async () => {
    const { fake, app } = install()
    navigate(binding('documents.a', ['document']))
    await nextTick()

    const live = app.runWithContext(() => useLive())
    expect(live.status.value).toBe('live')
    expect(live.lastSyncedAt.value).toBeNull()

    fake.setConnectionState('unavailable')
    expect(live.status.value).toBe('reconnecting')

    fake.setConnectionState('connected')
    await vi.advanceTimersByTimeAsync(0) // reconnect reload
    expect(live.status.value).toBe('live')
    expect(live.lastSyncedAt.value).toBeInstanceOf(Date)
  })

  it('pause defers the reload until resume', async () => {
    const { fake, app } = install()
    navigate(binding('documents.a', ['document']))
    await nextTick()
    const live = app.runWithContext(() => useLive())

    live.pause()
    fake.emit('documents.a', 1)
    await vi.advanceTimersByTimeAsync(1000)
    expect(fake.reloads).toEqual([])

    live.resume()
    await vi.advanceTimersByTimeAsync(150)
    expect(fake.reloads).toEqual([['document']])
  })

  it('refresh reloads every bound prop immediately', async () => {
    const { fake, app } = install()
    navigate(binding('documents.a', ['document']), binding('comments.a', ['comments']))
    await nextTick()
    const live = app.runWithContext(() => useLive())

    await live.refresh()

    expect(new Set(fake.reloads[0])).toEqual(new Set(['document', 'comments']))
  })
})

describe('createFakeLive (vue)', () => {
  it('returns plugin options that wire the fake echo and reloader', () => {
    const fake = createFakeLive({ debounceMs: 0 })

    expect(fake.options.echo).toBe(fake.echo)
    expect(fake.options.reload).toBe(fake.reload)
    expect(fake.options.debounceMs).toBe(0)
  })
})
