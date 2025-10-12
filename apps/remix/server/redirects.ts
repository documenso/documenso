import type { Context } from 'hono';

// eslint-disable-next-line @typescript-eslint/require-await
export const handleRedirects = async (c: Context): Promise<string | null> => {
  const { req } = c;
  const path = req.path;

  // Direct rewrites
  if (
    path === '/documents' ||
    path === '/documents/folders' ||
    path === '/templates' ||
    path === '/templates/folders'
  ) {
    return '/';
  }

  return null;
};
