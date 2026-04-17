/**
 * retryHandler.ts
 *
 * Implements Phase 5 request retries respecting HTTP status codes and idempotency.
 * Fully supports `Retry-After` headers and `backoff.ts` Full Jitter strategies.
 *
 * Performance note: Avoids excessive object creation during loops.
 *
 * Dependencies: backoff, types.
 */
import { calculateFullJitter } from './backoff';
import type { GodspeedConfig } from '../types';

const RETRYABLE_STATUS = new Set([408, 429, 500, 502, 503, 504]);

export function isIdempotent(method: string): boolean {
  return ['GET', 'HEAD', 'OPTIONS', 'PUT', 'DELETE'].includes(method.toUpperCase());
}

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

export async function withRetries(
  req: Request,
  config: GodspeedConfig,
  fetchTask: (attemptReq: Request) => Promise<Response>
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
         return response; // Handled downstream
      }
    } catch (err) {
      error = err;
    }

    if (attempt >= maxRetries) {
      if (error) throw error;
      if (response) return response;
    }

    const retryAfterHeader = response?.headers.get('Retry-After') ?? null;
    let delay = parseRetryAfter(retryAfterHeader);
    
    if (delay === undefined) {
      delay = calculateFullJitter(attempt);
    }

    // Wait before next attempt
    await new Promise(resolve => setTimeout(resolve, delay));
    attempt++;
  }
}
