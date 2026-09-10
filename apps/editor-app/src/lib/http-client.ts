import { requireViteEnv } from './require-vite-env';

// Exported for the one case that cannot go through `request()`: a file
// download, where the browser has to do the fetching itself for the save
// dialog to appear (forms-api-client.ts's CSV export).
export const API_BASE_URL = requireViteEnv('VITE_API_URL');

// Security review 2026-08-24, point 18: without this, a backend that hangs
// (pool exhausted, a slow query) left the editor tab stuck indefinitely —
// no error, no retry, just a spinner forever. 20s is generous for an admin
// UI (uploads use their own longer budget below), not a snappy-UX target.
const DEFAULT_TIMEOUT_MS = 20_000;
const UPLOAD_TIMEOUT_MS = 60_000;

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: unknown,
  ) {
    super(`API ${status}: ${JSON.stringify(body)}`);
    this.name = 'ApiError';
  }

  /**
   * The server's own sentence, for showing to a person.
   *
   * `message` keeps the status and the raw body, which is what you want
   * in a log and never what you want on screen: rendered with String(),
   * an ordinary refusal reached the reader as
   * `ApiError: API 403: {"message":"...","statusCode":403}`.
   */
  get displayMessage(): string | null {
    if (!this.body || typeof this.body !== 'object') return null;
    const message = (this.body as { message?: unknown }).message;
    return typeof message === 'string' && message ? message : null;
  }
}

/**
 * What to put in front of a person when an action fails: the server's
 * explanation when it gave one, and the caller's own fallback when it
 * did not (a timeout, the network, a bug).
 */
export function actionErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) return error.displayMessage ?? fallback;
  return fallback;
}

export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  // A FormData body (media upload) must NOT get a manual Content-Type: the
  // browser sets its own, with the multipart boundary baked in — forcing
  // application/json here would send the boundary-delimited body under the
  // wrong content type and the server would fail to parse it. It also gets
  // a longer timeout budget: an upload's own transfer time counts against
  // the same clock as the server's response.
  const isFormData = init?.body instanceof FormData;
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      credentials: 'include',
      signal: AbortSignal.timeout(
        isFormData ? UPLOAD_TIMEOUT_MS : DEFAULT_TIMEOUT_MS,
      ),
      headers: {
        ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
        ...init?.headers,
      },
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'TimeoutError') {
      throw new Error(`Request timed out: ${path}`);
    }
    throw error;
  }
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new ApiError(res.status, body);
  }
  // 204 No Content (e.g. DELETE) has no body to parse.
  if (res.status === 204) {
    return undefined as T;
  }
  return res.json();
}
