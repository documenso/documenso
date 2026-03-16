import { z } from 'zod';

const ZIpSchema = z.string().ip();

/**
 * Check whether a URL points to a known private/loopback address.
 *
 * Performs a synchronous check against known private hostnames and IP ranges.
 * Works regardless of the URL protocol.
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

    // IPv4-mapped IPv6 (e.g. ::ffff:127.0.0.1)
    const v4Mapped = normalizedHost.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);

    if (v4Mapped) {
      return isPrivateUrl(`http://${v4Mapped[1]}`);
    }

    return false;
  } catch {
    return false;
  }
};
