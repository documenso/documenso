export const DOCUMENSO_ENCRYPTION_KEY = '12345678912345678912345678912457';

export const DOCUMENSO_ENCRYPTION_SECONDARY_KEY = '12345678912345678912345678912458';

if (typeof window === 'undefined') {
  if (!DOCUMENSO_ENCRYPTION_KEY || !DOCUMENSO_ENCRYPTION_SECONDARY_KEY) {
    throw new Error('Missing DOCUMENSO_ENCRYPTION_KEY or DOCUMENSO_ENCRYPTION_SECONDARY_KEY keys');
  }

  if (DOCUMENSO_ENCRYPTION_KEY === DOCUMENSO_ENCRYPTION_SECONDARY_KEY) {
    throw new Error(
      'DOCUMENSO_ENCRYPTION_KEY and DOCUMENSO_ENCRYPTION_SECONDARY_KEY cannot be equal',
    );
  }
}

if (DOCUMENSO_ENCRYPTION_KEY === 'CAFEBABE') {
  console.warn('*********************************************************************');
  console.warn('*');
  console.warn('*');
  console.warn('Please change the encryption key from the default value of "CAFEBABE"');
  console.warn('*');
  console.warn('*');
  console.warn('*********************************************************************');
}
