import { env } from '@documenso/lib/utils/env';

export const ALLOWED_UPLOAD_MIME_TYPES: Record<string, string[]> = {
  'application/pdf': ['.pdf'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
};

export const isAllowedMimeType = (mimeType: string): boolean =>
  mimeType in ALLOWED_UPLOAD_MIME_TYPES;

export const getGotenbergUrl = (): string | undefined => env('NEXT_PRIVATE_GOTENBERG_URL');

export const getGotenbergTimeout = (): number => {
  const timeout = env('NEXT_PRIVATE_GOTENBERG_TIMEOUT');
  return timeout ? parseInt(timeout, 10) : 30_000;
};

export const getFileExtensionForMimeType = (mimeType: string): string => {
  const extensions = ALLOWED_UPLOAD_MIME_TYPES[mimeType];
  return extensions?.[0] ?? '.pdf';
};
