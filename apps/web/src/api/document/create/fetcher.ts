import { useMutation } from '@tanstack/react-query';

import { TCreateDocumentRequestSchema, ZCreateDocumentResponseSchema } from './types';

export const useCreateDocument = () => {
  return useMutation(async ({ file }: TCreateDocumentRequestSchema) => {
    const formData = new FormData();

    formData.set('file', file);

    const response = await fetch('/api/document/create', {
      method: 'POST',
      body: formData,
    });

    const body = await response.json();

    if (response.status !== 200) {
      throw new Error('Failed to create document');
    }

    const safeBody = ZCreateDocumentResponseSchema.safeParse(body);

    if (!safeBody.success) {
      throw new Error('Failed to create document');
    }

    if ('error' in safeBody.data) {
      throw new Error(safeBody.data.error);
    }

    return safeBody.data;
  });
};
