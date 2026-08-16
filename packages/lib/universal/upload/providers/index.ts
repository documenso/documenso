import { env } from '@documenso/lib/utils/env';

import { AzureBlobProvider } from './azure-blob-provider';
import { S3Provider } from './s3-provider';
import type { StorageProvider } from './storage-provider';

export type { PresignedUrl, StorageProvider, UploadFileInput, UploadFileResult } from './storage-provider';

let cached: StorageProvider | null = null;

export const getStorageProvider = (): StorageProvider => {
  if (cached) {
    return cached;
  }

  const transport = env('NEXT_PUBLIC_UPLOAD_TRANSPORT');

  switch (transport) {
    case 's3':
      cached = new S3Provider();
      return cached;
    case 'azure-blob':
      cached = new AzureBlobProvider();
      return cached;
    default:
      throw new Error(`Invalid object storage transport: "${transport}". Expected "s3" or "azure-blob".`);
  }
};
