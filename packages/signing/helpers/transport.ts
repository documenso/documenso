import { env } from '@documenso/lib/utils/env';

/** Unset NEXT_PRIVATE_SIGNING_TRANSPORT means local. */
export const getSigningTransport = () => env('NEXT_PRIVATE_SIGNING_TRANSPORT') || 'local';
