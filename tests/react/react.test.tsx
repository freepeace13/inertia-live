// @vitest-environment jsdom

import type { Binding } from '@freepeace13/inertia-live-core'
import { InertiaLiveProvider, inertiaReloader, useLive } from '@freepeace13/inertia-live-react'
import { createFakeLive } from '@freepeace13/inertia-live-react/testing'
import * as inertia from '@inertiajs/react'
import { act, cleanup, render } from '@testing-library/react'
import { StrictMode, useEffect } from 'react'

const current = vi.hoisted(() => ({
  props: {} as Record<string, unknown>,
  handlers: {} as Record<string, (event?: unknown) => void>,
}))

vi.mock('@inertiajs/react', () => ({
  usePage: () => ({ props: current.props }),
  router: {
    reload: vi.fn((options: { onFinish?: () => void }) => options.onFinish?.()),
    on: vi.fn((event: string, callback: (event?: unknown) => void) => {
      current.handlers[event] = callback
      return () => delete current.handlers[event]
    }),
  },
}))

const binding = (topic: string, props: string[], cursor = 0): Binding => ({
  topic,
  channel: `live.${topic}`,
  props,
  cursor,
})

const pageWith = (...bindings: Binding[]) => (bindings.length > 0 ? { _live: { bindings } } : {})

function Status() {
  const { status, lastSyncedAt } = useLive()
  return (
    <p data-testid="status">
      {status}|{lastSyncedAt ? 'synced' : 'never'}
    </p>
  )
}

let controls: ReturnType<typeof useLive>
function Controls() {
  controls = useLive()
  return null
}

