import type { Duration } from 'luxon';
import { DateTime } from 'luxon';

import { prisma } from '@documenso/prisma';

// temporary choice for testing only
import * as timeConstants from '../../constants/time';
import { alphaid } from '../../universal/id';
import { hashString } from '../auth/hash';

type TimeConstants = typeof timeConstants & {
  [key: string]: number | Duration;
};

type CreateApiTokenInput = {
  userId: number;
  tokenName: string;
  expirationDate: string | null;
};

export const createApiToken = async ({
  userId,
  tokenName,
  expirationDate,
}: CreateApiTokenInput) => {
  const apiToken = `api_${alphaid(16)}`;

  const hashedToken = hashString(apiToken);

  const timeConstantsRecords: TimeConstants = timeConstants;

  const dbToken = await prisma.apiToken.create({
    data: {
      token: hashedToken,
      name: tokenName,
      userId,
      expires: expirationDate
        ? DateTime.now().plus(timeConstantsRecords[expirationDate]).toJSDate()
        : null,
    },
  });

  if (!dbToken) {
    throw new Error('Failed to create the API token');
  }

  return {
    id: dbToken.id,
    token: apiToken,
  };
};
