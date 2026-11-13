import { sha256 } from '@oslojs/crypto/sha2';
import { constantTimeEqual } from '@oslojs/crypto/subtle';

// Both sides are hashed first so lengths always match for `timingSafeEqual`.
export const isEqualSecret = (a: string, b: string): boolean => {
  const encoder = new TextEncoder();

  return constantTimeEqual(sha256(encoder.encode(a)), sha256(encoder.encode(b)));
};
