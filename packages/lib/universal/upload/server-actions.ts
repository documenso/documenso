import { getStorageProvider } from './providers';

export const getPresignPostUrl = async (fileName: string, contentType: string, userId?: number) => {
  return getStorageProvider().getPresignPostUrl(fileName, contentType, userId);
};

export const getAbsolutePresignPostUrl = async (key: string) => {
  return getStorageProvider().getAbsolutePresignPostUrl(key);
};

export const getPresignGetUrl = async (key: string) => {
  return getStorageProvider().getPresignGetUrl(key);
};

/**
 * Uploads a file server-side. Name preserved for backward compatibility with
 * existing callers; underneath it delegates to the active storage provider.
 */
export const uploadS3File = async (file: File) => {
  const buffer = await file.arrayBuffer();
  const { key } = await getStorageProvider().uploadFile({
    name: file.name,
    type: file.type,
    body: buffer,
  });
  return { key };
};

export const deleteS3File = async (key: string) => {
  return getStorageProvider().deleteFile(key);
};
