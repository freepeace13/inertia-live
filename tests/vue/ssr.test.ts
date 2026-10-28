import { InertiaLive, useLive } from '@freepeace13/inertia-live-vue'
import { createFakeLive } from '@freepeace13/inertia-live-vue/testing'
import { createSSRApp, defineComponent, h } from 'vue'
import { renderToString } from 'vue/server-renderer'

vi.mock('@inertiajs/vue3', () => ({
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

const Status = defineComponent({
  setup() {
    const { status, stale, lastSyncedAt } = useLive()
    return () => h('p', `${status.value}|${stale.value}|${lastSyncedAt.value ?? 'never'}`)
  },
})

describe('rendering on the server', () => {
  it('renders a page that uses useLive() without a window, and opens nothing', async () => {
    expect(typeof window).toBe('undefined')
    const fake = createFakeLive()
    const app = createSSRApp(Status)
    app.use(InertiaLive, fake.options)

    const html = await renderToString(app)

    expect(html).toBe('<p>connecting|false|never</p>')
    expect(fake.joined.size).toBe(0)
    expect(fake.reloads).toEqual([])
  })
})
