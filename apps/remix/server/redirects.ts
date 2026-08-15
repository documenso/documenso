import type { Context } from 'hono';

export const handleRedirects = (c: Context): string | null => {
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

  // The settings paths below have no index routes, land on their first page instead.
  // In-app links point directly at the subpages, these only catch direct visits.
  if (path === '/settings' || path === '/settings/') {
    return '/settings/profile';
  }

  const orgSettingsMatch = path.match(/^\/o\/([^/]+)\/settings\/?$/);

  if (orgSettingsMatch) {
    return `/o/${orgSettingsMatch[1]}/settings/general`;
  }

  const teamSettingsMatch = path.match(/^\/t\/([^/]+)\/settings\/?$/);

  if (teamSettingsMatch) {
    return `/t/${teamSettingsMatch[1]}/settings/general`;
  }

  return null;
};
