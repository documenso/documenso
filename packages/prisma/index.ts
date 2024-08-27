import { PrismaClient } from '@prisma/client';
import {
  completedDocumentsMonthly,
  signerConversionMonthly,
  userMonthlyGrowth,
  userWithSignedDocumentMonthlyGrowth,
} from '@prisma/client/sql';

import { getDatabaseUrl } from './helper';
import { remember } from './utils/remember';

export const prisma = remember(
  'prisma',
  () =>
    new PrismaClient({
      datasourceUrl: getDatabaseUrl(),
    }),
);

export const SQL = {
  completedDocumentsMonthly,
  signerConversionMonthly,
  userMonthlyGrowth,
  userWithSignedDocumentMonthlyGrowth,
};
