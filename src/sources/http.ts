/** Bound feed latency so one stalled upstream cannot hold the daily job open. */
export function fetchSource(url: string, init: RequestInit = {}): Promise<Response> {
  return fetch(url, { ...init, signal: init.signal ?? AbortSignal.timeout(20_000) });
}
