import { msg } from '@lingui/core/macro';
import { ErrorCode, type FileRejection } from 'react-dropzone';
import { match } from 'ts-pattern';

import { APP_DOCUMENT_UPLOAD_SIZE_LIMIT } from '@documenso/lib/constants/app';

export const buildDropzoneRejectionDescription = (fileRejections: FileRejection[]) => {
  const errorCode = fileRejections[0]?.errors[0]?.code;

  return match(errorCode)
    .with(
      ErrorCode.FileTooLarge,
      () => msg`File is larger than ${APP_DOCUMENT_UPLOAD_SIZE_LIMIT}MB`,
    )
    .with(ErrorCode.FileInvalidType, () => msg`Only PDF files are allowed`)
    .with(ErrorCode.FileTooSmall, () => msg`File is too small`)
    .with(ErrorCode.TooManyFiles, () => msg`Only one file can be uploaded at a time`)
    .otherwise(() => msg`Unknown error`);
};
