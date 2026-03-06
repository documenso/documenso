import type { EnvelopeItem } from '@prisma/client';

import type { DocumentDataVersion } from '@documenso/lib/types/document';

import { NEXT_PUBLIC_WEBAPP_URL } from '../constants/app';

export type EnvelopeItemPdfUrlOptions =
  | {
      type: 'download';
      envelopeItem: Pick<EnvelopeItem, 'id' | 'envelopeId'>;
      token: string | undefined;
      version: 'original' | 'signed';
      presignToken?: undefined;
    }
  | {
      type: 'view';
      envelopeItem: Pick<EnvelopeItem, 'id' | 'envelopeId'>;
      token: string | undefined;
      presignToken?: string | undefined;
    };

export const getEnvelopeItemPdfUrl = (options: EnvelopeItemPdfUrlOptions) => {
  const { envelopeItem, token, type, presignToken } = options;

  const { id, envelopeId } = envelopeItem;

  if (type === 'download') {
    const version = options.version;

    return token
      ? `${NEXT_PUBLIC_WEBAPP_URL()}/api/files/token/${token}/envelopeItem/${id}/download/${version}${presignToken ? `?presignToken=${presignToken}` : ''}`
      : `${NEXT_PUBLIC_WEBAPP_URL()}/api/files/envelope/${envelopeId}/envelopeItem/${id}/download/${version}`;
  }

  return token
    ? `${NEXT_PUBLIC_WEBAPP_URL()}/api/files/token/${token}/envelopeItem/${id}${presignToken ? `?presignToken=${presignToken}` : ''}`
    : `${NEXT_PUBLIC_WEBAPP_URL()}/api/files/envelope/${envelopeId}/envelopeItem/${id}${presignToken ? `?token=${presignToken}` : ''}`;
};

export type DocumentDataUrlOptions = {
  envelopeId: string;
  envelopeItemId: string;
  documentDataId: string;
  token: string | undefined;
  presignToken?: string | undefined;
  version: DocumentDataVersion;
};

/**
 * The difference between this and `getEnvelopeItemPdfUrl` is that this will
 * hard cache since we add the `documentDataId` to the URL.
 *
 * Since `documentDataId` should change when the document is changed/signed, this is a
 * good way to cache an envelope item by.
 */
export const getDocumentDataUrl = (options: DocumentDataUrlOptions) => {
  const { envelopeId, envelopeItemId, documentDataId, token, presignToken, version } = options;

  const partialUrl = `envelope/${envelopeId}/envelopeItem/${envelopeItemId}/dataId/${documentDataId}/${version}/item.pdf`;

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
