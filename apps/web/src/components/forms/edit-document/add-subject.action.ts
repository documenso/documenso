'use server';

import { getRequiredServerComponentSession } from '@documenso/lib/next-auth/get-server-session';
import { createDocumentMeta } from '@documenso/lib/server-only/document-meta/create-document-meta';
import { sendDocument } from '@documenso/lib/server-only/document/send-document';
import { updateDocument } from '@documenso/lib/server-only/document/update-document';
import { TAddSubjectFormSchema } from '@documenso/ui/primitives/document-flow/add-subject.types';

export type CompleteDocumentActionInput = TAddSubjectFormSchema & {
  documentId: number;
};

export const completeDocument = async ({ documentId, email }: CompleteDocumentActionInput) => {
  'use server';

  const { id: userId } = await getRequiredServerComponentSession();

  const createDocumentMetaResponse = await createDocumentMeta({
    emailBody: email.message,
    emailSubject: email.subject,
  });

  if (createDocumentMetaResponse) {
    await updateDocument({
      documentId,
      data: {
        DocumentMeta: {
          connect: {
            id: createDocumentMetaResponse.id,
          },
        },
      },
    });
  }

  await sendDocument({
    userId,
    documentId,
  });
};
