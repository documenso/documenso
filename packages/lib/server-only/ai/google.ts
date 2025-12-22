import { createVertex } from '@ai-sdk/google-vertex';

import { env } from '../../utils/env';

/**
 * Create Google Vertex AI client with service account authentication.
 *
 * Required environment variables:
 * - GOOGLE_VERTEX_PROJECT_ID: Your GCP project ID
 * - GOOGLE_CLIENT_EMAIL: Service account email
 * - GOOGLE_PRIVATE_KEY: Service account private key (PEM format)
 *
 * Optional:
 * - GOOGLE_VERTEX_LOCATION: Defaults to 'global'
 */
export const vertex = createVertex({
  project: env('GOOGLE_VERTEX_PROJECT_ID'),
  location: env('GOOGLE_VERTEX_LOCATION') || 'global',
  googleAuthOptions: {
    credentials: {
      client_email: env('GOOGLE_CLIENT_EMAIL'),
      private_key: env('GOOGLE_PRIVATE_KEY')?.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/cloud-platform'],
  },
});
