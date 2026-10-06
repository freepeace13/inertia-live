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
import { ReloadCancelled } from './types.js'

export interface LiveClientOptions {
  echo: EchoLike
  reload: Reloader
  /** Debounce window before reloading. 0 reloads immediately. Default 150. */
  debounceMs?: number
  /** Override connection observation for non-Pusher Echo drivers. */
  connection?: ConnectionLike
  /**
   * Longest a steady stream of signals can postpone a reload. Default `debounceMs * 4`.
   * Without it a signal every few hundred ms would restart the debounce forever.
   */
  maxWaitMs?: number
  /** Called each time a reload rejects. The props are re-queued and retried with backoff. */
  onError?: (error: unknown) => void
}

const SIGNAL_EVENT = '.live.changed'
const RETRY_BASE_MS = 1000
const RETRY_MAX_MS = 30_000
const MAX_RETRIES = 5

export class LiveClient {
  private readonly echo: EchoLike
  private readonly reloader: Reloader
  private readonly debounceMs: number
  private readonly maxWaitMs: number
  private readonly onError?: (error: unknown) => void

  private readonly cursors = new CursorStore()
  private readonly tracker: ConnectionTracker
  private readonly bindings = new Map<string, Binding>() // by channel
  private readonly pending = new Set<string>()
  /**
   * Channels subscribed since their last `_live` refresh: a cursor jump there means a missed
   * signal. The value is `runSeq` when the subscription was confirmed; only a reload started
   * after that can vouch for the channel, because an earlier request may predate the ack.
   */
  private readonly verifying = new Map<string, number>()
  private readonly holds = new Set<symbol>()
  private readonly unsubscribeTracker: () => void

  private timer: ReturnType<typeof setTimeout> | null = null
  private reloading = false
  private inFlight: Promise<void> | null = null
  private runSeq = 0
  private failures = 0
  private burstStart: number | null = null
  private destroyed = false
  private synced: Date | null = null
  private readonly syncListeners = new Set<(at: Date) => void>()
  private isStale = false
  private readonly staleListeners = new Set<(stale: boolean) => void>()

  constructor(options: LiveClientOptions) {
    this.echo = options.echo
    this.reloader = options.reload
    this.debounceMs = options.debounceMs ?? 150
    this.maxWaitMs = options.maxWaitMs ?? this.debounceMs * 4
    this.onError = options.onError

    this.tracker = new ConnectionTracker(options.echo, options.connection)
    this.unsubscribeTracker = this.tracker.onChange((status, previous) => {
      // Signals may have been missed while disconnected: reload everything once.
      if (status === 'live' && (previous === 'reconnecting' || previous === 'offline')) {
        this.catchUp()
      }
    })
  }

  get status(): LiveStatus {
    return this.tracker.status
  }

  get lastSyncedAt(): Date | null {
    return this.synced
  }

  /** True once reloads gave up after repeated failures: the page may show outdated data. */
  get stale(): boolean {
    return this.isStale
  }

  /** Called when `stale` flips. A later successful reload clears it. Returns an unsubscribe function. */
  onStale(listener: (stale: boolean) => void): () => void {
    this.staleListeners.add(listener)
    return () => this.staleListeners.delete(listener)
  }

  onStatus(listener: (status: LiveStatus) => void): () => void {
    return this.tracker.onChange((status) => listener(status))
  }

