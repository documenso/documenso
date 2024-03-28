import { WEBAPP_BASE_URL } from '../constants/app';
import { PASSKEY_TIMEOUT } from '../constants/auth';

/**
 * Extracts common fields to identify the RP (relying party)
 */
export const getAuthenticatorOptions = () => {
  const webAppBaseUrl = new URL(WEBAPP_BASE_URL);
  const rpId = webAppBaseUrl.hostname;

  return {
    rpName: 'Documenso',
    rpId,
    origin: WEBAPP_BASE_URL,
    timeout: PASSKEY_TIMEOUT,
  };
};
