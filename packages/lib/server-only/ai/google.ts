import { createVertex } from '@ai-sdk/google-vertex';

import { env } from '../../utils/env';

/**
 * Create Google Vertex AI client with service account authentication.
 *
 * GOOGLE_VERTEX_API_KEY should contain the base64-encoded service account JSON.
 * To generate: base64 -i service-account.json | tr -d '\n'
 */
const getCredentials = () => {
  const apiKey = env('GOOGLE_VERTEX_API_KEY');

  if (!apiKey) {
    return undefined;
  }

  try {
    const decoded = Buffer.from(apiKey, 'base64').toString('utf-8');
    return JSON.parse(decoded);
  } catch {
    // If not base64 JSON, return undefined (will fail auth but with clear error)
    return undefined;
  }
};

export const vertex = createVertex({
  project: env('GOOGLE_VERTEX_PROJECT_ID'),
  location: env('GOOGLE_VERTEX_LOCATION') || 'global',
  googleAuthOptions: {
    credentials: getCredentials(),
    scopes: ['https://www.googleapis.com/auth/cloud-platform'],
  },
});
