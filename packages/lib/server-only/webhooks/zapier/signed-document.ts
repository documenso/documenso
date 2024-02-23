import type { NextApiRequest, NextApiResponse } from 'next';

import { findDocuments } from '@documenso/lib/server-only/document/find-documents';
import { getRecipientsForDocument } from '@documenso/lib/server-only/recipient/get-recipients-for-document';

import { getWebhooksByUserId } from '../get-webhooks-by-user-id';
import { validateApiToken } from './validateApiToken';

export const signedDocumentHandler = async (req: NextApiRequest, res: NextApiResponse) => {
  try {
    const { authorization } = req.headers;
    const user = await validateApiToken({ authorization });

    const documents = await findDocuments({ userId: user.id });

    const allWebhooks = await getWebhooksByUserId(user.id);
    const recipients = await getRecipientsForDocument({
      documentId: documents.data[0].id,
      userId: user.id,
    });

    if (documents.data.length > 0 && allWebhooks.length > 0 && recipients.length > 0) {
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
          Recipient: [
            {
              id: recipients[0].id,
              documentId: recipients[0].documentId,
              templateId: recipients[0].templateId,
              email: recipients[0].email,
              name: recipients[0].name,
              token: recipients[0].token,
              expired: recipients[0].expired,
              signedAt: recipients[0].signedAt,
              role: recipients[0].role,
              readStatus: recipients[0].readStatus,
              signingStatus: recipients[0].signingStatus,
              sendStatus: recipients[0].sendStatus,
            },
          ],
        },
      };

      return res.status(200).json([testWebhook]);
    }

    return res.status(200).json([]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      message: 'Internal Server Error',
    });
  }
};
