'use server';

import { getRequiredServerComponentSession } from '@documenso/lib/next-auth/get-server-session';
import { sendDocument } from '@documenso/lib/server-only/document/send-document';
import { TAddSubjectFormSchema } from '@documenso/ui/primitives/document-flow/add-subject.types';

export type CompleteDocumentActionInput = TAddSubjectFormSchema & {
  documentId: number;
};

export const completeDocument = async ({ documentId }: CompleteDocumentActionInput) => {
  'use server';

  const { id: userId } = await getRequiredServerComponentSession();

  await sendDocument({
    userId,
    documentId,
  });
};
