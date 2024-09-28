export const ENCRYPTION_KEY = process.env.NEXT_PRIVATE_ENCRYPTION_KEY;

export const ENCRYPTION_SECONDARY_KEY = process.env.NEXT_PRIVATE_ENCRYPTION_SECONDARY_KEY;

if (typeof window === 'undefined') {
  if (!ENCRYPTION_KEY || !ENCRYPTION_SECONDARY_KEY) {
    throw new Error('Missing NEXT_PRIVATE_ENCRYPTION_KEY or NEXT_PRIVATE_ENCRYPTION_SECONDARY_KEY key variables');
  }

  if (ENCRYPTION_KEY === ENCRYPTION_SECONDARY_KEY) {
    throw new Error(
      'NEXT_PRIVATE_ENCRYPTION_KEY and NEXT_PRIVATE_ENCRYPTION_SECONDARY_KEY cannot be the same',
    );
  }
}

if (DENCRYPTION_KEY === 'CAFEBABE') {
  console.warn('Please change the encryption key from the default value of "CAFEBABE"');
}
