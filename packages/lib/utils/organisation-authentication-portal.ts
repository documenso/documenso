import { NEXT_PUBLIC_WEBAPP_URL } from '../constants/app';

export const formatOrganisationLoginUrl = (organisationUrl: string) => {
  return NEXT_PUBLIC_WEBAPP_URL() + formatOrganisationLoginPath(organisationUrl);
};

export const formatOrganisationLoginPath = (organisationUrl: string) => {
  return `/o/${organisationUrl}/signin`;
};

export const formatOrganisationCallbackUrl = (organisationUrl: string) => {
  return `${NEXT_PUBLIC_WEBAPP_URL()}/api/auth/callback/oidc/org/${organisationUrl}`;
};
