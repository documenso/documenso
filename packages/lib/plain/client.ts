import { env } from '@documenso/lib/utils/env';
import { PlainClient } from '@team-plain/typescript-sdk';

export const plainClient = new PlainClient({
  apiKey: env('NEXT_PRIVATE_PLAIN_API_KEY') ?? '',
});
