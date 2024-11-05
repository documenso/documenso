import { msg } from '@lingui/macro';

export const EXPIRATION_DATES = {
  ONE_WEEK: msg`7 days`,
  ONE_MONTH: msg`1 month`,
  THREE_MONTHS: msg`3 months`,
  SIX_MONTHS: msg`6 months`,
  ONE_YEAR: msg`12 months`,
} as const;
