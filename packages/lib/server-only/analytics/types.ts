import type { ReadStatus, SendStatus, SigningStatus } from '@prisma/client';

import type { ExtendedDocumentStatus } from '@documenso/prisma/types/extended-document-status';

export type EntityFilter = { teamId: number } | { userId: number };

export type AnalyticsDateFilter = {
  dateFrom?: Date;
  dateTo?: Date;
};

export type AnalyticsFilters = EntityFilter & AnalyticsDateFilter;

export type DocumentStats = Record<Exclude<ExtendedDocumentStatus, 'INBOX'>, number>;

export type RecipientStats = {
  TOTAL_RECIPIENTS: number;
  [ReadStatus.OPENED]: number;
  [ReadStatus.NOT_OPENED]: number;
  [SigningStatus.SIGNED]: number;
  [SigningStatus.NOT_SIGNED]: number;
  [SigningStatus.REJECTED]: number;
  [SendStatus.SENT]: number;
  [SendStatus.NOT_SENT]: number;
};

export type MonthlyStats = Array<{
  month: string;
  count: number;
  signed_count?: number;
  cume_count?: number;
}>;

export type UserMonthlyDocumentGrowth = MonthlyStats;

export type TeamMonthlyDocumentGrowth = MonthlyStats;

export type TeamMonthlyActiveUsers = MonthlyStats;

// Legacy type exports for backwards compatibility
export type TeamDocumentStatsFilters = {
  teamId: number;
  dateFrom?: Date;
  dateTo?: Date;
};

export type UserDocumentStatsFilters = {
  userId: number;
  dateFrom?: Date;
  dateTo?: Date;
};

export type TeamRecipientsStatsFilters = {
  teamId: number;
  dateFrom?: Date;
  dateTo?: Date;
};

export type UserRecipientsStatsFilters = {
  userId: number;
  dateFrom?: Date;
  dateTo?: Date;
};
