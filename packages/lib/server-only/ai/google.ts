import { createVertex } from '@ai-sdk/google-vertex';

import { env } from '../../utils/env';

export const vertex = createVertex({
  project: env('GOOGLE_VERTEX_PROJECT_ID'),
  location: env('GOOGLE_VERTEX_LOCATION') || 'global',
  apiKey: env('GOOGLE_VERTEX_API_KEY'),
});

/**
 * The Vertex model the AI features (recipient & field detection) run on.
 *
 * The default preview model is only served by the global endpoint; every EU
 * regional endpoint 404s for it, so EU-residency deployments pointing
 * GOOGLE_VERTEX_LOCATION at a regional endpoint could not use the feature at
 * all. GOOGLE_VERTEX_MODEL lets those deployments pick a GA model their
 * region serves (#3240).
 */
export const VERTEX_MODEL = env('GOOGLE_VERTEX_MODEL') || 'gemini-3-flash-preview';
