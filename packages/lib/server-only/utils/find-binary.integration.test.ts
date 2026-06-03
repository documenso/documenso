// ABOUTME: Integration tests for find-binary using real system binary resolution (no mocks).
// ABOUTME: Skips each binary's tests when that binary is not installed on the system.

import { access, constants } from 'fs/promises';
import { beforeEach, describe, expect, it } from 'vitest';

import { binaryExists } from './test-helpers';
import { clearBinaryCache, findBinary } from './find-binary';

describe.skipIf(!binaryExists('qpdf'))('findBinary — qpdf (integration)', () => {
  beforeEach(() => {
    clearBinaryCache();
  });

  it('should resolve qpdf to an executable path', async () => {
    const resolvedPath = await findBinary('qpdf');

    expect(resolvedPath).toBeTruthy();
    expect(resolvedPath).toContain('qpdf');

    // Verify the returned path actually exists and is executable
    await expect(access(resolvedPath, constants.X_OK)).resolves.toBeUndefined();
  });

  it('should cache the resolved path on subsequent calls', async () => {
    const first = await findBinary('qpdf');
    const second = await findBinary('qpdf');

    expect(first).toBe(second);
  });

  it('should re-resolve after cache is cleared', async () => {
    const first = await findBinary('qpdf');
    clearBinaryCache();
    const second = await findBinary('qpdf');

    // Should still resolve to the same path (same system)
    expect(second).toBe(first);
  });
});

describe.skipIf(!binaryExists('soffice'))('findBinary — soffice (integration)', () => {
  beforeEach(() => {
    clearBinaryCache();
  });

  it('should resolve soffice to an executable path', async () => {
    const resolvedPath = await findBinary('soffice');

    expect(resolvedPath).toBeTruthy();
    expect(resolvedPath).toContain('soffice');

    await expect(access(resolvedPath, constants.X_OK)).resolves.toBeUndefined();
  });
});

describe('findBinary — nonexistent binary (integration)', () => {
  beforeEach(() => {
    clearBinaryCache();
  });

  it('should throw DEPENDENCY_MISSING for a binary that does not exist', async () => {
    await expect(findBinary('nonexistent_binary_xyz_12345')).rejects.toMatchObject({
      code: 'DEPENDENCY_MISSING',
    });
  });
});
