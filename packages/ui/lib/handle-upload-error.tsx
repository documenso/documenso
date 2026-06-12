import type { MessageDescriptor } from '@lingui/core';
import { msg } from '@lingui/core/macro';
import { match } from 'ts-pattern';

import { AppErrorCode } from '@documenso/lib/errors/app-error';

/**
 * Map an upload-related AppError code to a user-actionable, translatable message.
 *
 * The document upload pipeline throws specific AppErrors — password-protected PDFs
 * (`ENCRYPTED_DOCUMENT_REQUIRES_PASSWORD`), Word conversion failures/timeouts
 * (`CONVERSION_FAILED` / `CONVERSION_TIMEOUT`), invalid files (`INVALID_DOCUMENT_FILE`)
 * and quota limits. The upload buttons previously only handled a few of these codes
 * and collapsed everything else into a generic "An error occurred while uploading your
 * document." toast, leaving users with no idea how to fix the problem. Centralising the
 * mapping here keeps every upload entry point giving the same actionable guidance.
 */
export const buildUploadErrorMessage = (errorCode: string): MessageDescriptor =>
  match(errorCode)
    .with(
      AppErrorCode.LIMIT_EXCEEDED,
      () => msg`You have reached your document limit for this month.`,
    )
    .with(
      'ENVELOPE_ITEM_LIMIT_EXCEEDED',
      () => msg`You have reached the limit of the number of files per envelope.`,
    )
    .with(
      'INVALID_DOCUMENT_FILE',
      () => msg`The uploaded file is not a valid document. Please upload a valid PDF or Word file.`,
    )
    .with(
      AppErrorCode.ENCRYPTED_DOCUMENT_REQUIRES_PASSWORD,
      () =>
        msg`This PDF is password-protected. Please remove the password and try uploading again.`,
    )
    .with(
      AppErrorCode.DECRYPTION_FAILED,
      () =>
        msg`We couldn't process this encrypted PDF. Please remove its password protection and try again.`,
    )
    .with(
      AppErrorCode.CONVERSION_FAILED,
      () =>
        msg`The document could not be converted to a PDF. It may be too large or in an unsupported format — try uploading a PDF instead.`,
    )
    .with(
      AppErrorCode.CONVERSION_TIMEOUT,
      () => msg`The document took too long to convert. Please try a smaller file, or upload it as a PDF.`,
    )
    .with(
      AppErrorCode.DEPENDENCY_MISSING,
      () =>
        msg`This document needs server-side processing that is currently unavailable. Please contact support or try a different file.`,
    )
    .otherwise(() => msg`An error occurred while uploading your document. Please try again.`);
