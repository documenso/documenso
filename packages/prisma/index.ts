import { PrismaClient } from '@prisma/client';

import { getDatabaseUrl } from './helper';
import {
  completedDocumentsMonthly,
  signerConversionMonthly,
  userMonthlyGrowth,
  userWithSignedDocumentMonthlyGrowth,
} from './node_modules/.prisma/client/sql';
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
