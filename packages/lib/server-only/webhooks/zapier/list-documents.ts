import { EnvelopeType, type Webhook } from '@prisma/client';

import { prisma } from '@documenso/prisma';

import { mapSecondaryIdToDocumentId } from '../../../utils/envelope';
import { getWebhooksByTeamId } from '../get-webhooks-by-team-id';
import { validateApiToken } from './validateApiToken';

export const listDocumentsHandler = async (req: Request) => {
  try {
    const authorization = req.headers.get('authorization');

    if (!authorization) {
      return new Response('Unauthorized', { status: 401 });
    }

    const { user, teamId } = await validateApiToken({ authorization });

    const allWebhooks: Webhook[] = await getWebhooksByTeamId(teamId, user.id);

    const document = await prisma.envelope.findFirst({
      where: {
        userId: user.id,
        teamId,
        type: EnvelopeType.DOCUMENT,
      },
      include: {
        envelopeItems: {
          include: {
            documentData: true,
          },
        },
        recipients: true,
      },
    });

    if (
      !document ||
      document.envelopeItems.length === 0 ||
      document.recipients.length === 0 ||
      allWebhooks.length === 0
    ) {
      return Response.json([]);
    }

    const legacyDocumentId = mapSecondaryIdToDocumentId(document.secondaryId);

    const testWebhook = {
      event: allWebhooks[0].eventTriggers.toString(),
      createdAt: allWebhooks[0].createdAt,
      webhookEndpoint: allWebhooks[0].webhookUrl,
      payload: {
        id: legacyDocumentId,
        userId: document.userId,
        title: document.title,
        status: document.status,
        createdAt: document.createdAt,
        updatedAt: document.updatedAt,
        completedAt: document.completedAt,
        deletedAt: document.deletedAt,
        teamId: document.teamId,
        Recipient: document.recipients.map((recipient) => ({
          id: recipient.id,
          documentId: legacyDocumentId,
          templateId: null,
          email: recipient.email,
          name: recipient.name,
          token: recipient.token,
          documentDeletedAt: recipient.documentDeletedAt,
          expired: recipient.expired,
          signedAt: recipient.signedAt,
          authOptions: recipient.authOptions,
          signingOrder: recipient.signingOrder,
          rejectionReason: recipient.rejectionReason,
          role: recipient.role,
          readStatus: recipient.readStatus,
          signingStatus: recipient.signingStatus,
          sendStatus: recipient.sendStatus,
        })),
      },
    };

    return Response.json([testWebhook]);
  } catch (err) {
    console.error(err);

    return Response.json(
      {
        message: 'Internal Server Error',
      },
      { status: 500 },
    );
  }
};
