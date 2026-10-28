import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import type { Binding } from '@freepeace13/inertia-live-core'
import { LiveClient } from '@freepeace13/inertia-live-core'
import { createFakeLive } from '@freepeace13/inertia-live-core/testing'

// The fixture is shared with the Laravel package. The canonical copy is
// inertia-live-docs/v1/fixtures/protocol-1.json; both repos carry an identical copy.
const path = (relative: string) => fileURLToPath(new URL(relative, import.meta.url))
const raw = readFileSync(path('./fixtures/protocol-1.json'), 'utf8')
const fixture = JSON.parse(raw)

interface SignalCase {
  name: string
  payload: { topic: string; version: number; props: string[]; protocol: number }
}

interface ClientCase {
  name: string
  bindings: Array<{ topic: string; props: string[]; cursor: number }>
  signals: Array<{ topic: string; version: number; props: string[]; protocol?: number }>
  reloads: string[][]
  errors?: number
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('protocol 1 fixtures', () => {
  it('matches the canonical copy in the docs repo when it is checked out alongside', () => {
    const canonical = path('../../../inertia-live-docs/v1/fixtures/protocol-1.json')
    if (!existsSync(canonical)) return

    expect(raw).toBe(readFileSync(canonical, 'utf8'))
  })

  it('declares protocol 1', () => {
    expect(fixture.protocol).toBe(1)
  })

  it.each(fixture.signals as SignalCase[])('has a well-formed $name payload', ({ payload }) => {
    expect(Object.keys(payload).sort()).toEqual(['props', 'protocol', 'topic', 'version'])
    expect(typeof payload.topic).toBe('string')
    expect(Number.isSafeInteger(payload.version)).toBe(true)
    expect(payload.props.every((prop: unknown) => typeof prop === 'string')).toBe(true)
    expect(payload.protocol).toBe(1)
  })

  it('has a well-formed _live payload', () => {
    const { bindings, cursors } = fixture.live.payload

    expect(typeof cursors).toBe('string')
    for (const binding of bindings as Binding[]) {
      expect(Object.keys(binding).sort()).toEqual(['channel', 'cursor', 'props', 'public', 'topic'])
      expect(binding.channel).toBe(`live.${binding.topic}`)
      expect(binding.props.length).toBeGreaterThan(0)
      expect(Number.isSafeInteger(binding.cursor)).toBe(true)
      expect(typeof binding.public).toBe('boolean')
    }
  })

  it('has a cursors response that answers each requested topic with an integer', () => {
    const { request, cursors } = fixture.cursorsResponse

    expect(Object.keys(cursors).sort()).toEqual([...request.topics].sort())
    for (const cursor of Object.values(cursors)) expect(Number.isSafeInteger(cursor)).toBe(true)
  })
})

describe('client behavior from the fixtures', () => {
  it.each(fixture.clientCases as ClientCase[])('$name', async (testCase) => {
    const onError = vi.fn()
    const fake = createFakeLive()
    const client = new LiveClient({ echo: fake.echo, reload: fake.reload, onError })
    fake.setConnectionState('connected')

    client.sync({
      bindings: testCase.bindings.map(
        (binding): Binding => ({ ...binding, channel: `live.${binding.topic}` }),
      ),
    })
    for (const signal of testCase.signals) {
      fake.emit(signal.topic, signal.version, signal.props, signal.protocol)
    }
    await vi.advanceTimersByTimeAsync(150)

    expect(fake.reloads).toEqual(testCase.reloads)
    expect(onError).toHaveBeenCalledTimes(testCase.errors ?? 0)
  })
})
