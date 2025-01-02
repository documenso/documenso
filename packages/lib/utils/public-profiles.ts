import { NEXT_PUBLIC_WEBAPP_URL } from '../constants/app';

export const formatUserProfilePath = (
  profileUrl: string,
  options: { excludeBaseUrl?: boolean } = {},
) => {
  return `${!options?.excludeBaseUrl ? NEXT_PUBLIC_WEBAPP_URL() : ''}/p/${profileUrl}`;
};

export const formatTeamProfilePath = (
  profileUrl: string,
  options: { excludeBaseUrl?: boolean } = {},
) => {
  return `${!options?.excludeBaseUrl ? NEXT_PUBLIC_WEBAPP_URL() : ''}/p/${profileUrl}`;
};
