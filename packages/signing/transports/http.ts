import { env } from '@documenso/lib/utils/env';
import { signWithHttp as signWithHttpNative } from '@documenso/pdf-sign';

import { addSigningPlaceholder } from '../helpers/add-signing-placeholder';
import { updateSigningPlaceholder } from '../helpers/update-signing-placeholder';

export type SignWithHttpOptions = {
  pdf: Buffer;
};

export const signWithHttp = async ({ pdf }: SignWithHttpOptions) => {
  const { pdf: pdfWithPlaceholder } = updateSigningPlaceholder({
    pdf: await addSigningPlaceholder({ pdf }),
  });

  const serverUrl = env('NEXT_PRIVATE_SIGNING_HTTP_SERVER_URL');
  const authToken = env('NEXT_PRIVATE_SIGNING_HTTP_AUTH_TOKEN');

  if (!serverUrl) {
    throw new Error('HTTP signing server URL is required');
  }

  return await signWithHttpNative({
    content: pdfWithPlaceholder,
    serverUrl,
    authToken,
    timestampServer: env('NEXT_PRIVATE_SIGNING_TIMESTAMP_SERVER') || undefined,
  });
};
