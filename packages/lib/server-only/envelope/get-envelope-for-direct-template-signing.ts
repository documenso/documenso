import { DocumentStatus, EnvelopeType } from '@prisma/client';
import { match } from 'ts-pattern';

import { prisma } from '@documenso/prisma';

import { AppError, AppErrorCode } from '../../errors/app-error';
import { DocumentAccessAuth, type TDocumentAuthMethods } from '../../types/document-auth';
import { extractDocumentAuthMethods } from '../../utils/document-auth';
import { extractFieldAutoInsertValues } from '../document/send-document';
import { getTeamSettings } from '../team/get-team-settings';
import type { EnvelopeForSigningResponse } from './get-envelope-for-recipient-signing';
import { ZEnvelopeForSigningResponse } from './get-envelope-for-recipient-signing';

export type GetRecipientEnvelopeByTokenOptions = {
  token: string;
  userId?: number;
  accessAuth?: TDocumentAuthMethods;
};

/**
 * Get all the values and details for a direct template envelope that a recipient requires.
 *
 * Do not overexpose any information that the recipient should not have.
 */
export const getEnvelopeForDirectTemplateSigning = async ({
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
      type: EnvelopeType.TEMPLATE,
      status: DocumentStatus.DRAFT,
      directLink: {
        enabled: true,
        token,
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
      envelopeItems: {
        include: {
          documentData: true,
        },
      },
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
      directLink: true,
    },
  });

  const recipient = (envelope?.recipients || []).find(
    (r) => r.id === envelope?.directLink?.directTemplateRecipientId,
  );

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

  // Currently not using this since for direct templates "User" access means they just need to be
  // logged in.
  // const documentAccessValid = await isRecipientAuthorized({
  //   type: 'ACCESS',
  //   documentAuthOptions: envelope.authOptions,
  //   recipient,
  //   userId,
  //   authOptions: accessAuth,
  // });

  const { derivedRecipientAccessAuth } = extractDocumentAuthMethods({
    documentAuth: envelope.authOptions,
  });

  // Ensure typesafety when we add more options.
  const documentAccessValid = derivedRecipientAccessAuth.every((auth) =>
    match(auth)
      .with(DocumentAccessAuth.ACCOUNT, () => Boolean(userId))
      .with(DocumentAccessAuth.TWO_FACTOR_AUTH, () => true)
      .exhaustive(),
  );

  if (!documentAccessValid) {
    throw new AppError(AppErrorCode.UNAUTHORIZED, {
      message: 'Invalid access values',
    });
  }

  const settings = await getTeamSettings({ teamId: envelope.teamId });

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
    recipient: {
      ...recipient,
      directToken: envelope.directLink?.token || '',
      fields: recipient.fields.map((field) => {
        const autoInsertValue = extractFieldAutoInsertValues(field);

        if (!autoInsertValue) {
          return field;
        }

        return {
          ...field,
          inserted: true,
          customText: autoInsertValue.customText,
        };
      }),
    },
    recipientSignature: null,
    isRecipientsTurn: true,
    isCompleted: false,
    isRejected: false,
    sender,
    settings: {
      includeSenderDetails: settings.includeSenderDetails,
      brandingEnabled: settings.brandingEnabled,
      brandingLogo: settings.brandingLogo,
    },
  } satisfies EnvelopeForSigningResponse);
};
