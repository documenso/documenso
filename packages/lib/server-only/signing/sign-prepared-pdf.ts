import type { PDF } from '@libpdf/core';

import { signPdf } from '@documenso/signing';

import {
  NEXT_PRIVATE_SIGNING_HTTP_AUTH_HEADER,
  NEXT_PRIVATE_SIGNING_HTTP_AUTH_TOKEN,
  NEXT_PRIVATE_SIGNING_HTTP_FORM_FIELD_NAME,
  NEXT_PRIVATE_SIGNING_HTTP_TIMEOUT_MS,
  NEXT_PRIVATE_SIGNING_HTTP_URL,
} from '../../constants/app';
import { env } from '../../utils/env';
import { fetchWithTimeout } from '../../utils/timeout';

type SignPreparedPdfOptions = {
  fileName: string;
  pdf: PDF;
};

const signPreparedPdfWithHttp = async ({ fileName, pdf }: SignPreparedPdfOptions) => {
  const url = NEXT_PRIVATE_SIGNING_HTTP_URL();

  if (!url) {
    throw new Error('No HTTP signing URL configured');
  }

  const form = new FormData();
  const unsignedPdfBytes = await pdf.save({ useXRefStream: true });

  form.set(
    NEXT_PRIVATE_SIGNING_HTTP_FORM_FIELD_NAME(),
    new File([unsignedPdfBytes], fileName, {
      type: 'application/pdf',
    }),
  );

  const authToken = NEXT_PRIVATE_SIGNING_HTTP_AUTH_TOKEN();
  const headers = new Headers();

  if (authToken) {
    headers.set(NEXT_PRIVATE_SIGNING_HTTP_AUTH_HEADER(), authToken);
  }

  const response = await fetchWithTimeout(url, {
    method: 'POST',
    headers,
    body: form,
    timeoutMs: NEXT_PRIVATE_SIGNING_HTTP_TIMEOUT_MS(),
  });

  if (!response.ok) {
    const responseBody = await response.text().catch(() => '');

    throw new Error(
      `HTTP signing failed with status ${response.status}${responseBody ? `: ${responseBody.slice(0, 300)}` : ''}`,
    );
  }

  const signedPdfBytes = new Uint8Array(await response.arrayBuffer());

  if (signedPdfBytes.byteLength === 0) {
    throw new Error('HTTP signing returned an empty response');
  }

  return signedPdfBytes;
};

export const signPreparedPdf = async (options: SignPreparedPdfOptions) => {
  const transport = env('NEXT_PRIVATE_SIGNING_TRANSPORT') || 'local';

  if (transport === 'http') {
    return await signPreparedPdfWithHttp(options);
  }

  return await signPdf({ pdf: options.pdf });
};
