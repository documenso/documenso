import { WEBAPP_BASE_URL } from '../constants/app';

export const formatTeamUrl = (teamUrl: string, baseUrl?: string) => {
  const formattedBaseUrl = (baseUrl ?? WEBAPP_BASE_URL).replace(/https?:\/\//, '');

  return `${formattedBaseUrl}/t/${teamUrl}`;
};
