import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { env } from '@documenso/lib/utils/env';

export type OAuthClientOptions = {
  id: string;
  scope: string[];
  clientId: string;
  clientSecret: string;
  wellKnownUrl: string;
  redirectUrl: string;
};

export const GoogleAuthOptions: OAuthClientOptions = {
  id: 'google',
  scope: ['openid', 'email', 'profile'],
  clientId: env('NEXT_PRIVATE_GOOGLE_CLIENT_ID') ?? '',
  clientSecret: env('NEXT_PRIVATE_GOOGLE_CLIENT_SECRET') ?? '',
  redirectUrl: `${NEXT_PUBLIC_WEBAPP_URL()}/api/auth/callback/google`,
  wellKnownUrl: 'https://accounts.google.com/.well-known/openid-configuration',
};

export const OidcAuthOptions: OAuthClientOptions = {
  id: 'oidc',
  scope: ['openid', 'email', 'profile'],
  clientId: env('NEXT_PRIVATE_OIDC_CLIENT_ID') ?? '',
  clientSecret: env('NEXT_PRIVATE_OIDC_CLIENT_SECRET') ?? '',
  redirectUrl: `${NEXT_PUBLIC_WEBAPP_URL()}/api/auth/callback/oidc`,
  wellKnownUrl: env('NEXT_PRIVATE_OIDC_WELL_KNOWN') ?? '',
};
