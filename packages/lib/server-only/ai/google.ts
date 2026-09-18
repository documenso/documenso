import { createVertex } from '@ai-sdk/google-vertex';

import { env } from '../../utils/env';

export const vertex = createVertex({
  project: env('GOOGLE_VERTEX_PROJECT_ID'),
  location: env('GOOGLE_VERTEX_LOCATION') || 'global',
  apiKey: env('GOOGLE_VERTEX_API_KEY'),
});

export const DEFAULT_VERTEX_MODEL = 'gemini-3-flash-preview';

export const getVertexModel = (model?: string) => {
  return vertex(model || env('GOOGLE_VERTEX_MODEL') || DEFAULT_VERTEX_MODEL);
};

