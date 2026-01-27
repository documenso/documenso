import { DocumentSigningOrder, DocumentStatus, EnvelopeType, SigningStatus } from '@prisma/client';
import { z } from 'zod';

import { prisma } from '@documenso/prisma';
import DocumentMetaSchema from '@documenso/prisma/generated/zod/modelSchema/DocumentMetaSchema';
import EnvelopeItemSchema from '@documenso/prisma/generated/zod/modelSchema/EnvelopeItemSchema';
import EnvelopeSchema from '@documenso/prisma/generated/zod/modelSchema/EnvelopeSchema';
import SignatureSchema from '@documenso/prisma/generated/zod/modelSchema/SignatureSchema';
import TeamSchema from '@documenso/prisma/generated/zod/modelSchema/TeamSchema';
import UserSchema from '@documenso/prisma/generated/zod/modelSchema/UserSchema';

import { AppError, AppErrorCode } from '../../errors/app-error';
import type { TDocumentAuthMethods } from '../../types/document-auth';
import { ZEnvelopeFieldSchema, ZFieldSchema } from '../../types/field';
import { ZRecipientLiteSchema } from '../../types/recipient';
import { isRecipientAuthorized } from '../document/is-recipient-authorized';
import { getTeamSettings } from '../team/get-team-settings';

export type GetRecipientEnvelopeByTokenOptions = {
  token: string;
  userId?: number;
  accessAuth?: TDocumentAuthMethods;
};

export const ZEnvelopeForSigningResponse = z.object({
  envelope: EnvelopeSchema.pick({
    type: true,
    status: true,
    id: true,
    secondaryId: true,
    internalVersion: true,
    completedAt: true,
    updatedAt: true,
    deletedAt: true,
    title: true,
    authOptions: true,
    userId: true,
    teamId: true,
  }).extend({
    documentMeta: DocumentMetaSchema.pick({
      signingOrder: true,
      distributionMethod: true,
      timezone: true,
      dateFormat: true,
      redirectUrl: true,
      typedSignatureEnabled: true,
      uploadSignatureEnabled: true,
      drawSignatureEnabled: true,
      allowDictateNextSigner: true,
      language: true,
    }),
    recipients: ZRecipientLiteSchema.pick({
      id: true,
      role: true,
      signingStatus: true,
      email: true,
      name: true,
      documentDeletedAt: true,
      expired: true,
      signedAt: true,
      authOptions: true,
      signingOrder: true,
      rejectionReason: true,
    })
      .extend({
        fields: ZEnvelopeFieldSchema.extend({
          signature: SignatureSchema.pick({
            signatureImageAsBase64: true,
            typedSignature: true,
          }).nullish(),
        }).array(),
      })
      .array(),

    envelopeItems: EnvelopeItemSchema.pick({
      envelopeId: true,
      id: true,
      title: true,
      order: true,
    }).array(),

    team: TeamSchema.pick({
      id: true,
      name: true,
    }),
    user: UserSchema.pick({
      name: true,
      email: true,
    }),
  }),

  /**
   * The recipient that is currently signing.
   */
  recipient: ZRecipientLiteSchema.pick({
    id: true,
    role: true,
    envelopeId: true,
    readStatus: true,
    sendStatus: true,
    signingStatus: true,
    email: true,
    name: true,
    documentDeletedAt: true,
    expired: true,
    signedAt: true,
    authOptions: true,
    token: true,
    signingOrder: true,
    rejectionReason: true,
  }).extend({
    directToken: z.string().nullish(),
    fields: ZFieldSchema.omit({
      documentId: true,
      templateId: true,
    })
      .extend({
        signature: SignatureSchema.nullish(),
      })
      .array(),
  }),
  recipientSignature: SignatureSchema.pick({
    signatureImageAsBase64: true,
    typedSignature: true,
  }).nullable(),

  isCompleted: z.boolean(),
  isRejected: z.boolean(),
  isRecipientsTurn: z.boolean(),

  sender: z.object({
    email: z.string(),
    name: z.string(),
  }),

  settings: z.object({
    includeSenderDetails: z.boolean(),
    brandingEnabled: z.boolean(),
    brandingLogo: z.string(),
  }),
});

