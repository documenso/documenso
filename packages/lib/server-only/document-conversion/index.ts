import { AppError } from '@documenso/lib/errors/app-error';
import type { Logger } from 'pino';

import { DOCUMENT_CONVERSION_MIME_TYPE_DOCX } from '../../constants/document-conversion';
import { convertDocxToPdf } from './docx-to-pdf';

// We should work on unifying these later on.
type FileInput = {
  name: string;
  type: string;
  arrayBuffer: () => Promise<ArrayBuffer>;
};

const UNSUPPORTED_USER_MESSAGE = "This file type isn't supported. Please upload a PDF or Word document.";

/**
 * Entry point for upload routes. Returns a PDF buffer for any supported
 * input file:
 *
 * - PDF in → PDF out (no conversion, no network call).
 * - DOCX in → converted PDF out via the configured conversion service.
 * - Any other mime type → throws `UNSUPPORTED_FILE_TYPE`.
 *
 * To support new source formats (PowerPoint, HTML, ...), add a new
 * `<format>-to-pdf.ts` sibling and dispatch to it from here.
 */
export const convertToPdf = async (file: FileInput, logger?: Logger): Promise<Buffer> => {
  if (file.type === 'application/pdf') {
    return Buffer.from(await file.arrayBuffer());
  }

  if (file.type === DOCUMENT_CONVERSION_MIME_TYPE_DOCX) {
    const buffer = Buffer.from(await file.arrayBuffer());

    return convertDocxToPdf({ buffer, filename: file.name }, logger);
  }

  throw new AppError('UNSUPPORTED_FILE_TYPE', {
    message: `Unsupported file type: ${file.type}`,
    userMessage: UNSUPPORTED_USER_MESSAGE,
    statusCode: 400,
  });
};
