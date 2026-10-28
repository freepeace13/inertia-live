import type { FetchCursors } from './types.js'

/** The most topics one request to the cursors endpoint may carry. */
export const MAX_CURSOR_TOPICS = 50

/** Default `fetchCursors`: a same-origin GET with the session cookies. */
export const fetchCursorsWithFetch: FetchCursors = async (url, topics) => {
  const query = topics.map((topic) => `topics[]=${encodeURIComponent(topic)}`).join('&')
  const response = await fetch(`${url}${url.includes('?') ? '&' : '?'}${query}`, {
    headers: { Accept: 'application/json' },
    credentials: 'same-origin',
  })
  if (!response.ok) throw new Error(`The cursors request failed with status ${response.status}.`)

  const body = (await response.json()) as { cursors?: Record<string, number> }
  return body.cursors ?? {}
}
