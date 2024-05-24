import { Duration } from 'luxon';

export const ONE_SECOND = 1000;
export const ONE_MINUTE = ONE_SECOND * 60;
export const ONE_HOUR = ONE_MINUTE * 60;
export const ONE_DAY = ONE_HOUR * 24;
export const ONE_WEEK = ONE_DAY * 7;
export const ONE_MONTH = Duration.fromObject({ months: 1 });
export const THREE_MONTHS = Duration.fromObject({ months: 3 });
export const SIX_MONTHS = Duration.fromObject({ months: 6 });
export const ONE_YEAR = Duration.fromObject({ years: 1 });
