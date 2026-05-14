import { AppError } from '@documenso/lib/errors/app-error';

import {
  DOCUMENT_CONVERSION_AUTH,
  DOCUMENT_CONVERSION_MIME_TYPE_DOCX,
  DOCUMENT_CONVERSION_TIMEOUT_MS,
  DOCUMENT_CONVERSION_URL,
} from '../../constants/document-conversion';

type ConvertDocxToPdfViaGotenbergOptions = {
  buffer: Buffer;
  filename: string;
};

const UNAVAILABLE_USER_MESSAGE =
  'Document conversion is temporarily unavailable. Please try again shortly or upload a PDF.';

const NOT_CONFIGURED_USER_MESSAGE = "Document conversion isn't enabled on this instance. Please upload a PDF.";

const CONVERSION_FAILED_USER_MESSAGE =
  "We couldn't convert this file. Please check it's a valid Word document or upload a PDF instead.";

const MAX_ERROR_BODY_CHARS = 500;

/**
 * Posts a DOCX file to the configured Gotenberg-compatible conversion
 * service and returns the resulting PDF bytes.
 *
 * Throws an `AppError` for all failure modes:
 * - `CONVERSION_SERVICE_UNAVAILABLE` for missing config, timeout, or
 *   network errors.
 * - `CONVERSION_FAILED` for non-2xx responses from the service.
 */
export const convertDocxToPdfViaGotenberg = async ({
  buffer,
  filename,
}: ConvertDocxToPdfViaGotenbergOptions): Promise<Buffer> => {
  const url = DOCUMENT_CONVERSION_URL();

  if (!url) {
    throw new AppError('CONVERSION_SERVICE_UNAVAILABLE', {
      message: 'Conversion service URL is not configured',
      userMessage: NOT_CONFIGURED_USER_MESSAGE,
      statusCode: 503,
    });
  }

  const formData = new FormData();
  const blob = new Blob([buffer], { type: DOCUMENT_CONVERSION_MIME_TYPE_DOCX });

  formData.append('files', blob, filename);

  // Tell LibreOffice NOT to export Word content controls (`<w:sdt>`) as PDF
  // AcroForm fields. By default Gotenberg renders the field values into form
  // appearance streams that reference unembedded base fonts (Times-Roman,
  // Times-Bold). Our downstream `normalizePdf` flattens the form, but the
  // pdf-lib flattening drops those appearance streams, so every SDT-bound
  // string (i.e. virtually all of the body text in Office resume / cover-
  // letter templates) ends up invisible in the final PDF. Disabling form
  // export makes LibreOffice render those strings as regular text in the
  // page content stream, with all glyphs embedded.
  formData.append('exportFormFields', 'false');

  // When the service is launched with `--api-enable-basic-auth`, every
  // route (including `/health` and `/forms/libreoffice/convert`) requires
  // HTTP Basic credentials. When auth env vars are not configured we send
  // no header and rely on the service running without auth enabled.
  const auth = DOCUMENT_CONVERSION_AUTH();
  const headers: Record<string, string> = {};

  if (auth) {
    const encoded = Buffer.from(`${auth.username}:${auth.password}`).toString('base64');
    headers.Authorization = `Basic ${encoded}`;
  }

  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), DOCUMENT_CONVERSION_TIMEOUT_MS());

  const convertEndpoint = new URL('/forms/libreoffice/convert', url).toString();

  try {
    const response = await fetch(convertEndpoint, {
      method: 'POST',
      body: formData,
      headers,
      signal: controller.signal,
    });

    if (!response.ok) {
      let body = '';

      try {
        body = await response.text();
      } catch {
        body = '';
      }

      const truncatedBody = body.length > MAX_ERROR_BODY_CHARS ? `${body.slice(0, MAX_ERROR_BODY_CHARS)}...` : body;

      throw new AppError('CONVERSION_FAILED', {
        message: `Conversion service returned ${response.status}: ${truncatedBody}`,
        userMessage: CONVERSION_FAILED_USER_MESSAGE,
        statusCode: 400,
      });
    }

    const arrayBuffer = await response.arrayBuffer();

    return Buffer.from(arrayBuffer);
  } catch (err) {
    if (err instanceof AppError) {
      throw err;
    }

    const isAbortError = err instanceof Error && err.name === 'AbortError';

    if (isAbortError) {
      throw new AppError('CONVERSION_SERVICE_UNAVAILABLE', {
        message: 'Conversion service timed out',
        userMessage: UNAVAILABLE_USER_MESSAGE,
        statusCode: 503,
      });
    }

    const errMessage = err instanceof Error ? err.message : String(err);

    throw new AppError('CONVERSION_SERVICE_UNAVAILABLE', {
      message: `Conversion service request failed: ${errMessage}`,
      userMessage: UNAVAILABLE_USER_MESSAGE,
      statusCode: 503,
    });
  } finally {
    clearTimeout(timeoutHandle);
  }
};
