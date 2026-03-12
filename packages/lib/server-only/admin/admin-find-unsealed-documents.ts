import { DocumentStatus, EnvelopeType, RecipientRole, SigningStatus } from '@prisma/client';

import { kyselyPrisma, sql } from '@documenso/prisma';

import type { FindResultResponse } from '../../types/search-params';

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

  const baseQuery = kyselyPrisma.$kysely
    .selectFrom('Envelope')
    .where('Envelope.status', '=', sql.lit(DocumentStatus.PENDING))
    .where('Envelope.type', '=', sql.lit(EnvelopeType.DOCUMENT))
    .where('Envelope.deletedAt', 'is', null)
    // Must have at least one recipient.
    .where((eb) =>
      eb.exists(eb.selectFrom('Recipient').whereRef('Recipient.envelopeId', '=', 'Envelope.id')),
    )
    // Document is ready to seal: all recipients are SIGNED/CC, or any recipient REJECTED.
    .where((eb) =>
      eb.or([
        // Case 1: All recipients are either SIGNED or CC.
        eb.not(
          eb.exists(
            eb
              .selectFrom('Recipient')
              .whereRef('Recipient.envelopeId', '=', 'Envelope.id')
              .where('Recipient.signingStatus', '!=', sql.lit(SigningStatus.SIGNED))
              .where('Recipient.role', '!=', sql.lit(RecipientRole.CC)),
          ),
        ),
        // Case 2: Any recipient has rejected.
        eb.exists(
          eb
            .selectFrom('Recipient')
            .whereRef('Recipient.envelopeId', '=', 'Envelope.id')
            .where('Recipient.signingStatus', '=', sql.lit(SigningStatus.REJECTED)),
        ),
      ]),
    );

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
