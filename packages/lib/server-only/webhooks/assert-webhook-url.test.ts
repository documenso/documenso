import { describe, expect, it, vi } from 'vitest';

import { AppError, AppErrorCode } from '../../errors/app-error';
import { assertNotPrivateUrl } from './assert-webhook-url';

const fakeLookup = (addresses: Array<{ address: string; family: number }>) => {
  return vi.fn().mockResolvedValue(addresses);
};

const fakeLookupSingle = (address: string, family: number) => {
  return vi.fn().mockResolvedValue({ address, family });
};

describe('assertNotPrivateUrl', () => {
  describe('static URL checks', () => {
    it('should throw for localhost URLs', async () => {
      await expect(assertNotPrivateUrl('http://localhost:3000')).rejects.toThrow(AppError);
    });

    it('should throw for 127.0.0.1', async () => {
      await expect(assertNotPrivateUrl('http://127.0.0.1')).rejects.toThrow(AppError);
    });

    it('should throw for private IPs before DNS lookup', async () => {
      await expect(assertNotPrivateUrl('http://10.0.0.1')).rejects.toThrow(AppError);
      await expect(assertNotPrivateUrl('http://192.168.1.1')).rejects.toThrow(AppError);
    });

    it('should throw with WEBHOOK_INVALID_REQUEST error code', async () => {
      try {
        await assertNotPrivateUrl('http://localhost');
        expect.unreachable('should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(AppError);
        expect((err as AppError).code).toBe(AppErrorCode.WEBHOOK_INVALID_REQUEST);
      }
    });
  });

  describe('DNS resolution checks', () => {
    it('should throw when hostname resolves to a private IPv4 address', async () => {
      const lookup = fakeLookup([{ address: '127.0.0.1', family: 4 }]);

      await expect(
        assertNotPrivateUrl('https://evil.example.com', { lookup }),
      ).rejects.toThrow(AppError);
    });

    it('should throw when hostname resolves to a private IPv6 address', async () => {
      const lookup = fakeLookup([{ address: '::1', family: 6 }]);

      await expect(
        assertNotPrivateUrl('https://evil.example.com', { lookup }),
      ).rejects.toThrow(AppError);
    });

    it('should throw when any resolved address is private', async () => {
      const lookup = fakeLookup([
        { address: '8.8.8.8', family: 4 },
        { address: '127.0.0.1', family: 4 },
      ]);

      await expect(
        assertNotPrivateUrl('https://evil.example.com', { lookup }),
      ).rejects.toThrow(AppError);
    });

    it('should allow hostnames that resolve to public addresses', async () => {
      const lookup = fakeLookup([{ address: '93.184.216.34', family: 4 }]);

      await expect(
        assertNotPrivateUrl('https://example.com', { lookup }),
      ).resolves.toBeUndefined();
    });

    it('should handle a single address result (non-array)', async () => {
      const lookup = fakeLookupSingle('10.0.0.1', 4);

      await expect(
        assertNotPrivateUrl('https://evil.example.com', { lookup }),
      ).rejects.toThrow(AppError);
    });

    it('should handle a single public address result', async () => {
      const lookup = fakeLookupSingle('93.184.216.34', 4);

      await expect(
        assertNotPrivateUrl('https://example.com', { lookup }),
      ).resolves.toBeUndefined();
    });
  });

  describe('IP address URLs skip DNS', () => {
    it('should not perform DNS lookup for IP address URLs', async () => {
      const lookup = vi.fn();

      await assertNotPrivateUrl('http://8.8.8.8', { lookup });
      expect(lookup).not.toHaveBeenCalled();
    });
  });

  describe('DNS failure handling', () => {
    it('should silently allow when DNS lookup throws', async () => {
      const lookup = vi.fn().mockRejectedValue(new Error('ENOTFOUND'));

      await expect(
        assertNotPrivateUrl('https://nonexistent.example.com', { lookup }),
      ).resolves.toBeUndefined();
    });

    it('should re-throw AppError even within the catch block', async () => {
      const lookup = fakeLookup([{ address: '192.168.0.1', family: 4 }]);

      await expect(
        assertNotPrivateUrl('https://evil.example.com', { lookup }),
      ).rejects.toThrow(AppError);
    });

    it('should silently allow when DNS lookup times out (returns null)', async () => {
      const lookup = vi.fn().mockReturnValue(new Promise(() => {}));

      // withTimeout races the lookup against a 250ms timer and returns null
      // if the lookup doesn't settle in time, so the function returns early.
      await expect(
        assertNotPrivateUrl('https://slow.example.com', { lookup }),
      ).resolves.toBeUndefined();
    }, 10_000);
  });
});
