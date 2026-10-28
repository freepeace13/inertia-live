export interface Binding {
  topic: string
  channel: string
  props: string[]
  cursor: number
  /** Public topics subscribe with `echo.channel` instead of `echo.private`. */
  public?: boolean
}

export interface LiveProp {
  bindings: Binding[]
  /** URL of the server's cursors endpoint. Absent on servers that do not have one. */
  cursors?: string
}

/**
 * Asks the cursors endpoint for the current cursor of each topic. Resolves to a map that omits
 * topics the caller may not subscribe to. Rejects if the request fails.
 */
export type FetchCursors = (url: string, topics: string[]) => Promise<Record<string, number>>

/** The broadcast payload: never contains model data. */
export interface ChangeSignal {
  topic: string
  version: number
  props: string[]
  /** Wire protocol version. Absent on 0.1.x servers, which means protocol 1. */
  protocol?: number
}

export type LiveStatus = 'connecting' | 'live' | 'reconnecting' | 'offline'

/** Reloads the given props, e.g. `router.reload({ only })`. Resolves when the reload finished. */
export type Reloader = (only: string[]) => Promise<void>

/** @experimental */
export interface EchoChannelLike {
  listen(event: string, callback: (payload: ChangeSignal) => void): EchoChannelLike
  /** Fires once the server confirms the subscription. Optional: not every driver has it. */
  subscribed?(callback: () => void): EchoChannelLike
}

/** The subset of laravel-echo that LiveClient needs. */
export interface EchoLike {
  private(channel: string): EchoChannelLike
  channel(channel: string): EchoChannelLike
  leave(channel: string): void
  /** The socket id the server uses to exclude the sender. laravel-echo provides it. */
  socketId?(): string | undefined
  connector?: { pusher?: { connection?: ConnectionLike } }
}

/**
 * Pusher-protocol connection (Reverb, Pusher). Other drivers can supply their own.
 *
 * @experimental
 */
export interface ConnectionLike {
  state?: string
  bind(event: string, callback: (payload: { current: string }) => void): unknown
  unbind(event: string, callback?: (payload: { current: string }) => void): unknown
}

/** Reject with this when another visit cancelled the reload: it is retried, not counted as a failure. */
export class ReloadCancelled extends Error {
  constructor() {
    super('Live reload was cancelled by another visit.')
    this.name = 'ReloadCancelled'
  }
}
