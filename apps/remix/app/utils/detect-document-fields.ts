import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import type { TDetectedFormField } from '@documenso/lib/types/document-analysis';

export const detectFieldsInDocument = async (envelopeId: string): Promise<TDetectedFormField[]> => {
  const response = await fetch('/api/ai/detect-fields', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ envelopeId }),
    credentials: 'include',
  });

  if (!response.ok) {
    const errorText = await response.text();

    console.error('Field detection failed:', {
      status: response.status,
      statusText: response.statusText,
      error: errorText,
    });

    throw new AppError(AppErrorCode.UNKNOWN_ERROR, {
      message: `Field detection failed: ${response.statusText}`,
      userMessage: 'Failed to detect fields in the document. Please try adding fields manually.',
    });
  }

  const data = await response.json();

  if (!Array.isArray(data)) {
    throw new AppError(AppErrorCode.UNKNOWN_ERROR, {
      message: 'Invalid response from field detection API - expected array',
      userMessage: 'Failed to detect fields in the document. Please try again.',
    });
  }

  return data;
};
