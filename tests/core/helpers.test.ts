import type { EchoLike } from '@freepeace13/inertia-live-core'
import {
  createInertiaReloader,
  ReloadCancelled,
  type ReloadRouter,
  SOCKET_ID_HEADER,
  withSocketId,
} from '@freepeace13/inertia-live-core'

const echoWith = (id: string | undefined): EchoLike =>
  ({ socketId: () => id }) as unknown as EchoLike

describe('withSocketId', () => {
  it('uses the header name the server excludes by', () => {
    expect(SOCKET_ID_HEADER).toBe('X-Socket-ID')
  })

  it('adds the socket id to the headers', () => {
    const headers: Record<string, string> = {}

    withSocketId(echoWith('123.456'), headers)

    expect(headers).toEqual({ 'X-Socket-ID': '123.456' })
  })

  it('keeps a header the caller already set', () => {
    const headers = { 'X-Socket-ID': 'mine' }

    withSocketId(echoWith('123.456'), headers)

    expect(headers['X-Socket-ID']).toBe('mine')
  })

  it('adds nothing without a socket id', () => {
    const headers: Record<string, string> = {}

    withSocketId(echoWith(undefined), headers)
    withSocketId({} as EchoLike, headers)

    expect(headers).toEqual({})
  })
})

describe('createInertiaReloader', () => {
  type Options = Parameters<ReloadRouter['reload']>[0]

  function setup() {
    let options: Options | undefined
    const router: ReloadRouter = {
      reload: (given) => {
        options = given
      },
    }
    return { reload: createInertiaReloader(router), options: () => options as Options }
  }

  it('asks the router for a partial reload of the given props', () => {
    const { reload, options } = setup()

    void reload(['document', 'activity'])

    expect(options().only).toEqual(['document', 'activity'])
  })

  it('resolves when the visit finishes', async () => {
    const { reload, options } = setup()

    const done = reload(['document'])
    options().onFinish()

    await expect(done).resolves.toBeUndefined()
  })

  it('rejects with the errors the visit reported', async () => {
    const { reload, options } = setup()

    const done = reload(['document'])
    options().onError({ title: 'required' })
    options().onFinish()

    await expect(done).rejects.toEqual({ title: 'required' })
  })

  it('rejects with ReloadCancelled when another visit cancels it', async () => {
    const { reload, options } = setup()

    const done = reload(['document'])
    options().onCancel()
    options().onFinish()

    await expect(done).rejects.toBeInstanceOf(ReloadCancelled)
  })
})
