import { lookup } from 'node:dns/promises';
import { z } from 'zod';

import { AppError, AppErrorCode } from '../../errors/app-error';
import { withTimeout } from '../../utils/timeout';
import { isPrivateUrl } from './is-private-url';

const ZIpSchema = z.string().ip();
const WEBHOOK_DNS_LOOKUP_TIMEOUT_MS = 250;

type TLookupAddress = {
  address: string;
  family: number;
};

type TLookupFn = (
  hostname: string,
  options: {
    all: true;
    verbatim: true;
  },
) => Promise<TLookupAddress[] | TLookupAddress>;

const normalizeHostname = (hostname: string) => hostname.toLowerCase().replace(/\.+$/, '');

const toAddressUrl = (address: string) =>
  address.includes(':') ? `http://[${address}]` : `http://${address}`;

/**
 * Asserts that a webhook URL does not resolve to a private or loopback
 * address. Throws an AppError with WEBHOOK_INVALID_REQUEST if it does.
 */
export const assertNotPrivateUrl = async (
  url: string,
  options?: {
    lookup?: TLookupFn;
  },
) => {
  if (isPrivateUrl(url)) {
    throw new AppError(AppErrorCode.WEBHOOK_INVALID_REQUEST, {
      message: 'Webhook URL resolves to a private or loopback address',
    });
  }

  try {
    const hostname = normalizeHostname(new URL(url).hostname);

    if (hostname.length === 0 || ZIpSchema.safeParse(hostname).success) {
      return;
    }

    const resolveHostname = options?.lookup ?? lookup;
    const lookupResult = await withTimeout(
      resolveHostname(hostname, {
        all: true,
        verbatim: true,
      }),
      WEBHOOK_DNS_LOOKUP_TIMEOUT_MS,
    );

    if (!lookupResult) {
      return;
    }

    const addresses = Array.isArray(lookupResult) ? lookupResult : [lookupResult];

    if (addresses.some(({ address }) => isPrivateUrl(toAddressUrl(address)))) {
      throw new AppError(AppErrorCode.WEBHOOK_INVALID_REQUEST, {
        message: 'Webhook URL resolves to a private or loopback address',
      });
    }
  } catch (err) {
    if (err instanceof AppError) {
      throw err;
    }

    return;
  }
};