  /** Called whenever a reload finishes or fresh cursors arrive. Returns an unsubscribe function. */
  onSynced(listener: (at: Date) => void): () => void {
    this.syncListeners.add(listener)
    return () => this.syncListeners.delete(listener)
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
        this.verifying.delete(channel)
      }
    }

    for (const [channel, binding] of next) {
      // A fresh cursor ahead of ours, right after subscribing, means a signal slipped through
      // between render and subscription. The props in this response may predate it.
      const ackedAt = this.verifying.get(channel)
      const vouched = ackedAt !== undefined && this.runSeq > ackedAt
      const missed = vouched && binding.cursor > this.cursors.get(binding.topic)
      if (vouched) this.verifying.delete(channel)
      this.cursors.raise(binding.topic, binding.cursor)
      if (missed) {
        for (const prop of binding.props) this.pending.add(prop)
        this.schedule()
      }

      if (this.bindings.has(channel)) {
        this.bindings.set(channel, binding)
        continue
      }

      this.bindings.set(channel, binding)
      const subscription = binding.public ? this.echo.channel(channel) : this.echo.private(channel)
      subscription.listen(SIGNAL_EVENT, (signal) => this.receive(channel, signal))
      subscription.subscribed?.(() => this.verify(channel))
    }
  }

  /**
   * Hold reloads (e.g. while a form is being edited). Signals keep queueing. Pauses are
   * counted, so several holders can overlap; call the returned function (once) to release
   * this one. `useLive()` does that for you when its component goes away.
   */
  pause(): () => void {
    const token = Symbol('pause')
    this.holds.add(token)
    this.clearTimer()
    this.burstStart = null

    // Releasing deletes only this hold, so a release that outlives `resetPause()` cannot
    // lift a pause someone else took on the next page.
    return () => this.release(token)
  }

  /** Release the most recent pause. Prefer the function `pause()` returns. */
  resume(): void {
    const latest = [...this.holds].pop()
    if (latest) this.release(latest)
  }

  /** Drop every pause, e.g. on navigation: whatever paused the old page is gone. */
  resetPause(): void {
    this.holds.clear()
    if (this.pending.size > 0) this.schedule()
  }

  private release(token: symbol): void {
    if (!this.holds.delete(token)) return
    if (this.holds.size === 0 && this.pending.size > 0) this.schedule()
  }

  /** Reload every bound prop now. */
  async refresh(): Promise<void> {
    const props = this.boundProps()
    if (props.length === 0 || this.destroyed) return

    this.clearTimer()
    this.burstStart = null

    // Reloads never overlap: queue behind the one in flight, which runs a follow-up when it ends.
    if (this.reloading) {
      for (const prop of props) this.pending.add(prop)
      await this.inFlight
      return
    }

    this.pending.clear()
    await this.run(props)
  }

  destroy(): void {
    this.destroyed = true
    this.clearTimer()
    this.verifying.clear()
    this.pending.clear()
    for (const channel of this.bindings.keys()) this.echo.leave(channel)
    this.bindings.clear()
    this.unsubscribeTracker()
    this.tracker.destroy()
    this.syncListeners.clear()
    this.staleListeners.clear()
  }

  /** After a reconnect every bound prop may be stale. Paused clients queue it instead of reloading. */
  private catchUp(): void {
    if (this.holds.size === 0) {
      void this.refresh()
      return
    }

    for (const prop of this.boundProps()) this.pending.add(prop)
  }

  private receive(channel: string, signal: ChangeSignal): void {
    const binding = this.bindings.get(channel)
    if (!binding || this.destroyed) return
    if (!this.cursors.accept(binding.topic, signal.version)) return

    // Reload only what the signal says changed AND the page binds. A signal without
    // prop keys means "unknown", so fall back to every bound prop.
    const changed = Array.isArray(signal.props) ? signal.props : []
    const affected =
      changed.length > 0 ? binding.props.filter((prop) => changed.includes(prop)) : binding.props

    if (affected.length === 0) return // the page shows nothing this change touched

    for (const prop of affected) this.pending.add(prop)
    this.schedule()
  }

  /** The channel just subscribed: re-read `_live` so `sync()` can spot a missed signal. */
  private verify(channel: string): void {
    if (this.destroyed || !this.bindings.has(channel)) return
    this.verifying.set(channel, this.runSeq)
    // One debounced `_live` read covers every channel confirmed in the same burst, and
    // runs after any in-flight reload, whose response may predate this ack.
    this.pending.add('_live')
    this.schedule()
  }

  private schedule(): void {
    if (this.holds.size > 0 || this.reloading) return // a follow-up is scheduled when the reload ends

    this.clearTimer()

    const delay = this.nextDelay()
    if (delay <= 0) {
      this.flush()
      return
    }

    this.timer = setTimeout(() => this.flush(), delay)
  }

  private nextDelay(): number {
    // After a failure, back off instead of hammering a broken endpoint.
    if (this.failures > 0) {
      return Math.min(RETRY_BASE_MS * 2 ** (this.failures - 1), RETRY_MAX_MS)
    }
    if (this.debounceMs <= 0) return 0

    // Each signal restarts the quiet window, but never past maxWaitMs since the first one.
    this.burstStart ??= Date.now()
    return Math.min(this.debounceMs, Math.max(0, this.burstStart + this.maxWaitMs - Date.now()))
  }

  private flush(): void {
    this.timer = null
    this.burstStart = null
    if (this.pending.size === 0) return

    const props = [...this.pending]
    this.pending.clear()
    void this.run(props)
  }

  private run(props: string[]): Promise<void> {
    this.reloading = true
    this.runSeq += 1
    const done = this.execute(props)
    this.inFlight = done
    return done
  }

  private async execute(props: string[]): Promise<void> {
    try {
      await this.reloader(props)
      this.failures = 0
      this.markSynced()
    } catch (error) {
      if (error instanceof ReloadCancelled) {
        // Another visit pre-empted this reload. Not a failure: just try again.
        if (!this.destroyed) for (const prop of props) this.pending.add(prop)
        return
      }
      this.onError?.(error)
      // The cursor already moved past this change, so no later signal re-delivers it: retry.
      this.failures += 1
      if (this.failures > MAX_RETRIES) {
        this.failures = 0 // give up; refresh() or the next signal recovers
        this.setStale(true)
      } else if (!this.destroyed) {
        for (const prop of props) this.pending.add(prop)
      }
    } finally {
      this.reloading = false
      this.inFlight = null
      // Signals that arrived mid-flight (or a failed reload) need a follow-up reload.
      if (this.pending.size > 0 && !this.destroyed) this.schedule()
    }
  }

  private setStale(stale: boolean): void {
    if (this.isStale === stale) return
    this.isStale = stale
    for (const listener of this.staleListeners) listener(stale)
  }

  private markSynced(): void {
    this.setStale(false)
    this.synced = new Date()
    for (const listener of this.syncListeners) listener(this.synced)
  }

  private boundProps(): string[] {
    return [...new Set([...this.bindings.values()].flatMap((binding) => binding.props))]
  }

  private clearTimer(): void {
    if (this.timer !== null) clearTimeout(this.timer)
    this.timer = null
  }
}
