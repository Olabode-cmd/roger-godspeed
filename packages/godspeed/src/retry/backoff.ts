/**
 * backoff.ts
 *
 * Provides jittered backoff strategies for the retry handler.
 *
 * This module prevents "Thundering Herd" issues by applying proper Full Jitter
 * per the project requirements.
 *
 * Performance note: Runs synchronously and allocates zero memory objects.
 *
 * Dependencies: none.
 */

/**
 * Calculates a Full Jitter delay.
 * Implements: random(0, min(cap, base * 2^attempt))
 */
export function calculateFullJitter(attempt: number, baseMs: number = 100, capMs: number = 10000): number {
  const safeAttempt = Math.min(attempt, 30); 
  const maxDelay = Math.min(capMs, baseMs * Math.pow(2, safeAttempt));
  return Math.random() * maxDelay;
}
