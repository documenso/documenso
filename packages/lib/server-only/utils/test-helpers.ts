// ABOUTME: Shared test utilities for integration tests that use real system binaries.
// ABOUTME: Provides binaryExists() to check if a binary is installed, for use with describe.skipIf.
import { execSync } from 'child_process';

/**
 * Check whether a system binary is available on PATH.
 * Used with `describe.skipIf(!binaryExists('qpdf'))` to gracefully skip
 * integration tests when the required binary is not installed.
 */
export const binaryExists = (name: string): boolean => {
  try {
    execSync(`which ${name}`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
};
