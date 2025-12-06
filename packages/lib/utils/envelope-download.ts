import type { EnvelopeItem } from '@prisma/client';

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
