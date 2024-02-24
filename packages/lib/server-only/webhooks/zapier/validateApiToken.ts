import { getUserByApiToken } from '../../public-api/get-user-by-token';

type ValidateApiTokenOptions = {
  authorization: string | undefined;
};

export const validateApiToken = async ({ authorization }: ValidateApiTokenOptions) => {
  try {
    // Support for both "Authorization: Bearer api_xxx" and "Authorization: api_xxx"
    const [token] = (authorization || '').split('Bearer ').filter((s) => s.length > 0);

    return await getUserByApiToken({ token });
  } catch (err) {
    throw new Error(`Failed to validate API token`);
  }
};
