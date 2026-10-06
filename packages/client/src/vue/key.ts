import type { InjectionKey } from 'vue'
import type { LiveClient } from '../core/index.js'

export const LIVE_CLIENT_KEY: InjectionKey<LiveClient> = Symbol('inertia-live')
