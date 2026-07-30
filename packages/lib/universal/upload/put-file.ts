import type { TUploadPdfResponse } from '@documenso/remix/server/api/files/files.types';

import { AppError } from '../../errors/app-error';

type File = {
  name: string;
  type: string;
  arrayBuffer: () => Promise<ArrayBuffer>;
};

/**
 * Options for uploads that are not authorized by a logged-in session.
 *
 * Embedded authoring flows run cross-origin without a session cookie, so they
 * must authorize uploads with their embedding presign token instead.
 */
export type PutFileOptions = {
  presignToken?: string;
};

const buildUploadAuthHeaders = (options?: PutFileOptions): Record<string, string> => {
  if (!options?.presignToken) {
    return {};
  }

  return {
    Authorization: `Bearer ${options.presignToken}`,
  };
};

export const putPdfFile = async (file: File, options?: PutFileOptions) => {
  const formData = new FormData();

  // Create a proper File object from the data
  const buffer = await file.arrayBuffer();
  const blob = new Blob([buffer], { type: file.type });
  const properFile = new File([blob], file.name, { type: file.type });

  formData.append('file', properFile);

  const response = await fetch('/api/files/upload-pdf', {
    method: 'POST',
    headers: buildUploadAuthHeaders(options),
    body: formData,
  });

  if (!response.ok) {
    console.error('Upload failed:', response.statusText);
    throw new AppError('UPLOAD_FAILED');
  }

  const result: TUploadPdfResponse = await response.json();

  return result;
};
