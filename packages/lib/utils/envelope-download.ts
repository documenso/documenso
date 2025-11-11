import type { EnvelopeItem } from '@prisma/client';

import { NEXT_PUBLIC_WEBAPP_URL } from '../constants/app';

export type EnvelopeDownloadUrlOptions = {
  envelopeItem: Pick<EnvelopeItem, 'id' | 'envelopeId'>;
  token: string | undefined;
  version: 'original' | 'signed';
};

export const getEnvelopeDownloadUrl = (options: EnvelopeDownloadUrlOptions) => {
  const { envelopeItem, token, version } = options;

  const { id, envelopeId } = envelopeItem;

  return token
    ? `${NEXT_PUBLIC_WEBAPP_URL()}/api/files/token/${token}/envelopeItem/${id}/download/${version}`
    : `${NEXT_PUBLIC_WEBAPP_URL()}/api/files/envelope/${envelopeId}/envelopeItem/${id}/download/${version}`;
};
