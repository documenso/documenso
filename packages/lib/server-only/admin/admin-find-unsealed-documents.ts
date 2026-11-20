import { sql } from '@documenso/prisma';

import type { FindResultResponse } from '../../types/search-params';
import { selectUnsealedEnvelopes } from '../document/select-unsealed-envelopes';

export type AdminUnsealedDocument = {
  id: string;
  secondaryId: string;
  title: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  userId: number;
  teamId: number;
  ownerName: string | null;
  ownerEmail: string;
  lastSignedAt: Date | null;
};

export type AdminFindUnsealedDocumentsOptions = {
  page?: number;
  perPage?: number;
};

export const adminFindUnsealedDocuments = async ({
  page = 1,
  perPage = 20,
}: AdminFindUnsealedDocumentsOptions): Promise<FindResultResponse<AdminUnsealedDocument[]>> => {
  const offset = Math.max(page - 1, 0) * perPage;

  const baseQuery = selectUnsealedEnvelopes();

  const [data, countResult] = await Promise.all([
    baseQuery
      .innerJoin('User', 'User.id', 'Envelope.userId')
      .select([
        'Envelope.id',
        'Envelope.secondaryId',
        'Envelope.title',
        'Envelope.status',
        'Envelope.createdAt',
        'Envelope.updatedAt',
        'Envelope.userId',
        'Envelope.teamId',
        'User.name as ownerName',
        'User.email as ownerEmail',
      ])
      .select((eb) =>
        eb
          .selectFrom('Recipient')
          .whereRef('Recipient.envelopeId', '=', 'Envelope.id')
          .select(sql<Date>`max("Recipient"."signedAt")`.as('lastSignedAt'))
          .as('lastSignedAt'),
      )
      .orderBy('Envelope.createdAt', 'desc')
      .limit(perPage)
      .offset(offset)
      .execute(),
    baseQuery.select(({ fn }) => [fn.countAll().as('count')]).execute(),
  ]);

  const count = Number(countResult[0]?.count ?? 0);

  return {
    data: data as unknown as AdminUnsealedDocument[],
    count,
    currentPage: Math.max(page, 1),
    perPage,
    totalPages: Math.ceil(count / perPage),
  };
};
