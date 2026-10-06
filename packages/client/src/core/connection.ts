import type { ConnectionLike, EchoLike, LiveStatus } from './types.js'

type StatusListener = (status: LiveStatus, previous: LiveStatus) => void

/** Maps a Pusher-protocol connection state to a LiveStatus. */
function mapState(state: string, hasBeenLive: boolean): LiveStatus | null {
  switch (state) {
    case 'connected':
      return 'live'
    case 'initialized':
    case 'connecting':
      return hasBeenLive ? 'reconnecting' : 'connecting'
    case 'unavailable':
      return 'reconnecting'
    case 'disconnected':
    case 'failed':
      return 'offline'
    default:
      return null
  }
}

export class ConnectionTracker {
  private current: LiveStatus
  private hasBeenLive = false
  private listeners = new Set<StatusListener>()
  private readonly connection?: ConnectionLike

  constructor(echo: EchoLike, connection?: ConnectionLike) {
    this.connection = connection ?? echo.connector?.pusher?.connection
    // Without a connection to observe (non-Pusher drivers) assume live.
    this.current = this.connection ? 'connecting' : 'live'

    if (this.connection) {
      this.apply(this.connection.state)
      this.connection.bind('state_change', this.onStateChange)
    }
  }

  get status(): LiveStatus {
    return this.current
  }

  onChange(listener: StatusListener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  destroy(): void {
    this.connection?.unbind('state_change', this.onStateChange)
    this.listeners.clear()
  }

  private onStateChange = (payload: { current: string }): void => {
    this.apply(payload.current)
  }

  private apply(state: string | undefined): void {
    if (!state) return

    const next = mapState(state, this.hasBeenLive)
    if (next === null || next === this.current) return

    const previous = this.current
    this.current = next
    if (next === 'live') this.hasBeenLive = true

    for (const listener of this.listeners) listener(next, previous)
  }
}
