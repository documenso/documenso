import { env } from '../utils/env';

export const DOKU_SEAL_ENCRYPTION_KEY = env('NEXT_PRIVATE_ENCRYPTION_KEY');

export const DOKU_SEAL_ENCRYPTION_SECONDARY_KEY = env('NEXT_PRIVATE_ENCRYPTION_SECONDARY_KEY');

// if (typeof window === 'undefined') {
//   if (!DOKU_SEAL_ENCRYPTION_KEY || !DOKU_SEAL_ENCRYPTION_SECONDARY_KEY) {
//     throw new Error('Missing DOKU_SEAL_ENCRYPTION_KEY or DOKU_SEAL_ENCRYPTION_SECONDARY_KEY keys');
//   }

//   if (DOKU_SEAL_ENCRYPTION_KEY === DOKU_SEAL_ENCRYPTION_SECONDARY_KEY) {
//     throw new Error(
//       'DOKU_SEAL_ENCRYPTION_KEY and DOKU_SEAL_ENCRYPTION_SECONDARY_KEY cannot be equal',
//     );
//   }
// }

// if (DOKU_SEAL_ENCRYPTION_KEY === 'CAFEBABE') {
//   console.warn('*********************************************************************');
//   console.warn('*');
//   console.warn('*');
//   console.warn('Please change the encryption key from the default value of "CAFEBABE"');
//   console.warn('*');
//   console.warn('*');
//   console.warn('*********************************************************************');
// }
