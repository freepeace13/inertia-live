import type { EchoLike } from './types.js'

export const SOCKET_ID_HEADER = 'X-Socket-ID'

/**
 * Adds the socket id to a request's headers so the server skips the sender's own signal.
 * laravel-echo only does this itself for axios, jQuery and Turbo; Inertia needs it set.
 */
export function withSocketId(echo: EchoLike, headers: Record<string, string>): void {
  const id = echo.socketId?.()
  if (id && !(SOCKET_ID_HEADER in headers)) headers[SOCKET_ID_HEADER] = id
}
