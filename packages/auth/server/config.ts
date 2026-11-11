import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { env } from '@documenso/lib/utils/env';

/**
 * How long a session should live for in milliseconds.
 */
export const AUTH_SESSION_LIFETIME = 1000 * 60 * 60 * 24 * 30; // 30 days.

// Short and non-sliding: embed sessions live in a third-party partition outside
// the user's normal sign-out path and only need to outlast a signing session.
export const AUTH_EMBED_SESSION_LIFETIME = 1000 * 60 * 60 * 12; // 12 hours.

export type OAuthClientOptions = {
  id: string;
  scope: string[];
  clientId: string;
  clientSecret: string;
  wellKnownUrl: string;
  redirectUrl: string;
  bypassEmailVerification?: boolean;
  defaultOrganisationId?: string;
};

export const GoogleAuthOptions: OAuthClientOptions = {
  id: 'google',
  scope: ['openid', 'email', 'profile'],
  clientId: env('NEXT_PRIVATE_GOOGLE_CLIENT_ID') ?? '',
  clientSecret: env('NEXT_PRIVATE_GOOGLE_CLIENT_SECRET') ?? '',
  redirectUrl: `${NEXT_PUBLIC_WEBAPP_URL()}/api/auth/callback/google`,
  wellKnownUrl: 'https://accounts.google.com/.well-known/openid-configuration',
  bypassEmailVerification: false,
};

export const MicrosoftAuthOptions: OAuthClientOptions = {
  id: 'microsoft',
  scope: ['openid', 'email', 'profile'],
  clientId: env('NEXT_PRIVATE_MICROSOFT_CLIENT_ID') ?? '',
  clientSecret: env('NEXT_PRIVATE_MICROSOFT_CLIENT_SECRET') ?? '',
  redirectUrl: `${NEXT_PUBLIC_WEBAPP_URL()}/api/auth/callback/microsoft`,
  wellKnownUrl: 'https://login.microsoftonline.com/common/v2.0/.well-known/openid-configuration',
  bypassEmailVerification: false,
};

export const OidcAuthOptions: OAuthClientOptions = {
  id: 'oidc',
  scope: ['openid', 'email', 'profile'],
  clientId: env('NEXT_PRIVATE_OIDC_CLIENT_ID') ?? '',
  clientSecret: env('NEXT_PRIVATE_OIDC_CLIENT_SECRET') ?? '',
  redirectUrl: `${NEXT_PUBLIC_WEBAPP_URL()}/api/auth/callback/oidc`,
  wellKnownUrl: env('NEXT_PRIVATE_OIDC_WELL_KNOWN') ?? '',
  bypassEmailVerification: env('NEXT_PRIVATE_OIDC_SKIP_VERIFY') === 'true',
  defaultOrganisationId: env('NEXT_PRIVATE_OIDC_DEFAULT_ORGANISATION_ID'),
};
