import { sql } from 'kysely';
import { jsonArrayFrom, jsonObjectFrom } from 'kysely/helpers/postgres';
import { DateTime } from 'luxon';
import { P, match } from 'ts-pattern';

import { prisma } from '@documenso/prisma';
import { RecipientRole, SigningStatus } from '@documenso/prisma/client';
import type { Document, Prisma, Team, TeamEmail, User } from '@documenso/prisma/client';
import { ExtendedDocumentStatus } from '@documenso/prisma/types/extended-document-status';

import type { FindResultSet } from '../../types/find-result-set';
import { maskRecipientTokensForDocument } from '../../utils/mask-recipient-tokens-for-document';

export type PeriodSelectorValue = '' | '7d' | '14d' | '30d';

export type FindDocumentsOptions = {
  userId: number;
  teamId?: number;
  term?: string;
  status?: ExtendedDocumentStatus;
  page?: number;
  perPage?: number;
  orderBy?: {
    column: keyof Omit<Document, 'document'>;
    direction: 'asc' | 'desc';
  };
  period?: PeriodSelectorValue;
  senderIds?: number[];
};

export const findDocuments = async ({
  userId,
  teamId,
  term,
  status = ExtendedDocumentStatus.ALL,
  page = 1,
  perPage = 10,
  orderBy,
  period,
  senderIds,
}: FindDocumentsOptions) => {
  const { user, team } = await prisma.$transaction(async (tx) => {
    const user = await tx.user.findFirstOrThrow({
      where: {
        id: userId,
      },
    });

    let team = null;

    if (teamId !== undefined) {
      team = await tx.team.findFirstOrThrow({
        where: {
          id: teamId,
          members: {
            some: {
              userId,
            },
          },
        },
        include: {
          teamEmail: true,
        },
      });

      const teamQuery = await prisma.$kysely
        .selectFrom('Team')
        .selectAll('Team')
        .where('Team.id', '=', teamId)
        .select((eb) => [
          jsonObjectFrom(
            eb
              .selectFrom('TeamEmail')
              .selectAll('TeamEmail')
              .where('TeamEmail.teamId', '=', teamId),
          ).as('teamEmail'),
        ])
        .innerJoin('TeamMember', 'TeamMember.teamId', 'Team.id')
        .where('TeamMember.userId', '=', userId)
        .execute();
    }

    return {
      user,
      team,
    };
  });

  const orderByColumn = orderBy?.column ?? 'createdAt';
  const orderByDirection = orderBy?.direction ?? 'desc';

  const termFilters = match(term)
    .with(P.string.minLength(1), () => {
      return {
        title: {
          contains: term,
          mode: 'insensitive',
        },
      } as const;
    })
    .otherwise(() => undefined);

  const filters = team ? findTeamDocumentsFilter(status, team) : findDocumentsFilter(status, user);

  if (filters === null) {
    return {
      data: [],
      count: 0,
      currentPage: 1,
      perPage,
      totalPages: 0,
    };
  }

  let deletedFilter: Prisma.DocumentWhereInput = {
    AND: {
      OR: [
        {
          userId: user.id,
          deletedAt: null,
        },
        {
          Recipient: {
            some: {
              email: user.email,
              documentDeletedAt: null,
            },
          },
        },
      ],
    },
  };

  if (team) {
    deletedFilter = {
      AND: {
        OR: team.teamEmail
          ? [
              {
                teamId: team.id,
                deletedAt: null,
              },
              {
                User: {
                  email: team.teamEmail.email,
                },
                deletedAt: null,
              },
              {
                Recipient: {
                  some: {
                    email: team.teamEmail.email,
                    documentDeletedAt: null,
                  },
                },
              },
            ]
          : [
              {
                teamId: team.id,
                deletedAt: null,
              },
            ],
      },
    };
  }

  const whereClause: Prisma.DocumentWhereInput = {
    ...termFilters,
    ...filters,
    ...deletedFilter,
  };

  if (period) {
    const daysAgo = parseInt(period.replace(/d$/, ''), 10);

    const startOfPeriod = DateTime.now().minus({ days: daysAgo }).startOf('day');

    whereClause.createdAt = {
      gte: startOfPeriod.toJSDate(),
    };
  }

  if (senderIds && senderIds.length > 0) {
    whereClause.userId = {
      in: senderIds,
    };
  }

  let dataQuery = prisma.$kysely
    .selectFrom('Document')
    .selectAll('Document')
    .select((eb) => [
      jsonObjectFrom(
        eb
          .selectFrom('User')
          .select(['id', 'name', 'email'])
          .whereRef('User.id', '=', 'Document.userId'),
      ).as('User'),
      jsonArrayFrom(
        eb
          .selectFrom('Recipient')
          .selectAll('Recipient')
          .whereRef('Recipient.documentId', '=', 'Document.id'),
      ).as('Recipient'),
      jsonObjectFrom(
        eb.selectFrom('Team').select(['id', 'url']).whereRef('Team.id', '=', 'Document.teamId'),
      ).as('team'),
    ]);

  if (term && term.length >= 1) {
    dataQuery = dataQuery.where('Document.title', 'ilike', `%${term}%`);
  }

  if (period) {
    const daysAgo = parseInt(period.replace(/d$/, ''), 10);
    const startOfPeriod = DateTime.now().minus({ days: daysAgo }).startOf('day');
    dataQuery = dataQuery.where('Document.createdAt', '>=', startOfPeriod.toJSDate());
  }

  if (senderIds && senderIds.length > 0) {
    dataQuery = dataQuery.where('Document.userId', 'in', senderIds);
  }

  if (team) {
    if (ExtendedDocumentStatus.ALL === status) {
      dataQuery = dataQuery.where((eb) => {
        const ors = [eb('Document.teamId', '=', team.id)];

        if (team.teamEmail) {
          ors.push(
            eb.and([
              eb.not(eb(sql`CAST("Document"."status" AS TEXT)`, '=', ExtendedDocumentStatus.DRAFT)),
              eb.exists(
                eb
                  .selectFrom('Recipient')
                  .selectAll('Recipient')
                  .whereRef('Recipient.documentId', '=', 'Document.id')
                  .where('Recipient.email', '=', team.teamEmail.email),
              ),
            ]),
          );

          ors.push(
            eb.exists(
              eb
                .selectFrom('User')
                .selectAll('User')
                .where('User.email', '=', team.teamEmail.email),
            ),
          );
        }

        return eb.or(ors);
      });
    } else if (ExtendedDocumentStatus.INBOX === status) {
      if (team.teamEmail) {
        dataQuery = dataQuery.where((eb) => {
          const ands = [];

          if (team.teamEmail) {
            ands.push(
              eb.and([
                eb.not(
                  eb(sql`CAST("Document"."status" AS TEXT)`, '=', ExtendedDocumentStatus.DRAFT),
                ),
                eb.exists(
                  eb
                    .selectFrom('Recipient')
                    .selectAll('Recipient')
                    .whereRef('Recipient.documentId', '=', 'Document.id')
                    .where('Recipient.email', '=', team.teamEmail.email)
                    .where(
                      sql`CAST("Recipient"."signingStatus" AS TEXT)`,
                      '=',
                      SigningStatus.NOT_SIGNED,
                    )
                    .where(sql`CAST("Recipient"."role" AS TEXT)`, '!=', RecipientRole.CC),
                ),
              ]),
            );
          }

          return eb.and(ands);
        });
      }
    } else if (ExtendedDocumentStatus.DRAFT === status) {
      dataQuery = dataQuery.where((eb) => {
        const ors = [
          eb.and([
            eb('Document.teamId', '=', team.id),
            eb(sql`CAST("Document"."status" AS TEXT)`, '=', ExtendedDocumentStatus.DRAFT),
          ]),
        ];

        if (team.teamEmail) {
          ors.push(
            eb.and([
              eb(sql`CAST("Document"."status" AS TEXT)`, '=', ExtendedDocumentStatus.DRAFT),
              eb.exists(
                eb
                  .selectFrom('User')
                  .selectAll('User')
                  .whereRef('userId', '=', 'Document.id')
                  .where('User.email', '=', team.teamEmail.email),
              ),
            ]),
          );
        }

        return eb.or(ors);
      });
    } else if (ExtendedDocumentStatus.PENDING === status) {
      dataQuery = dataQuery.where((eb) => {
        const ors = [
          eb.and([
            eb('Document.teamId', '=', team.id),
            eb(sql`CAST("Document"."status" AS TEXT)`, '=', ExtendedDocumentStatus.PENDING),
          ]),
        ];

        if (team.teamEmail) {
          ors.push(
            eb.or([
              eb.and([
                eb(sql`CAST("Document"."status" AS TEXT)`, '=', ExtendedDocumentStatus.PENDING),
                eb.and([
                  eb.exists(
                    eb
                      .selectFrom('User')
                      .selectAll('User')
                      .whereRef('userId', '=', 'Document.id')
                      .where('User.email', '=', team.teamEmail.email),
                  ),
                  eb.exists(
                    eb
                      .selectFrom('Recipient')
                      .selectAll('Recipient')
                      .where('Recipient.email', '=', team.teamEmail.email)
                      .where(
                        sql`CAST("Recipient"."signingStatus" AS TEXT)`,
                        '=',
                        SigningStatus.SIGNED,
                      )
                      .where(sql`CAST("Recipient"."role" AS TEXT)`, '!=', RecipientRole.CC),
                  ),
                ]),
              ]),
            ]),
          );
        }

        return eb.or(ors);
      });
    } else if (ExtendedDocumentStatus.COMPLETED === status) {
      dataQuery = dataQuery.where((eb) => {
        const ors = [];

        if (team.teamEmail) {
          ors.push(
            eb(sql`CAST("Document"."status" AS TEXT)`, '=', ExtendedDocumentStatus.COMPLETED),
            eb.or([
              eb('Document.teamId', '=', team.id),
              eb.and([
                eb.exists(
                  eb
                    .selectFrom('User')
                    .selectAll('User')
                    .whereRef('userId', '=', 'Document.id')
                    .where('User.email', '=', team.teamEmail.email),
                ),
                eb.exists(
                  eb
                    .selectFrom('Recipient')
                    .selectAll('Recipient')
                    .where('Recipient.email', '=', team.teamEmail.email)
                    .where(
                      sql`CAST("Recipient"."signingStatus" AS TEXT)`,
                      '=',
                      SigningStatus.SIGNED,
                    )
                    .where(sql`CAST("Recipient"."role" AS TEXT)`, '!=', RecipientRole.CC),
                ),
              ]),
            ]),
          );
        }

        return eb.and(ors);
      });
    }
  } else if (user) {
    if (ExtendedDocumentStatus.ALL === status) {
      dataQuery = dataQuery.where(({ eb, or, and, exists }) => {
        return or([
          and([eb('Document.userId', '=', user.id), eb('Document.teamId', 'is', null)]),
          and([
            eb(sql`CAST("Document"."status" AS TEXT)`, '=', ExtendedDocumentStatus.COMPLETED),
            exists(
              eb
                .selectFrom('Recipient')
                .selectAll('Recipient')
                .whereRef('Recipient.documentId', '=', 'Document.id')
                .where('Recipient.email', '=', user.email),
            ),
          ]),
          and([
            eb(sql`CAST("Document"."status" AS TEXT)`, '=', ExtendedDocumentStatus.PENDING),
            exists(
              eb
                .selectFrom('Recipient')
                .selectAll('Recipient')
                .whereRef('Recipient.documentId', '=', 'Document.id')
                .where('Recipient.email', '=', user.email),
            ),
          ]),
        ]);
      });
    } else if (ExtendedDocumentStatus.INBOX === status) {
      dataQuery = dataQuery.where(({ eb, and, not, exists }) => {
        return and([
          not(eb(sql`CAST("Document"."status" AS TEXT)`, '=', ExtendedDocumentStatus.DRAFT)),
          exists(
            eb
              .selectFrom('Recipient')
              .selectAll('Recipient')
              .whereRef('Recipient.documentId', '=', 'Document.id')
              .where('Recipient.email', '=', user.email)
              .where(sql`CAST("Recipient"."signingStatus" AS TEXT)`, '=', SigningStatus.NOT_SIGNED)
              .where(sql`CAST("Recipient"."role" AS TEXT)`, '!=', RecipientRole.CC),
          ),
        ]);
      });
    } else if (ExtendedDocumentStatus.DRAFT === status) {
      dataQuery = dataQuery.where(({ eb, and }) => {
        return and([
          eb('Document.userId', '=', user.id),
          eb('Document.teamId', 'is', null),
          eb(sql`CAST("Document"."status" AS TEXT)`, '=', ExtendedDocumentStatus.DRAFT),
        ]);
      });
    } else if (ExtendedDocumentStatus.PENDING === status) {
      dataQuery = dataQuery.where(({ eb, or, and, exists }) => {
        return or([
          and([
            eb('Document.userId', '=', user.id),
            eb('Document.teamId', 'is', null),
            eb(sql`CAST("Document"."status" AS TEXT)`, '=', ExtendedDocumentStatus.PENDING),
          ]),
          and([
            eb(sql`CAST("Document"."status" AS TEXT)`, '=', ExtendedDocumentStatus.PENDING),
            exists(
              eb
                .selectFrom('Recipient')
                .selectAll('Recipient')
                .whereRef('Recipient.documentId', '=', 'Document.id')
                .where('Recipient.email', '=', user.email)
                .where(sql`CAST("Recipient"."signingStatus" AS TEXT)`, '=', SigningStatus.SIGNED)
                .where(sql`CAST("Recipient"."role" AS TEXT)`, '!=', RecipientRole.CC),
            ),
          ]),
        ]);
      });
    } else if (ExtendedDocumentStatus.COMPLETED === status) {
      dataQuery = dataQuery.where(({ eb, or, exists, and }) => {
        return or([
          and([
            eb('Document.userId', '=', user.id),
            eb('Document.teamId', 'is', null),
            eb(sql`CAST("Document"."status" AS TEXT)`, '=', ExtendedDocumentStatus.COMPLETED),
          ]),
          and([
            eb(sql`CAST("Document"."status" AS TEXT)`, '=', ExtendedDocumentStatus.COMPLETED),
            exists(
              eb
                .selectFrom('Recipient')
                .selectAll('Recipient')
                .whereRef('Recipient.documentId', '=', 'Document.id')
                .where('Recipient.email', '=', user.email),
            ),
          ]),
        ]);
      });
    }
  } else {
    return {
      data: [],
      count: 0,
      currentPage: 1,
      perPage,
      totalPages: 0,
    };
  }

  dataQuery = dataQuery.where(({ eb, or, and, not }) => {
    return and([
      or([
        eb(sql`CAST("Document"."status" AS TEXT)`, '=', ExtendedDocumentStatus.COMPLETED),
        and([
          not(eb(sql`CAST("Document"."status" AS TEXT)`, '=', ExtendedDocumentStatus.COMPLETED)),
          eb('Document.deletedAt', 'is', null),
        ]),
      ]),
    ]);
  });

  const finalQuery = await dataQuery
    .offset(Math.max(page - 1, 0) * perPage)
    .limit(perPage)
    .orderBy(orderByColumn, orderByDirection)
    .execute();

  const [data, count] = await Promise.all([
    prisma.document.findMany({
      where: whereClause,
      skip: Math.max(page - 1, 0) * perPage,
      take: perPage,
      orderBy: {
        [orderByColumn]: orderByDirection,
      },
      include: {
        User: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        Recipient: true,
        team: {
          select: {
            id: true,
            url: true,
          },
        },
      },
    }),
    prisma.document.count({
      where: whereClause,
    }),
  ]);

  const formattedFinalQuery = finalQuery.map((item) => {
    return {
      id: item.id,
      userId: item.userId,
      title: item.title,
      templateId: item.templateId,
      status: item.status,
      documentDataId: item.documentDataId,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      completedAt: item.completedAt,
      deletedAt: item.deletedAt,
      teamId: item.teamId,
      team:
        item.team && 'id' in item.team && 'url' in item.team
          ? {
              id: item.team.id,
              url: item.team.url,
            }
          : null,
      User: {
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        id: (item.User as { id: number }).id,
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        name: (item.User as { name: string | null }).name,
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        email: (item.User as { email: string }).email,
      },
      Recipient: Array.isArray(item.Recipient)
        ? item.Recipient.map((recipient) => ({
            id: recipient?.id,
            documentId: recipient?.documentId,
            templateId: recipient?.templateId,
            email: recipient?.email,
            name: recipient?.name,
            role: recipient?.role,
            signingStatus: recipient?.signingStatus,
            token: recipient?.token,
            expired: recipient?.expired,
            readStatus: recipient?.readStatus,
            sendStatus: recipient?.sendStatus,
            signedAt: recipient?.signedAt,
            createdAt: item.createdAt,
            updatedAt: item.updatedAt,
          }))
        : [],
    };
  });

  const maskedData = formattedFinalQuery.map((document) =>
    maskRecipientTokensForDocument({
      document,
      user,
    }),
  );

  return {
    data: maskedData,
    count,
    currentPage: Math.max(page, 1),
    perPage,
    totalPages: Math.ceil(count / perPage),
  } satisfies FindResultSet<typeof data>;
};

