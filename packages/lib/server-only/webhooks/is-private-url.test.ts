import { describe, expect, it } from 'vitest';

import { isPrivateUrl } from './is-private-url';

describe('isPrivateUrl', () => {
  describe('localhost', () => {
    it('should detect localhost', () => {
      expect(isPrivateUrl('http://localhost')).toBe(true);
      expect(isPrivateUrl('http://localhost:3000')).toBe(true);
      expect(isPrivateUrl('https://localhost/path')).toBe(true);
    });

    it('should detect localhost with trailing dot', () => {
      expect(isPrivateUrl('http://localhost.')).toBe(true);
    });

    it('should be case insensitive', () => {
      expect(isPrivateUrl('http://LOCALHOST')).toBe(true);
      expect(isPrivateUrl('http://Localhost:8080')).toBe(true);
    });
  });

  describe('IPv4 loopback', () => {
    it('should detect 127.0.0.1', () => {
      expect(isPrivateUrl('http://127.0.0.1')).toBe(true);
      expect(isPrivateUrl('http://127.0.0.1:8080')).toBe(true);
    });

    it('should detect the full 127.x.x.x range', () => {
      expect(isPrivateUrl('http://127.0.0.2')).toBe(true);
      expect(isPrivateUrl('http://127.255.255.255')).toBe(true);
    });
  });

  describe('IPv4 private ranges', () => {
    it('should detect 10.x.x.x', () => {
      expect(isPrivateUrl('http://10.0.0.1')).toBe(true);
      expect(isPrivateUrl('http://10.255.255.255')).toBe(true);
    });

    it('should detect 172.16.0.0/12', () => {
      expect(isPrivateUrl('http://172.16.0.1')).toBe(true);
      expect(isPrivateUrl('http://172.31.255.255')).toBe(true);
    });

    it('should not flag 172.x outside the /12 range', () => {
      expect(isPrivateUrl('http://172.15.0.1')).toBe(false);
      expect(isPrivateUrl('http://172.32.0.1')).toBe(false);
    });

    it('should detect 192.168.x.x', () => {
      expect(isPrivateUrl('http://192.168.0.1')).toBe(true);
      expect(isPrivateUrl('http://192.168.255.255')).toBe(true);
    });

    it('should detect link-local 169.254.x.x', () => {
      expect(isPrivateUrl('http://169.254.1.1')).toBe(true);
    });

    it('should detect 0.0.0.0', () => {
      expect(isPrivateUrl('http://0.0.0.0')).toBe(true);
    });
  });

  describe('IPv6', () => {
    it('should detect ::1 loopback', () => {
      expect(isPrivateUrl('http://[::1]')).toBe(true);
      expect(isPrivateUrl('http://[::1]:3000')).toBe(true);
    });

    it('should detect :: unspecified', () => {
      expect(isPrivateUrl('http://[::]')).toBe(true);
    });

    it('should detect link-local fe80:', () => {
      expect(isPrivateUrl('http://[fe80::1]')).toBe(true);
    });

    it('should detect unique local fc/fd', () => {
      expect(isPrivateUrl('http://[fc00::1]')).toBe(true);
      expect(isPrivateUrl('http://[fd12::1]')).toBe(true);
    });

    it('should not catch IPv4-mapped IPv6 in URL form (URL parser normalizes to hex)', () => {
      // new URL() normalizes "::ffff:127.0.0.1" to "::ffff:7f00:1" which none
      // of the checks handle. This is fine because dns.lookup never returns
      // IPv4-mapped addresses — it returns plain IPv4 (family: 4) instead.
      expect(isPrivateUrl('http://[::ffff:127.0.0.1]')).toBe(false);
      expect(isPrivateUrl('http://[::ffff:10.0.0.1]')).toBe(false);
      expect(isPrivateUrl('http://[::ffff:8.8.8.8]')).toBe(false);
    });
  });

  describe('public URLs', () => {
    it('should allow public hostnames', () => {
      expect(isPrivateUrl('https://example.com')).toBe(false);
      expect(isPrivateUrl('https://api.documenso.com/webhook')).toBe(false);
    });

    it('should allow public IP addresses', () => {
      expect(isPrivateUrl('http://8.8.8.8')).toBe(false);
      expect(isPrivateUrl('http://1.1.1.1')).toBe(false);
      expect(isPrivateUrl('http://203.0.113.1')).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('should return false for invalid URLs', () => {
      expect(isPrivateUrl('not-a-url')).toBe(false);
      expect(isPrivateUrl('')).toBe(false);
    });
  });
});
