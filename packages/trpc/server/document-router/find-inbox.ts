import type { Envelope, Prisma, Recipient } from '@prisma/client';
import {
  DocumentSigningOrder,
  DocumentStatus,
  EnvelopeType,
  RecipientRole,
  SigningStatus,
} from '@prisma/client';

import type { FindResultResponse } from '@documenso/lib/types/search-params';
import { mapEnvelopesToDocumentMany } from '@documenso/lib/utils/document';
import { maskRecipientTokensForDocument } from '@documenso/lib/utils/mask-recipient-tokens-for-document';
import { prisma } from '@documenso/prisma';

import { authenticatedProcedure } from '../trpc';
import type { TInboxFilter } from './find-inbox.types';
import { ZFindInboxRequestSchema, ZFindInboxResponseSchema } from './find-inbox.types';

export const findInboxRoute = authenticatedProcedure
  .input(ZFindInboxRequestSchema)
  .output(ZFindInboxResponseSchema)
  .query(async ({ input, ctx }) => {
    const { page, perPage, filter } = input;

    const userId = ctx.user.id;

    const envelopes = await findInbox({
      userId,
      page,
      perPage,
      filter,
    });

    return {
      ...envelopes,
      data: envelopes.data.map(({ isWaitingForCurrentUser, ...document }) => ({
        ...mapEnvelopesToDocumentMany(document),
        isWaitingForCurrentUser,
      })),
    };
  });

export type FindInboxOptions = {
  userId: number;
  page?: number;
  perPage?: number;
  filter?: TInboxFilter;
  orderBy?: {
    column: keyof Omit<Envelope, 'envelope'>;
    direction: 'asc' | 'desc';
  };
};

type RecipientTurnInfo = Pick<
  Recipient,
  'id' | 'email' | 'role' | 'signingStatus' | 'signingOrder'
>;

/**
 * Determine whether an envelope is currently waiting on a specific user to act.
 *
 * It is the user's turn when:
 * - the envelope is still pending,
 * - the user is a non-CC recipient who has not yet signed, and
 * - for sequential signing, every recipient ahead of them has already signed.
 *
 * Mirrors {@link getIsRecipientsTurnToSign} so the inbox stays in sync with the signing gate.
 */
const getIsWaitingForUser = (
  envelope: {
    status: DocumentStatus;
    documentMeta: { signingOrder: DocumentSigningOrder } | null;
    recipients: RecipientTurnInfo[];
  },
  userEmail: string,
): boolean => {
  if (envelope.status !== DocumentStatus.PENDING) {
    return false;
  }

  const currentRecipient = envelope.recipients.find(
    (recipient) => recipient.email === userEmail && recipient.role !== RecipientRole.CC,
  );

  if (!currentRecipient || currentRecipient.signingStatus !== SigningStatus.NOT_SIGNED) {
    return false;
  }

  // Parallel signing means everyone can act at any time.
  if (envelope.documentMeta?.signingOrder !== DocumentSigningOrder.SEQUENTIAL) {
    return true;
  }

  // Sequential signing: every recipient ahead of the current user must have signed.
  const orderedRecipients = [...envelope.recipients].sort(
    (a, b) => (a.signingOrder ?? 0) - (b.signingOrder ?? 0),
  );

  const currentRecipientIndex = orderedRecipients.findIndex(
    (recipient) => recipient.id === currentRecipient.id,
  );

  for (let i = 0; i < currentRecipientIndex; i++) {
    if (orderedRecipients[i].signingStatus !== SigningStatus.SIGNED) {
      return false;
    }
  }

  return true;
};

const inboxInclude = {
  user: {
    select: {
      id: true,
      name: true,
      email: true,
    },
  },
  recipients: true,
  documentMeta: {
    select: {
      signingOrder: true,
    },
  },
  team: {
    select: {
      id: true,
      url: true,
    },
  },
  envelopeItems: {
    select: {
      id: true,
      envelopeId: true,
      title: true,
      order: true,
    },
  },
} satisfies Prisma.EnvelopeInclude;

export const findInbox = async ({
  userId,
  page = 1,
  perPage = 10,
  filter = 'ALL',
  orderBy,
}: FindInboxOptions) => {
  const user = await prisma.user.findFirstOrThrow({
    where: {
      id: userId,
    },
    select: {
      id: true,
      email: true,
    },
  });

  const orderByColumn = orderBy?.column ?? 'createdAt';
  const orderByDirection = orderBy?.direction ?? 'desc';

  const whereClause: Prisma.EnvelopeWhereInput = {
    type: EnvelopeType.DOCUMENT,
    status: {
      not: DocumentStatus.DRAFT,
    },
    deletedAt: null,
    recipients: {
      some: {
        email: user.email,
        role: {
          not: RecipientRole.CC,
        },
      },
    },
  };

  // The "Waiting for me" filter requires evaluating the signing order per envelope, which
  // can't be fully expressed in a single Prisma where clause. We first narrow to envelopes
  // that are pending and awaiting the user's signature (an actionable, bounded set), then
  // refine and paginate the result of the sequential-turn check in memory.
  if (filter === 'WAITING') {
    const candidates = await prisma.envelope.findMany({
      where: {
        ...whereClause,
        status: DocumentStatus.PENDING,
        recipients: {
          some: {
            email: user.email,
            role: {
              not: RecipientRole.CC,
            },
            signingStatus: SigningStatus.NOT_SIGNED,
          },
        },
      },
      orderBy: {
        [orderByColumn]: orderByDirection,
      },
      include: inboxInclude,
    });

    const waiting = candidates.filter((envelope) => getIsWaitingForUser(envelope, user.email));

    const count = waiting.length;
    const paginated = waiting.slice(Math.max(page - 1, 0) * perPage, Math.max(page, 1) * perPage);

    const maskedData = paginated.map((document) => ({
      ...maskRecipientTokensForDocument({ document, user }),
      isWaitingForCurrentUser: true as const,
    }));

    return {
      data: maskedData,
      count,
      currentPage: Math.max(page, 1),
      perPage,
      totalPages: Math.ceil(count / perPage),
    } satisfies FindResultResponse<typeof maskedData>;
  }

  const [data, count] = await Promise.all([
    prisma.envelope.findMany({
      where: whereClause,
      skip: Math.max(page - 1, 0) * perPage,
      take: perPage,
      orderBy: {
        [orderByColumn]: orderByDirection,
      },
      include: inboxInclude,
    }),
    prisma.envelope.count({
      where: whereClause,
    }),
  ]);

  const maskedData = data.map((document) => ({
    ...maskRecipientTokensForDocument({ document, user }),
    isWaitingForCurrentUser: getIsWaitingForUser(document, user.email),
  }));

  return {
    data: maskedData,
    count,
    currentPage: Math.max(page, 1),
    perPage,
    totalPages: Math.ceil(count / perPage),
  } satisfies FindResultResponse<typeof maskedData>;
};
