import { ConnectionTracker } from './connection.js'
import { CursorStore } from './cursors.js'
import type {
  Binding,
  ChangeSignal,
  ConnectionLike,
  EchoLike,
  LiveProp,
  LiveStatus,
  Reloader,
} from './types.js'

export interface LiveClientOptions {
  echo: EchoLike
  reload: Reloader
  /** Debounce window before reloading. 0 reloads immediately. Default 150. */
  debounceMs?: number
  /** Override connection observation for non-Pusher Echo drivers. */
  connection?: ConnectionLike
  /** Called when a reload rejects. The queued props are not retried. */
  onError?: (error: unknown) => void
}

const SIGNAL_EVENT = '.live.changed'

export class LiveClient {
  private readonly echo: EchoLike
  private readonly reloader: Reloader
  private readonly debounceMs: number
  private readonly onError?: (error: unknown) => void

  private readonly cursors = new CursorStore()
  private readonly tracker: ConnectionTracker
  private readonly bindings = new Map<string, Binding>() // by channel
  private readonly pending = new Set<string>()
  private readonly unsubscribeTracker: () => void

  private timer: ReturnType<typeof setTimeout> | null = null
  private paused = false
  private reloading = false
  private destroyed = false
  private synced: Date | null = null

  constructor(options: LiveClientOptions) {
    this.echo = options.echo
    this.reloader = options.reload
    this.debounceMs = options.debounceMs ?? 150
    this.onError = options.onError

    this.tracker = new ConnectionTracker(options.echo, options.connection)
    this.unsubscribeTracker = this.tracker.onChange((status, previous) => {
      // Signals may have been missed while disconnected: reload everything once.
      if (status === 'live' && (previous === 'reconnecting' || previous === 'offline')) {
        void this.refresh()
      }
    })
  }

  get status(): LiveStatus {
    return this.tracker.status
  }

  get lastSyncedAt(): Date | null {
    return this.synced
  }

  onStatus(listener: (status: LiveStatus) => void): () => void {
    return this.tracker.onChange((status) => listener(status))
  }

  /** Make subscriptions match the page's bindings: join new channels, leave removed ones. */
  sync(liveProp: LiveProp | undefined | null): void {
    if (this.destroyed) return

    const next = new Map((liveProp?.bindings ?? []).map((binding) => [binding.channel, binding]))

    for (const [channel, binding] of this.bindings) {
      if (!next.has(channel)) {
        this.echo.leave(channel)
        this.cursors.forget(binding.topic)
        this.bindings.delete(channel)
      }
    }

    for (const [channel, binding] of next) {
      this.cursors.raise(binding.topic, binding.cursor)

      if (this.bindings.has(channel)) {
        this.bindings.set(channel, binding)
        continue
      }

      this.bindings.set(channel, binding)
      const subscription = binding.public ? this.echo.channel(channel) : this.echo.private(channel)
      subscription.listen(SIGNAL_EVENT, (signal) => this.receive(channel, signal))
    }
  }

  /** Call with the fresh `_live` prop after a reload so cursors catch up. */
  afterReload(liveProp: LiveProp | undefined | null): void {
    for (const binding of liveProp?.bindings ?? []) {
      this.cursors.raise(binding.topic, binding.cursor)
    }
    this.synced = new Date()
  }

  /** Hold reloads (e.g. while a form is being edited). Signals keep queueing. */
  pause(): void {
    this.paused = true
    this.clearTimer()
  }

  /** Resume reloads, flushing anything queued while paused. */
  resume(): void {
    this.paused = false
    if (this.pending.size > 0) this.schedule()
  }

  /** Reload every bound prop now. */
  async refresh(): Promise<void> {
    const props = this.boundProps()
    if (props.length === 0 || this.destroyed) return

    this.clearTimer()
    this.pending.clear()
    await this.run(props)
  }

  destroy(): void {
    this.destroyed = true
    this.clearTimer()
    this.pending.clear()
    for (const channel of this.bindings.keys()) this.echo.leave(channel)
    this.bindings.clear()
    this.unsubscribeTracker()
    this.tracker.destroy()
  }

  private receive(channel: string, signal: ChangeSignal): void {
    const binding = this.bindings.get(channel)
    if (!binding || this.destroyed) return
    if (!this.cursors.accept(binding.topic, signal.version)) return

    for (const prop of binding.props) this.pending.add(prop)
    this.schedule()
  }

  private schedule(): void {
    if (this.paused || this.reloading) return // a follow-up is scheduled when the reload ends

    this.clearTimer()

    if (this.debounceMs <= 0) {
      this.flush()
      return
    }

    this.timer = setTimeout(() => this.flush(), this.debounceMs)
  }

  private flush(): void {
    this.timer = null
    if (this.pending.size === 0) return

    const props = [...this.pending]
    this.pending.clear()
    void this.run(props)
  }

  private async run(props: string[]): Promise<void> {
    this.reloading = true
    try {
      await this.reloader(props)
      this.synced = new Date()
    } catch (error) {
      this.onError?.(error)
    } finally {
      this.reloading = false
      // Signals that arrived mid-flight need one follow-up reload.
      if (this.pending.size > 0 && !this.destroyed) this.schedule()
    }
  }

  private boundProps(): string[] {
    return [...new Set([...this.bindings.values()].flatMap((binding) => binding.props))]
  }

  private clearTimer(): void {
    if (this.timer !== null) clearTimeout(this.timer)
    this.timer = null
  }
}
