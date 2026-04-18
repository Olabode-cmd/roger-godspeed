/**
 * retryHandler.ts
 *
 * Implements request retries with respect for HTTP status codes,
 * idempotency, Retry-After headers, and abort signals.
 *
 * The retry delay integrates with the pipeline's AbortSignal so
 * that timeouts are respected even during backoff sleep periods.
 * Without this integration, a Retry-After header could cause the
 * client to sleep indefinitely past the configured timeout.
 *
 * Performance note: Avoids excessive object creation during loops.
 * The retryable status set is allocated once at module level.
 *
 * Dependencies: backoff, types.
 */
import { calculateFullJitter } from './backoff';
import type { GodspeedConfig } from '../types';

const RETRYABLE_STATUS = new Set([408, 429, 500, 502, 503, 504]);

/**
 * Determines whether an HTTP method is idempotent.
 * Only idempotent methods are eligible for automatic retries
 * to prevent duplicate side effects on the server.
 */
export function isIdempotent(method: string): boolean {
  return ['GET', 'HEAD', 'OPTIONS', 'PUT', 'DELETE'].includes(method.toUpperCase());
}

/**
 * Parses a Retry-After header value into milliseconds.
 *
 * Supports two formats per RFC 7231:
 *   - Seconds (integer string): converted directly to milliseconds
 *   - HTTP-date: parsed and converted to a relative delay from now
 *
 * Returns undefined if the header is null or unparseable.
 */
export function parseRetryAfter(header: string | null): number | undefined {
  if (!header) return undefined;

  const asSeconds = parseInt(header, 10);
  if (!Number.isNaN(asSeconds) && asSeconds.toString() === header) {
    return asSeconds * 1000;
  }

  const date = Date.parse(header);
  if (!Number.isNaN(date)) {
    const diff = date - Date.now();
    return diff > 0 ? diff : 0;
  }

  return undefined;
}

/**
 * Creates a delay that can be interrupted by an AbortSignal.
 *
 * If the signal is already aborted, rejects immediately.
 * If the signal aborts during the delay, clears the timer and rejects
 * with the signal's reason. Cleans up the abort listener when the
 * timer fires normally to prevent memory leaks on long-lived signals.
 */
function abortableDelay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason);
      return;
    }

    const onAbort = () => {
      clearTimeout(timer);
      reject(signal!.reason);
    };

    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);

    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

/**
 * Executes a fetch task with automatic retries for idempotent requests
 * that receive retryable status codes or network errors.
 *
 * The optional signal parameter allows the retry delay to be interrupted
 * by the pipeline's timeout signal, preventing the total request
 * duration from exceeding the configured timeout.
 *
 * Non-idempotent methods (POST, PATCH) are never retried regardless
 * of the retries config, to prevent duplicate server-side mutations.
 */
export async function withRetries(
  req: Request,
  config: GodspeedConfig,
  fetchTask: (attemptReq: Request) => Promise<Response>,
  signal?: AbortSignal
): Promise<Response> {
  const maxRetries = isIdempotent(req.method) ? (config.retries ?? 0) : 0;
  let attempt = 0;

  while (true) {
    let response: Response | undefined;
    let error: unknown;

    try {
      const attemptReq = req.clone();
      response = await fetchTask(attemptReq);

      if (response.ok) return response;
      if (!RETRYABLE_STATUS.has(response.status)) {
        return response;
      }
    } catch (err) {
      error = err;
    }

    if (attempt >= maxRetries) {
      if (error) throw error;
      if (response) return response;
      throw new Error('Retry loop exhausted without a response or error');
    }

    const retryAfterHeader = response?.headers.get('Retry-After') ?? null;
    let delay = parseRetryAfter(retryAfterHeader);

    if (delay === undefined) {
      delay = calculateFullJitter(attempt);
    }

    await abortableDelay(delay, signal);
    attempt++;
  }
}
