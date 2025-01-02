import type { Webhook } from '@prisma/client';

import { findDocuments } from '@documenso/lib/server-only/document/find-documents';
import { getRecipientsForDocument } from '@documenso/lib/server-only/recipient/get-recipients-for-document';

import { getWebhooksByTeamId } from '../get-webhooks-by-team-id';
import { getWebhooksByUserId } from '../get-webhooks-by-user-id';
import { validateApiToken } from './validateApiToken';

export const listDocumentsHandler = async (req: Request) => {
  try {
    const authorization = req.headers.get('authorization');

    if (!authorization) {
      return new Response('Unauthorized', { status: 401 });
    }

    const { user, userId, teamId } = await validateApiToken({ authorization });

    let allWebhooks: Webhook[] = [];

    const documents = await findDocuments({
      userId: userId ?? user.id,
      teamId: teamId ?? undefined,
      perPage: 1,
    });

    const recipients = await getRecipientsForDocument({
      documentId: documents.data[0].id,
      userId: userId ?? user.id,
      teamId: teamId ?? undefined,
    });

    if (userId) {
      allWebhooks = await getWebhooksByUserId(userId);
    }

    if (teamId) {
      allWebhooks = await getWebhooksByTeamId(teamId, user.id);
    }

    if (documents && documents.data.length > 0 && allWebhooks.length > 0 && recipients.length > 0) {
      const testWebhook = {
        event: allWebhooks[0].eventTriggers.toString(),
        createdAt: allWebhooks[0].createdAt,
        webhookEndpoint: allWebhooks[0].webhookUrl,
        payload: {
          id: documents.data[0].id,
          userId: documents.data[0].userId,
          title: documents.data[0].title,
          status: documents.data[0].status,
          documentDataId: documents.data[0].documentDataId,
          createdAt: documents.data[0].createdAt,
          updatedAt: documents.data[0].updatedAt,
          completedAt: documents.data[0].completedAt,
          deletedAt: documents.data[0].deletedAt,
          teamId: documents.data[0].teamId,
          Recipient: recipients,
        },
      };

      return Response.json([testWebhook]);
    }

    return Response.json([]);
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
