import { createContext } from 'react'
import type { LiveClient } from '../core/index.js'

export interface LiveContextValue {
  /** Null until the provider's effect has created the client (and during SSR). */
  client: LiveClient | null
}

export const LiveContext = createContext<LiveContextValue | undefined>(undefined)