export type EnvelopeForSigningResponse = z.infer<typeof ZEnvelopeForSigningResponse>;

/**
 * Get all the values and details for an envelope that a recipient requires
 * to sign an envelope.
 *
 * Do not overexpose any information that the recipient should not have.
 */
export const getEnvelopeForRecipientSigning = async ({
  token,
  userId,
  accessAuth,
}: GetRecipientEnvelopeByTokenOptions): Promise<EnvelopeForSigningResponse> => {
  if (!token) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Missing token',
    });
  }

  const envelope = await prisma.envelope.findFirst({
    where: {
      type: EnvelopeType.DOCUMENT,
      status: {
        not: DocumentStatus.DRAFT,
      },
      recipients: {
        some: {
          token,
        },
      },
    },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          name: true,
        },
      },
      documentMeta: true,
      recipients: {
        include: {
          fields: {
            include: {
              signature: true,
            },
          },
        },
        orderBy: {
          signingOrder: 'asc',
        },
      },
      envelopeItems: true,
      team: {
        select: {
          id: true,
          name: true,
          teamEmail: true,
          teamGlobalSettings: {
            select: {
              includeSigningCertificate: true,
            },
          },
        },
      },
    },
  });

  const recipient = (envelope?.recipients || []).find((r) => r.token === token);

  if (!envelope || !recipient) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Envelope not found',
    });
  }

  if (envelope.envelopeItems.length === 0) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Envelope has no items',
    });
  }

  const documentAccessValid = await isRecipientAuthorized({
    type: 'ACCESS',
    documentAuthOptions: envelope.authOptions,
    recipient,
    userId,
    authOptions: accessAuth,
  });

  if (!documentAccessValid) {
    throw new AppError(AppErrorCode.UNAUTHORIZED, {
      message: 'Invalid access values',
    });
  }

  const settings = await getTeamSettings({ teamId: envelope.teamId });

  // Get the signature if they have put it in already.
  const recipientSignature = await prisma.signature.findFirst({
    where: {
      field: {
        recipientId: recipient.id,
        envelopeId: envelope.id,
      },
    },
    select: {
      id: true,
      recipientId: true,
      signatureImageAsBase64: true,
      typedSignature: true,
    },
  });

  let isRecipientsTurn = true;

  const currentRecipientIndex = envelope.recipients.findIndex((r) => r.token === token);

  if (
    envelope.documentMeta.signingOrder === DocumentSigningOrder.SEQUENTIAL &&
    currentRecipientIndex !== -1
  ) {
    for (let i = 0; i < currentRecipientIndex; i++) {
      if (envelope.recipients[i].signingStatus !== SigningStatus.SIGNED) {
        isRecipientsTurn = false;
        break;
      }
    }
  }

  const sender = settings.includeSenderDetails
    ? {
        email: envelope.user.email,
        name: envelope.user.name || '',
      }
    : {
        email: envelope.team.teamEmail?.email || '',
        name: envelope.team.name || '',
      };

  return ZEnvelopeForSigningResponse.parse({
    envelope,
    recipient,
    recipientSignature,
    isRecipientsTurn,
    isCompleted:
      recipient.signingStatus === SigningStatus.SIGNED ||
      envelope.status === DocumentStatus.COMPLETED,
    isRejected:
      recipient.signingStatus === SigningStatus.REJECTED ||
      envelope.status === DocumentStatus.REJECTED,
    sender,
    settings: {
      includeSenderDetails: settings.includeSenderDetails,
      brandingEnabled: settings.brandingEnabled,
      brandingLogo: settings.brandingLogo,
    },
  } satisfies EnvelopeForSigningResponse);
};
