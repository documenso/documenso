'use server';

import { updateTitle } from '@documenso/lib/server-only/document/update-title';
import type { TAddTitleFormSchema } from '@documenso/ui/primitives/document-flow/add-title.types';

export type AddTitleActionInput = TAddTitleFormSchema & {
  documentId: number;
};

export const addTitle = async ({ documentId, title }: AddTitleActionInput) => {
  'use server';

  await updateTitle({
    documentId,
    title: title,
  });
};
