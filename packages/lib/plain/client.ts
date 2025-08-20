import { PlainClient } from '@team-plain/typescript-sdk';

import { env } from '@documenso/lib/utils/env';

export const plainClient = new PlainClient({
  apiKey: env('NEXT_PRIVATE_PLAIN_API_KEY') ?? '',
});
