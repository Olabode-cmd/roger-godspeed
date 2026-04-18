/**
 * config.ts
 *
 * Defines the configuration structures required for initializing a GodspeedClient
 * and merging request-level options.
 *
 * This exists as a separate concern to ensure strict typing of timeouts, retry policies,
 * and base URLs before any request building occurs.
 *
 * Performance note: These types enforce `exactOptionalPropertyTypes` so merging
 * configurations avoids undefined-value pollution.
 */

export interface GodspeedConfig {
  /**
   * The base URL to prepend to all request paths.
   */
  baseURL?: string;

  /**
   * Default headers to attach to every request.
   */
  headers?: Record<string, string>;

  /**
   * The absolute maximum time (in milliseconds) a request is allowed to take,
   * including all retry attempts and backoff periods.
   */
  timeout?: number;

  /**
   * Maximum number of retry attempts for idempotent requests.
   */
  retries?: number;

  /**
   * Whether to include credentials (cookies) in the request.
   * Maps to fetch's `credentials: 'include'`.
   */
  withCredentials?: boolean;
}
