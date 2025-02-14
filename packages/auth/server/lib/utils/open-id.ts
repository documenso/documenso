import { z } from 'zod';

const ZOpenIdConfigurationSchema = z.object({
  authorization_endpoint: z.string(),
  token_endpoint: z.string(),
  scopes_supported: z.array(z.string()).optional(),
});

type OpenIdConfiguration = z.infer<typeof ZOpenIdConfigurationSchema>;

type GetOpenIdConfigurationOptions = {
  requiredScopes?: string[];
};

export const getOpenIdConfiguration = async (
  wellKnownUrl: string,
  options: GetOpenIdConfigurationOptions = {},
): Promise<OpenIdConfiguration> => {
  const response = await fetch(wellKnownUrl);

  if (!response.ok) {
    throw new Error(`Failed to fetch OIDC configuration: ${response.statusText}`);
  }

  const rawConfig = await response.json();

  const config = ZOpenIdConfigurationSchema.parse(rawConfig);

  // Validate required endpoints
  if (!config.authorization_endpoint) {
    throw new Error('Missing authorization_endpoint in OIDC configuration');
  }

  const supportedScopes = config.scopes_supported ?? [];
  const requiredScopes = options.requiredScopes ?? [];

  const unsupportedScopes = requiredScopes.filter((scope) => !supportedScopes.includes(scope));

  if (unsupportedScopes.length > 0) {
    throw new Error(`Requested scopes not supported by provider: ${unsupportedScopes.join(', ')}`);
  }

  return config;
};
