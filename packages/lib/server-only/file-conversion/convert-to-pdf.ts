import { isAllowedMimeType } from '../../constants/upload';
import { AppError } from '../../errors/app-error';
import { convertFileToPdfViaGotenberg } from '../gotenberg/gotenberg-client';

type FileInput = {
  name: string;
  type: string;
  arrayBuffer: () => Promise<ArrayBuffer>;
};

export type ConvertToPdfResult = {
  pdfBuffer: Buffer;
  originalMimeType: string;
};

export const convertToPdfIfNeeded = async (file: FileInput): Promise<ConvertToPdfResult> => {
  const originalMimeType = file.type;

  if (!isAllowedMimeType(originalMimeType)) {
    throw new AppError('UNSUPPORTED_FILE_TYPE', {
      message: `File type '${originalMimeType}' is not supported`,
      userMessage: 'This file type is not supported. Please upload a PDF, DOCX, JPEG, or PNG file.',
      statusCode: 400,
    });
  }

  if (originalMimeType === 'application/pdf') {
    const arrayBuffer = await file.arrayBuffer();
    return {
      pdfBuffer: Buffer.from(arrayBuffer),
      originalMimeType,
    };
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const pdfBuffer = await convertFileToPdfViaGotenberg({
    file: buffer,
    filename: file.name,
    mimeType: originalMimeType,
  });

  return {
    pdfBuffer,
    originalMimeType,
  };
};
