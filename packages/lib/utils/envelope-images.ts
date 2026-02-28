import { NEXT_PUBLIC_WEBAPP_URL } from '../constants/app';
import type { DocumentDataVersion } from '../types/document-data';

export type EnvelopeItemPageImageUrlOptions = {
  envelopeId: string;
  envelopeItemId: string;
  documentDataId: string;
  pageIndex: number;
  token: string | undefined;
  presignToken?: string | undefined;
  version: DocumentDataVersion;
};

/**
 * Generates the URL for fetching a single page of a PDF as an image.
 */
export const getEnvelopeItemPageImageUrl = (options: EnvelopeItemPageImageUrlOptions): string => {
  const { envelopeId, envelopeItemId, documentDataId, pageIndex, token, presignToken, version } =
    options;

  const partialUrl = `envelope/${envelopeId}/envelopeItem/${envelopeItemId}/dataId/${documentDataId}/${version}/${pageIndex}/image.jpeg`;

  // Recipient token endpoint.
  if (token) {
    return `${NEXT_PUBLIC_WEBAPP_URL()}/api/files/token/${token}/${partialUrl}`;
  }

  // Endpoint authenticated by session or presigned token.
  const baseUrl = `${NEXT_PUBLIC_WEBAPP_URL()}/api/files/${partialUrl}`;

  if (presignToken) {
    return `${baseUrl}?presignToken=${presignToken}`;
  }

  return baseUrl;
};

export type EnvelopeItemMetaUrlOptions = {
  envelopeId: string;
  token: string | undefined;
  presignToken?: string | undefined;
};

/**
 * Generates the URL for fetching envelope metadata (page counts and dimensions).
 */
export const getEnvelopeItemMetaUrl = (options: EnvelopeItemMetaUrlOptions): string => {
  const { envelopeId, token, presignToken } = options;

  // Recipient token endpoint.
  if (token) {
    return `${NEXT_PUBLIC_WEBAPP_URL()}/api/files/token/${token}/envelope/${envelopeId}/meta`;
  }

  // Endpoint authenticated by session or presigned token.
  const baseUrl = `${NEXT_PUBLIC_WEBAPP_URL()}/api/files/envelope/${envelopeId}/meta`;

  if (presignToken) {
    return `${baseUrl}?presignToken=${presignToken}`;
  }

  return baseUrl;
};

export const getEnvelopeItemPageImageS3Key = (
  documentDataId: string,
  pageIndex: number,
): string => {
  // Sanity check incase someone passes in a base64 PDF somehow.
  if (documentDataId.length > 100) {
    throw new Error('Document data is too long to be a valid S3 key');
  }

  const baseKey = documentDataId.split('/')[0];

  // Basic safeguard to prevent path traversal.
  // Key should never be user-controlled.
  if (baseKey.includes('..') || baseKey.startsWith('/')) {
    throw new Error('Invalid S3 key');
  }

  return `${baseKey}/${pageIndex}.jpeg`;
};
