import { createVertex } from '@ai-sdk/google-vertex';

import { env } from '../../utils/env';

export const vertex = createVertex({
  project: env('GOOGLE_VERTEX_PROJECT_ID'),
  location: env('GOOGLE_VERTEX_LOCATION') || 'global',
  apiKey: env('GOOGLE_VERTEX_API_KEY'),
});
