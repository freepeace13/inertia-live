import type { LiveClient } from '@freepeace13/inertia-live-core'
import { createContext } from 'react'

export interface LiveContextValue {
  /** Null until the provider's effect has created the client (and during SSR). */
  client: LiveClient | null
}

export const LiveContext = createContext<LiveContextValue | undefined>(undefined)
