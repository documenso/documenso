import { z } from 'zod';

const ZIpSchema = z.string().ip();

/**
 * Synchronously check whether a URL's host is a known private/loopback address
 * (localhost, RFC 1918, link-local, loopback, etc.), regardless of protocol.
 *
 * Best-effort and non-exhaustive: unrecognised or unparseable hosts return
 * `false` (fail open). See `assertNotPrivateUrl` for the full SSRF caveats.
 */
export const isPrivateUrl = (url: string): boolean => {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();

    // Strip IPv6 brackets.
    const bare = hostname.startsWith('[') ? hostname.slice(1, -1) : hostname;
    const normalizedHost = bare.replace(/\.+$/, '');

    if (normalizedHost === 'localhost') {
      return true;
    }

    const parsedIp = ZIpSchema.safeParse(normalizedHost);

    if (!parsedIp.success) {
      return false;
    }

    if (normalizedHost === '::1' || normalizedHost === '::') {
      return true;
    }

    if (normalizedHost === '0.0.0.0') {
      return true;
    }

    if (normalizedHost.startsWith('127.')) {
      return true;
    }

    if (normalizedHost.startsWith('10.')) {
      return true;
    }

    if (normalizedHost.startsWith('192.168.')) {
      return true;
    }

    if (normalizedHost.startsWith('169.254.')) {
      return true;
    }

    if (normalizedHost.startsWith('fe80:')) {
      return true;
    }

    if (normalizedHost.startsWith('fc') || normalizedHost.startsWith('fd')) {
      return true;
    }

    // 172.16.0.0/12
    if (normalizedHost.startsWith('172.')) {
      const second = parseInt(normalizedHost.split('.')[1], 10);

      if (second >= 16 && second <= 31) {
        return true;
      }
    }

    // IPv4-mapped IPv6, dotted form (e.g. ::ffff:127.0.0.1)
    const v4MappedDotted = normalizedHost.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);

    if (v4MappedDotted) {
      return isPrivateUrl(`http://${v4MappedDotted[1]}`);
    }

    // IPv4-mapped IPv6, hex form (e.g. ::ffff:7f00:1). `new URL()` normalizes the
    // dotted form above to this, so it must be decoded to the embedded IPv4 as
    // well - otherwise a literal host such as `http://[::ffff:127.0.0.1]` slips
    // through every dotted-decimal check above (SSRF, see #2901).
    const v4MappedHex = normalizedHost.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i);

    if (v4MappedHex) {
      const high = parseInt(v4MappedHex[1], 16);
      const low = parseInt(v4MappedHex[2], 16);
      const ipv4 = [high >> 8, high & 0xff, low >> 8, low & 0xff].join('.');

      return isPrivateUrl(`http://${ipv4}`);
    }

    return false;
  } catch {
    return false;
  }
};
