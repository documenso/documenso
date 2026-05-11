import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';

import { logger } from '../../utils/logger';

const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

type TurnstileVerifyResponse = {
  success: boolean;
  'error-codes': string[];
  challenge_ts?: string;
  hostname?: string;
};

/**
 * Verify a captcha token server-side.
 *
 * Currently supports Cloudflare Turnstile. This is a no-op if
 * `NEXT_PRIVATE_TURNSTILE_SECRET_KEY` is not configured, making captcha
 * verification an opt-in feature.
 */
export const verifyCaptchaToken = async ({
  token,
  ipAddress,
}: {
  token?: string | null;
  ipAddress?: string | null;
}) => {
  const secretKey = process.env.NEXT_PRIVATE_TURNSTILE_SECRET_KEY;

  // If no secret key is configured, skip verification.
  if (!secretKey) {
    return;
  }

  if (!token) {
    logger.warn({
      msg: 'Captcha verification rejected: missing token',
      ipAddress,
    });

    throw new AppError(AppErrorCode.INVALID_CAPTCHA, {
      message: 'Captcha token is required',
      statusCode: 400,
    });
  }

  const formData = new URLSearchParams();

  formData.append('secret', secretKey);
  formData.append('response', token);

  if (ipAddress) {
    formData.append('remoteip', ipAddress);
  }

  let response: Response;

  try {
    response = await fetch(TURNSTILE_VERIFY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
    });
  } catch (err) {
    logger.error({
      msg: 'Captcha verification failed: network error calling siteverify',
      err,
      ipAddress,
    });

    throw new AppError(AppErrorCode.INVALID_CAPTCHA, {
      message: 'Captcha verification failed',
      statusCode: 400,
    });
  }

  if (!response.ok) {
    logger.error({
      msg: 'Captcha verification failed: non-2xx response from siteverify',
      status: response.status,
      ipAddress,
    });

    throw new AppError(AppErrorCode.INVALID_CAPTCHA, {
      message: `Captcha verification request failed with status ${response.status}`,
      statusCode: 400,
    });
  }

  const result: TurnstileVerifyResponse = await response.json();

  if (!result.success) {
    logger.warn({
      msg: 'Captcha verification rejected by provider',
      errorCodes: result['error-codes'],
      hostname: result.hostname,
      ipAddress,
    });

    throw new AppError(AppErrorCode.INVALID_CAPTCHA, {
      message: `Captcha verification failed: ${result['error-codes']?.join(', ') ?? 'unknown'}`,
      statusCode: 400,
    });
  }
};