beforeEach(() => {
  vi.useFakeTimers()
  current.props = {}
  vi.mocked(inertia.router.reload).mockClear()
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

function mount(fake = createFakeLive(), strict = false) {
  // A fresh element each time, so rerender() really re-renders instead of bailing out.
  const tree = () => {
    const element = (
      <InertiaLiveProvider {...fake.providerProps}>
        <Status />
        <Controls />
      </InertiaLiveProvider>
    )
    return strict ? <StrictMode>{element}</StrictMode> : element
  }
  const view = render(tree())
  const navigate = (...bindings: Binding[]) => {
    current.props = pageWith(...bindings)
    view.rerender(tree())
  }
  return { fake, view, navigate }
}

describe('InertiaLiveProvider', () => {
  it('subscribes to the bindings of the current page on mount', () => {
    current.props = pageWith(binding('documents.a', ['document']))

    const { fake } = mount()

    expect([...fake.joined]).toEqual(['live.documents.a'])
  })

  it('syncs subscriptions on every navigation', () => {
    const { fake, navigate } = mount()

    navigate(binding('documents.a', ['document']))
    navigate(binding('documents.b', ['document']))

    expect([...fake.joined]).toEqual(['live.documents.b'])
    expect(fake.left).toEqual(['live.documents.a'])
  })

  it('leaves all channels on pages without _live', () => {
    const { fake, navigate } = mount()

    navigate(binding('documents.a', ['document']))
    navigate()

    expect(fake.joined.size).toBe(0)
  })

  it('reloads the bound props once after a debounced burst of signals', async () => {
    const { fake, navigate } = mount()
    navigate(binding('documents.a', ['document', 'activity']))

    await act(async () => {
      fake.emit('documents.a', 1)
      fake.emit('documents.a', 2)
      await vi.advanceTimersByTimeAsync(150)
    })

    expect(fake.reloads).toEqual([['document', 'activity']])
  })

  it('drops signals the page has already seen', async () => {
    const { fake, navigate } = mount()
    navigate(binding('documents.a', ['document'], 5))

    await act(async () => {
      fake.emit('documents.a', 5)
      await vi.advanceTimersByTimeAsync(500)
    })

    expect(fake.reloads).toEqual([])
  })

  it('leaves channels and stops reloading on unmount', async () => {
    const { fake, navigate, view } = mount()
    navigate(binding('documents.a', ['document']))

    view.unmount()
    await act(async () => {
      fake.emit('documents.a', 1)
      await vi.advanceTimersByTimeAsync(500)
    })

    expect(fake.joined.size).toBe(0)
    expect(fake.reloads).toEqual([])
  })

  it('is safe under StrictMode double effects', async () => {
    current.props = pageWith(binding('documents.a', ['document']))

    const { fake, view } = mount(createFakeLive(), true)

    expect([...fake.joined]).toEqual(['live.documents.a'])

    await act(async () => {
      fake.emit('documents.a', 1)
      await vi.advanceTimersByTimeAsync(150)
    })
    expect(fake.reloads).toEqual([['document']])

    view.unmount()
    expect(fake.joined.size).toBe(0)
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
  it('throws a clear error outside the provider', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})

    expect(() => render(<Status />)).toThrow('InertiaLiveProvider')
  })

  it('renders live status and lastSyncedAt reactively', async () => {
    const { fake, navigate, view } = mount()
    navigate(binding('documents.a', ['document']))
    expect(view.getByTestId('status').textContent).toBe('live|never')

    await act(async () => {
      fake.setConnectionState('unavailable')
    })
    expect(view.getByTestId('status').textContent).toBe('reconnecting|never')

    await act(async () => {
      fake.setConnectionState('connected')
      await vi.advanceTimersByTimeAsync(0) // reconnect reload
    })
    expect(view.getByTestId('status').textContent).toBe('live|synced')
  })

  it('pause defers the reload until resume', async () => {
    const { fake, navigate } = mount()
    navigate(binding('documents.a', ['document']))

    await act(async () => {
      controls.pause()
      fake.emit('documents.a', 1)
      await vi.advanceTimersByTimeAsync(1000)
    })
    expect(fake.reloads).toEqual([])

    await act(async () => {
      controls.resume()
      await vi.advanceTimersByTimeAsync(150)
    })
    expect(fake.reloads).toEqual([['document']])
  })

  it('refresh reloads every bound prop immediately', async () => {
    const { fake, navigate } = mount()
    navigate(binding('documents.a', ['document']), binding('comments.a', ['comments']))

    await act(async () => {
      await controls.refresh()
    })

    expect(new Set(fake.reloads[0])).toEqual(new Set(['document', 'comments']))
  })

  it('adds the socket id to every visit so the server skips the sender', async () => {
    const { fake } = mount()
    fake.setSocketId('123.456')

    const visit = { headers: {} as Record<string, string> }
    current.handlers.before({ detail: { visit } })

    expect(visit.headers).toEqual({ 'X-Socket-ID': '123.456' })
  })

  it('drops pauses on navigation', async () => {
    const { fake, navigate } = mount()
    navigate(binding('documents.a', ['document']))

    await act(async () => {
      controls.pause()
      fake.emit('documents.a', 1)
      current.handlers.navigate()
      await vi.advanceTimersByTimeAsync(150)
    })

    expect(fake.reloads).toEqual([['document']])
  })

  it('applies a pause requested in a child mount effect before the client exists', async () => {
    const fake = createFakeLive()
    current.props = pageWith(binding('documents.a', ['document']))

    function PauseOnce() {
      const live = useLive()
      useEffect(() => {
        live.pause()
      }, [])
      return null
    }

    render(
      <InertiaLiveProvider {...fake.providerProps}>
        <PauseOnce />
      </InertiaLiveProvider>,
    )
    await act(async () => {
      fake.emit('documents.a', 1)
      await vi.advanceTimersByTimeAsync(1000)
    })

    expect(fake.reloads).toEqual([])
  })

  it('releases a component pause when it unmounts without resuming', async () => {
    const fake = createFakeLive()
    current.props = pageWith(binding('documents.a', ['document']))

    function PauseOnMount() {
      const live = useLive()
      useEffect(() => live.pause(), [live.pause])
      return null
    }

    const view = render(
      <InertiaLiveProvider {...fake.providerProps}>
        <PauseOnMount />
      </InertiaLiveProvider>,
    )
    await act(async () => {
      fake.emit('documents.a', 1)
      await vi.advanceTimersByTimeAsync(1000)
    })
    expect(fake.reloads).toEqual([])

    view.rerender(<InertiaLiveProvider {...fake.providerProps} />)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(150)
    })

    expect(fake.reloads).toEqual([['document']])
  })
})
