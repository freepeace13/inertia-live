// @vitest-environment node

import { InertiaLiveProvider, useLive } from '@freepeace13/inertia-live-react'
import { createFakeLive } from '@freepeace13/inertia-live-react/testing'
import { renderToString } from 'react-dom/server'

vi.mock('@inertiajs/react', () => ({
  usePage: () => ({
    props: {
      _live: {
        bindings: [
          { topic: 'documents.a', channel: 'live.documents.a', props: ['document'], cursor: 0 },
        ],
      },
    },
  }),
  router: { reload: vi.fn(), on: vi.fn() },
}))

function Status() {
  const { status, stale, lastSyncedAt } = useLive()
  return (
    <p>
      {status}|{String(stale)}|{lastSyncedAt ? 'synced' : 'never'}
    </p>
  )
}

describe('rendering on the server', () => {
  it('renders a page that uses useLive() without a window, and opens nothing', () => {
    expect(typeof window).toBe('undefined')
    const fake = createFakeLive()

    const html = renderToString(
      <InertiaLiveProvider {...fake.providerProps}>
        <Status />
      </InertiaLiveProvider>,
    )

    expect(html.replace(/<!-- -->/g, '')).toBe('<p>connecting|false|never</p>')
    expect(fake.joined.size).toBe(0)
    expect(fake.reloads).toEqual([])
  })
})
