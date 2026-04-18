/**
 * configResolver.ts
 *
 * Merges GodspeedClient configuration with request-specific configuration.
 *
 * This module ensures we strictly isolate configuration resolution to avoid
 * redundant URL parses or header allocations during the middleware execution path.
 *
 * Performance note: Avoids Object.assign or extraneous spreading when constructing 
 * headers to minimize intermediate object allocations in this hot path.
 *
 * Dependencies: imports interfaces from `../types`.
 */
import type { GodspeedConfig } from '../types';

export function resolveConfig(
  base: GodspeedConfig,
  requestOptions: GodspeedConfig = {}
): GodspeedConfig {
  const merged: GodspeedConfig = {};

  const baseURL = requestOptions.baseURL ?? base.baseURL;
  if (baseURL !== undefined) merged.baseURL = baseURL;

  const timeout = requestOptions.timeout ?? base.timeout;
  if (timeout !== undefined) merged.timeout = timeout;

  const retries = requestOptions.retries ?? base.retries;
  if (retries !== undefined) merged.retries = retries;

  const withCredentials = requestOptions.withCredentials ?? base.withCredentials;
  if (withCredentials !== undefined) merged.withCredentials = withCredentials;

  if (base.params || requestOptions.params) {
    merged.params = { ...base.params, ...requestOptions.params };
  }

  if (base.headers || requestOptions.headers) {
    merged.headers = { ...base.headers, ...requestOptions.headers };
  }

  return merged;
}
