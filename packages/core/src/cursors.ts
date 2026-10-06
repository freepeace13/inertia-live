/** Last version seen per topic. Signals at or below the cursor are stale. */
export class CursorStore {
  private cursors = new Map<string, number>()

  get(topic: string): number {
    return this.cursors.get(topic) ?? 0
  }

  /** Raise the cursor; never moves it backwards. */
  raise(topic: string, version: number): void {
    if (Number.isFinite(version) && version > this.get(topic)) this.cursors.set(topic, version)
  }

  /** Accept a signal if it is newer than the cursor, advancing the cursor. */
  accept(topic: string, version: number): boolean {
    if (!Number.isFinite(version) || version <= this.get(topic)) return false
    this.cursors.set(topic, version)
    return true
  }

  forget(topic: string): void {
    this.cursors.delete(topic)
  }
}
