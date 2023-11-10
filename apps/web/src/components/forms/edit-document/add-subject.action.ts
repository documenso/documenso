'use server';

import { getRequiredServerComponentSession } from '@documenso/lib/next-auth/get-server-session';
import { upsertDocumentMeta } from '@documenso/lib/server-only/document-meta/upsert-document-meta';
import { sendDocument } from '@documenso/lib/server-only/document/send-document';
import { TAddSubjectFormSchema } from '@documenso/ui/primitives/document-flow/add-subject.types';

export type CompleteDocumentActionInput = TAddSubjectFormSchema & {
  documentId: number;
};

export const completeDocument = async ({ documentId, email }: CompleteDocumentActionInput) => {
  'use server';

  const { user } = await getRequiredServerComponentSession();

  if (email.message || email.subject) {
    await upsertDocumentMeta({
      documentId,
      subject: email.subject,
      message: email.message,
    });
  }

  return await sendDocument({
    userId: user.id,
    documentId,
  });
};
