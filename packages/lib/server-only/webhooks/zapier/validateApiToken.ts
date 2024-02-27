import { getApiTokenByToken } from '../../public-api/get-api-token-by-token';

type ValidateApiTokenOptions = {
  authorization: string | undefined;
};

export const validateApiToken = async ({ authorization }: ValidateApiTokenOptions) => {
  try {
    // Support for both "Authorization: Bearer api_xxx" and "Authorization: api_xxx"
    const [token] = (authorization || '').split('Bearer ').filter((s) => s.length > 0);

    if (!token) {
      throw new Error('Missing API token');
    }

    return await getApiTokenByToken({ token });
  } catch (err) {
    throw new Error(`Failed to validate API token`);
  }
};