const findDocumentsFilter = (status: ExtendedDocumentStatus, user: User) => {
  return match<ExtendedDocumentStatus, Prisma.DocumentWhereInput>(status)
    .with(ExtendedDocumentStatus.ALL, () => ({
      OR: [
        {
          userId: user.id,
          teamId: null,
        },
        {
          status: ExtendedDocumentStatus.COMPLETED,
          Recipient: {
            some: {
              email: user.email,
            },
          },
        },
        {
          status: ExtendedDocumentStatus.PENDING,
          Recipient: {
            some: {
              email: user.email,
            },
          },
        },
      ],
    }))
    .with(ExtendedDocumentStatus.INBOX, () => ({
      status: {
        not: ExtendedDocumentStatus.DRAFT,
      },
      Recipient: {
        some: {
          email: user.email,
          signingStatus: SigningStatus.NOT_SIGNED,
          role: {
            not: RecipientRole.CC,
          },
        },
      },
    }))
    .with(ExtendedDocumentStatus.DRAFT, () => ({
      userId: user.id,
      teamId: null,
      status: ExtendedDocumentStatus.DRAFT,
    }))
    .with(ExtendedDocumentStatus.PENDING, () => ({
      OR: [
        {
          userId: user.id,
          teamId: null,
          status: ExtendedDocumentStatus.PENDING,
        },
        {
          status: ExtendedDocumentStatus.PENDING,
          Recipient: {
            some: {
              email: user.email,
              signingStatus: SigningStatus.SIGNED,
              role: {
                not: RecipientRole.CC,
              },
            },
          },
        },
      ],
    }))
    .with(ExtendedDocumentStatus.COMPLETED, () => ({
      OR: [
        {
          userId: user.id,
          teamId: null,
          status: ExtendedDocumentStatus.COMPLETED,
        },
        {
          status: ExtendedDocumentStatus.COMPLETED,
          Recipient: {
            some: {
              email: user.email,
            },
          },
        },
      ],
    }))
    .exhaustive();
};

