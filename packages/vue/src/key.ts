import type { LiveClient } from '@freepeace13/inertia-live-core'
import type { InjectionKey } from 'vue'

export const LIVE_CLIENT_KEY: InjectionKey<LiveClient> = Symbol('inertia-live')
