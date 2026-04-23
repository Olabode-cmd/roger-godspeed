/**
 * ssrf.ts
 *
 * Validates request URLs against private, reserved, and internal network
 * addresses to prevent Server-Side Request Forgery (SSRF) attacks.
 *
 * This module exists as a separate concern because SSRF validation requires
 * IP-range arithmetic that would pollute the request builder or pipeline
 * with unrelated logic. Isolating it also allows the guard to be tested
 * exhaustively against all RFC 1918/5735/4291 ranges independently.
 *
 * Dependencies: imports SSRFError from `../errors`.
 */

import { SSRFError } from '../errors';

/**
 * Set of URL schemes that Godspeed permits.
 * All other schemes (file://, data://, ftp://, gopher://, etc.) are blocked.
 */
const ALLOWED_SCHEMES = new Set(['http:', 'https:']);

/**
 * Hostnames that resolve to cloud provider metadata services.
 * These are high-value SSRF targets and are blocked unconditionally
 * when private network access is disallowed.
 */
const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'metadata.google.internal',
  'metadata.google.internal.',
]);

/**
 * The well-known IPv4 address for cloud metadata endpoints
 * (AWS, GCP, Azure, DigitalOcean).
 */
const METADATA_IPV4 = '169.254.169.254';

/**
 * Parses a dotted-quad IPv4 string into a 32-bit unsigned integer.
 * Returns null if the string is not a valid IPv4 address.
 *
 * Uses manual octet parsing with explicit range checks to avoid
 * allocating intermediate arrays from split/map chains.
 */
function ipv4ToInt(ip: string): number | null {
  let result = 0;
  let octetStart = 0;
  let octetCount = 0;

  for (let i = 0; i <= ip.length; i++) {
    if (i === ip.length || ip[i] === '.') {
      const octetStr = ip.slice(octetStart, i);
      if (octetStr.length === 0 || octetStr.length > 3) return null;
      const octet = Number(octetStr);
      if (!Number.isInteger(octet) || octet < 0 || octet > 255) return null;
      result = (result << 8) | octet;
      octetCount++;
      octetStart = i + 1;
    }
  }

  if (octetCount !== 4) return null;
  return result >>> 0;
}

/**
 * IPv4 CIDR ranges that are considered private or reserved.
 * Each entry is a [networkInt, maskInt] pair pre-computed for
 * fast bitwise comparison.
 *
 * Covers:
 *   - 0.0.0.0/8        (current network)
 *   - 10.0.0.0/8       (RFC 1918)
 *   - 100.64.0.0/10    (carrier-grade NAT, RFC 6598)
 *   - 127.0.0.0/8      (loopback)
 *   - 169.254.0.0/16   (link-local, includes metadata IP)
 *   - 172.16.0.0/12    (RFC 1918)
 *   - 192.0.0.0/24     (IETF protocol assignments)
 *   - 192.0.2.0/24     (TEST-NET-1)
 *   - 192.88.99.0/24   (6to4 relay anycast)
 *   - 192.168.0.0/16   (RFC 1918)
 *   - 198.18.0.0/15    (benchmark testing)
 *   - 198.51.100.0/24  (TEST-NET-2)
 *   - 203.0.113.0/24   (TEST-NET-3)
 *   - 224.0.0.0/4      (multicast)
 *   - 240.0.0.0/4      (reserved)
 *   - 255.255.255.255/32 (broadcast)
 */
const PRIVATE_IPV4_RANGES: ReadonlyArray<readonly [number, number]> = buildCIDRTable([
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['192.88.99.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
  ['255.255.255.255', 32],
]);

/**
 * Pre-computes a CIDR lookup table from human-readable [ip, prefix] pairs.
 * Runs once at module load time so the hot path performs only integer ops.
 */
function buildCIDRTable(
  entries: ReadonlyArray<readonly [string, number]>
): ReadonlyArray<readonly [number, number]> {
  const table: Array<readonly [number, number]> = [];
  for (const [ip, prefix] of entries) {
    const network = ipv4ToInt(ip);
    if (network === null) continue;
    const mask = prefix === 0 ? 0 : (~0 << (32 - prefix)) >>> 0;
    table.push([network, mask] as const);
  }
  return table;
}

/**
 * Returns true if the given 32-bit integer falls within any
 * private or reserved IPv4 CIDR range.
 */
function isPrivateIPv4(ipInt: number): boolean {
  for (const [network, mask] of PRIVATE_IPV4_RANGES) {
    if ((ipInt & mask) === (network & mask)) return true;
  }
  return false;
}

/**
 * Returns true if the given hostname string is an IPv6 address
 * that maps to a private/reserved range.
 *
 * Handles:
 *   - Loopback (::1)
 *   - IPv4-mapped (::ffff:x.x.x.x) — delegates to IPv4 range check
 *   - Link-local (fe80::)
 *   - Unique local (fc00::/7)
 *   - Any unspecified address (::)
 */
function isPrivateIPv6(host: string): boolean {
  const normalized = host.toLowerCase();

  if (normalized === '::1' || normalized === '[::1]') return true;
  if (normalized === '::' || normalized === '[::]') return true;

  const unwrapped = normalized.startsWith('[') && normalized.endsWith(']')
    ? normalized.slice(1, -1)
    : normalized;

  if (unwrapped.startsWith('::ffff:')) {
    const v4Part = unwrapped.slice(7);
    const v4Int = ipv4ToInt(v4Part);
    if (v4Int !== null) return isPrivateIPv4(v4Int);
  }

  if (unwrapped.startsWith('fe80')) return true;
  if (unwrapped.startsWith('fc') || unwrapped.startsWith('fd')) return true;

  return false;
}

/**
 * Validates a request URL against SSRF attack vectors.
 *
 * Checks performed (in order):
 *   1. Scheme allowlist (http/https only)
 *   2. Blocked metadata hostnames
 *   3. IPv4 private/reserved range check
 *   4. IPv6 private/reserved range check
 *   5. Metadata IP literal check
 *
 * Throws SSRFError if the URL targets a blocked destination.
 * This function is a no-op when allowPrivateNetworks is true.
 */
export function assertNotSSRF(url: string, allowPrivateNetworks: boolean): void {
  if (allowPrivateNetworks) return;

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new SSRFError(`Invalid URL: ${url}`, url);
  }

  if (!ALLOWED_SCHEMES.has(parsed.protocol)) {
    throw new SSRFError(
      `Blocked scheme "${parsed.protocol}" — only http: and https: are allowed`,
      url
    );
  }

  const hostname = parsed.hostname;

  if (BLOCKED_HOSTNAMES.has(hostname)) {
    throw new SSRFError(
      `Blocked request to metadata service hostname "${hostname}"`,
      url
    );
  }

  if (hostname === METADATA_IPV4) {
    throw new SSRFError(
      `Blocked request to cloud metadata endpoint ${METADATA_IPV4}`,
      url
    );
  }

  const ipInt = ipv4ToInt(hostname);
  if (ipInt !== null) {
    if (isPrivateIPv4(ipInt)) {
      throw new SSRFError(
        `Blocked request to private/reserved IPv4 address "${hostname}"`,
        url
      );
    }
    return;
  }

  if (isPrivateIPv6(hostname)) {
    throw new SSRFError(
      `Blocked request to private/reserved IPv6 address "${hostname}"`,
      url
    );
  }
}
