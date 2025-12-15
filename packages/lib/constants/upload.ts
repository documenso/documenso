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