/**
 * Create a Prisma filter for the Document schema to find documents for a team.
 *
 * Status All:
 *  - Documents that belong to the team
 *  - Documents that have been sent by the team email
 *  - Non draft documents that have been sent to the team email
 *
 * Status Inbox:
 *  - Non draft documents that have been sent to the team email that have not been signed
 *
 * Status Draft:
 * - Documents that belong to the team that are draft
 * - Documents that belong to the team email that are draft
 *
 * Status Pending:
 * - Documents that belong to the team that are pending
 * - Documents that have been sent by the team email that is pending to be signed by someone else
 * - Documents that have been sent to the team email that is pending to be signed by someone else
 *
 * Status Completed:
 * - Documents that belong to the team that are completed
 * - Documents that have been sent to the team email that are completed
 * - Documents that have been sent by the team email that are completed
 *
 * @param status The status of the documents to find.
 * @param team The team to find the documents for.
 * @returns A filter which can be applied to the Prisma Document schema.
 */
const findTeamDocumentsFilter = (
  status: ExtendedDocumentStatus,
  team: Team & { teamEmail: TeamEmail | null },
) => {
  const teamEmail = team.teamEmail?.email ?? null;

  return match<ExtendedDocumentStatus, Prisma.DocumentWhereInput | null>(status)
    .with(ExtendedDocumentStatus.ALL, () => {
      const filter: Prisma.DocumentWhereInput = {
        // Filter to display all documents that belong to the team.
        OR: [
          {
            teamId: team.id,
          },
        ],
      };

      if (teamEmail && filter.OR) {
        // Filter to display all documents received by the team email that are not draft.
        filter.OR.push({
          status: {
            not: ExtendedDocumentStatus.DRAFT,
          },
          Recipient: {
            some: {
              email: teamEmail,
            },
          },
        });

        // Filter to display all documents that have been sent by the team email.
        filter.OR.push({
          User: {
            email: teamEmail,
          },
        });
      }

      return filter;
    })
    .with(ExtendedDocumentStatus.INBOX, () => {
      // Return a filter that will return nothing.
      if (!teamEmail) {
        return null;
      }

      return {
        status: {
          not: ExtendedDocumentStatus.DRAFT,
        },
        Recipient: {
          some: {
            email: teamEmail,
            signingStatus: SigningStatus.NOT_SIGNED,
            role: {
              not: RecipientRole.CC,
            },
          },
        },
      };
    })
    .with(ExtendedDocumentStatus.DRAFT, () => {
      const filter: Prisma.DocumentWhereInput = {
        OR: [
          {
            teamId: team.id,
            status: ExtendedDocumentStatus.DRAFT,
          },
        ],
      };

      if (teamEmail && filter.OR) {
        filter.OR.push({
          status: ExtendedDocumentStatus.DRAFT,
          User: {
            email: teamEmail,
          },
        });
      }

      return filter;
    })
    .with(ExtendedDocumentStatus.PENDING, () => {
      const filter: Prisma.DocumentWhereInput = {
        OR: [
          {
            teamId: team.id,
            status: ExtendedDocumentStatus.PENDING,
          },
        ],
      };

      if (teamEmail && filter.OR) {
        filter.OR.push({
          status: ExtendedDocumentStatus.PENDING,
          OR: [
            {
              Recipient: {
                some: {
                  email: teamEmail,
                  signingStatus: SigningStatus.SIGNED,
                  role: {
                    not: RecipientRole.CC,
                  },
                },
              },
            },
            {
              User: {
                email: teamEmail,
              },
            },
          ],
        });
      }

      return filter;
    })
    .with(ExtendedDocumentStatus.COMPLETED, () => {
      const filter: Prisma.DocumentWhereInput = {
        status: ExtendedDocumentStatus.COMPLETED,
        OR: [
          {
            teamId: team.id,
          },
        ],
      };

      if (teamEmail && filter.OR) {
        filter.OR.push(
          {
            Recipient: {
              some: {
                email: teamEmail,
              },
            },
          },
          {
            User: {
              email: teamEmail,
            },
          },
        );
      }

      return filter;
    })
    .exhaustive();
};
