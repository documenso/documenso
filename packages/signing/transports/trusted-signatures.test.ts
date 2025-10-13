/* eslint-disable @typescript-eslint/consistent-type-assertions */
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import crypto from 'crypto';
import { calculateAuthorizationToken, requestSignatureFromAPI } from './trusted-signatures';

// Mock the fetch function
global.fetch = vi.fn();

// Mock crypto
vi.mock('crypto', () => ({
  default: {
    createHmac: vi.fn(),
  },
}));

describe('calculateAuthorizationToken', () => {
  let mockHmac: { update: unknown; digest: unknown; };

  beforeEach(() => {
    // Reset all mocks before each test
    vi.clearAllMocks();

    // Setup mock HMAC
    mockHmac = {
      update: vi.fn().mockReturnThis(),
      digest: vi.fn().mockReturnValue(Buffer.from('mock-hmac-digest')),
    };

    (crypto.createHmac as Mock).mockReturnValue(mockHmac);
  });

  it('should create HMAC with correct parameters', () => {
    const apiKey = Buffer.from('test-api-key');
    const message = 'test-message';
    const timeAsIso8601String = '2023-12-25T12:00:00Z';

    calculateAuthorizationToken({ apiKey, message, timeAsIso8601String });

    expect(crypto.createHmac).toHaveBeenCalledWith('sha256', Uint8Array.from(apiKey));
    expect(mockHmac.update).toHaveBeenCalledWith(message);
    expect(mockHmac.update).toHaveBeenCalledWith(timeAsIso8601String);
    expect(mockHmac.digest).toHaveBeenCalled();
  });

  it('should return the correct digest', () => {
    const apiKey = Buffer.from('test-api-key');
    const message = 'test-message';
    const timeAsIso8601String = '2023-12-25T12:00:00Z';

    const result = calculateAuthorizationToken({ apiKey, message, timeAsIso8601String });

    expect(result).toEqual(Buffer.from('mock-hmac-digest'));
  });
});

describe('requestSignatureFromAPI', () => {
  const mockApiKeyId = 'test-api-key-id';
  const mockApiKey = Buffer.from('test-api-key');
  const mockDigest = Buffer.from('test-digest');

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  it('should make correct API call with proper headers', async () => {
    const mockResponse = {
      ok: true,
      json: async () => Promise.resolve({ signature: 'mock-signature' })
    };
    (global.fetch as Mock).mockResolvedValueOnce(mockResponse);

    // Set a fixed date for testing
    const fixedDate = new Date('2023-12-25T12:00:00Z');
    vi.setSystemTime(fixedDate);

    await requestSignatureFromAPI({ apiKeyId: mockApiKeyId, apiKey: mockApiKey, digest: mockDigest, tsaTimestamp: false });

    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.trusted-signatures.com/v1/sign',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'User-Agent': 'Documenso',
          'Content-Type': 'application/json',
          'X-Authorization': expect.any(String),
          'X-Authorization-Key': mockApiKeyId,
          'X-Authorization-Algorithm': 'HmacSHA256',
          'X-Authorization-Time': fixedDate.toISOString(),
        }),
      })
    );
  });

  it('should return correct signature from API response', async () => {
    const mockSignature = 'mock-signature';
    const mockResponse = {
      ok: true,
      json: async () => Promise.resolve({ signature: mockSignature })
    };
    (global.fetch as Mock).mockResolvedValueOnce(mockResponse);

    const result = await requestSignatureFromAPI({
      apiKeyId: mockApiKeyId,
      apiKey: mockApiKey,
      digest: mockDigest,
      tsaTimestamp: false,
    });

    expect(result).toEqual(Buffer.from(mockSignature, 'base64'));
  });

  it('should throw error when API response is not ok', async () => {
    const mockResponse = {
      ok: false,
      status: 400
    };
    (global.fetch as Mock).mockResolvedValueOnce(mockResponse);

    await expect(
      requestSignatureFromAPI({
        apiKeyId: mockApiKeyId,
        apiKey: mockApiKey,
        digest: mockDigest,
        tsaTimestamp: false,
      })
    ).rejects.toThrow('HTTP error! Status: 400');
  });

  it('should handle network errors', async () => {
    (global.fetch as Mock).mockRejectedValueOnce(new Error('Network error'));

    await expect(
      requestSignatureFromAPI({
        apiKeyId: mockApiKeyId,
        apiKey: mockApiKey,
        digest: mockDigest,
        tsaTimestamp: false,
      })
    ).rejects.toThrow('Network error');
  });
});
