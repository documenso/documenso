import { createVertex } from '@ai-sdk/google-vertex';

import { env } from '../../utils/env';

export type GoogleServiceAccountCredentials = {
  client_email: string;
  private_key: string;
  project_id?: string;
};

export const parseGoogleServiceAccountKey = (
  rawKey?: string | null,
): GoogleServiceAccountCredentials | undefined => {
  if (!rawKey) {
    return undefined;
  }

  try {
    const trimmed = rawKey.trim();
    const jsonStr = trimmed.startsWith('{')
      ? trimmed
      : Buffer.from(trimmed, 'base64').toString('utf8');

    const parsed = JSON.parse(jsonStr) as Record<string, unknown>;

    if (
      typeof parsed.client_email !== 'string' ||
      typeof parsed.private_key !== 'string'
    ) {
      console.warn('GOOGLE_VERTEX_SERVICE_ACCOUNT_KEY is missing client_email or private_key');
      return undefined;
    }

    return {
      client_email: parsed.client_email,
      private_key: parsed.private_key,
      project_id: typeof parsed.project_id === 'string' ? parsed.project_id : undefined,
    };
  } catch (err) {
    console.error('Failed to parse GOOGLE_VERTEX_SERVICE_ACCOUNT_KEY:', err);
    return undefined;
  }
};

export const getVertexSettings = () => {
  const serviceAccount = parseGoogleServiceAccountKey(env('GOOGLE_VERTEX_SERVICE_ACCOUNT_KEY'));
  const apiKey = env('GOOGLE_VERTEX_API_KEY');
  const projectId = env('GOOGLE_VERTEX_PROJECT_ID') || serviceAccount?.project_id;
  const location = env('GOOGLE_VERTEX_LOCATION') || 'global';

  return {
    project: projectId,
    location,
    ...(apiKey ? { apiKey } : {}),
    ...(serviceAccount
      ? {
          googleAuthOptions: {
            credentials: {
              client_email: serviceAccount.client_email,
              private_key: serviceAccount.private_key,
            },
            projectId,
          },
        }
      : {}),
  };
};

export const vertex = createVertex(getVertexSettings());
