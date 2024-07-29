import { WEBAPP_BASE_URL } from '../constants/app';

export const formatUserProfilePath = (
  profileUrl: string,
  options: { excludeBaseUrl?: boolean } = {},
) => {
  return `${!options?.excludeBaseUrl ? WEBAPP_BASE_URL : ''}/p/${profileUrl}`;
};

export const formatTeamProfilePath = (
  profileUrl: string,
  options: { excludeBaseUrl?: boolean } = {},
) => {
  return `${!options?.excludeBaseUrl ? WEBAPP_BASE_URL : ''}/p/${profileUrl}`;
};
