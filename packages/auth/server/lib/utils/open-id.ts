import { z } from 'zod';

const ZOpenIdConfigurationSchema = z.object({
  issuer: z.string().optional(),
  authorization_endpoint: z.string(),
  token_endpoint: z.string(),
  scopes_supported: z.array(z.string()).optional(),
  jwks_uri: z.string().optional(),
});

type OpenIdConfiguration = z.infer<typeof ZOpenIdConfigurationSchema>;

type GetOpenIdConfigurationOptions = {
  requiredScopes?: string[];
};

const OPEN_ID_CONFIGURATION_CACHE_TTL_MS = 5 * 60 * 1000;

type CacheEntry = {
  config: OpenIdConfiguration;
  expiresAt: number;
};

const openIdConfigurationCache = new Map<string, CacheEntry>();

export const getOpenIdConfiguration = async (
  wellKnownUrl: string,
  options: GetOpenIdConfigurationOptions = {},
): Promise<OpenIdConfiguration> => {
  const cached = openIdConfigurationCache.get(wellKnownUrl);

  let config: OpenIdConfiguration;

  if (cached && cached.expiresAt > Date.now()) {
    config = cached.config;
  } else {
    const response = await fetch(wellKnownUrl);

    if (!response.ok) {
      throw new Error(`Failed to fetch OIDC configuration: ${response.statusText}`);
    }

    const rawConfig = await response.json();

    config = ZOpenIdConfigurationSchema.parse(rawConfig);

    // Validate required endpoints
    if (!config.authorization_endpoint) {
      throw new Error('Missing authorization_endpoint in OIDC configuration');
    }

    openIdConfigurationCache.set(wellKnownUrl, {
      config,
      expiresAt: Date.now() + OPEN_ID_CONFIGURATION_CACHE_TTL_MS,
    });
  }

  const supportedScopes = config.scopes_supported ?? [];
  const requiredScopes = options.requiredScopes ?? [];

  const unsupportedScopes = requiredScopes.filter((scope) => !supportedScopes.includes(scope));

  if (unsupportedScopes.length > 0) {
    throw new Error(`Requested scopes not supported by provider: ${unsupportedScopes.join(', ')}`);
  }

  return config;
};
