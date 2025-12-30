import { type DocumentDataType, DocumentStatus } from '@prisma/client';
import contentDisposition from 'content-disposition';
import { type Context } from 'hono';

import { getFileExtensionForMimeType } from '@documenso/lib/constants/upload';
import { sha256 } from '@documenso/lib/universal/crypto';
import { getFileServerSide } from '@documenso/lib/universal/upload/get-file.server';

import type { HonoEnv } from '../../router';

type HandleEnvelopeItemFileRequestOptions = {
  title: string;
  status: DocumentStatus;
  documentData: {
    type: DocumentDataType;
    data: string;
    initialData: string;
    originalData?: string | null;
    originalMimeType?: string | null;
  };
  version: 'signed' | 'original';
  isDownload: boolean;
  context: Context<HonoEnv>;
};

/**
 * Helper function to handle envelope item file requests (both view and download)
 */
export const handleEnvelopeItemFileRequest = async ({
  title,
  status,
  documentData,
  version,
  isDownload,
  context: c,
}: HandleEnvelopeItemFileRequestOptions) => {
  const shouldServeOriginalSourceFile =
    version === 'original' &&
    documentData.originalData &&
    documentData.originalMimeType &&
    documentData.originalMimeType !== 'application/pdf';

  const documentDataToUse = shouldServeOriginalSourceFile
    ? documentData.originalData!
    : version === 'signed'
      ? documentData.data
      : documentData.initialData;

  const contentType = shouldServeOriginalSourceFile
    ? documentData.originalMimeType!
    : 'application/pdf';

  const etag = Buffer.from(sha256(documentDataToUse)).toString('hex');

  if (c.req.header('If-None-Match') === etag && !isDownload) {
    return c.body(null, 304);
  }

  const file = await getFileServerSide({
    type: documentData.type,
    data: documentDataToUse,
  }).catch((error) => {
    console.error(error);

    return null;
  });

  if (!file) {
    return c.json({ error: 'File not found' }, 404);
  }

  c.header('Content-Type', contentType);
  c.header('ETag', etag);

  if (!isDownload) {
    if (status === DocumentStatus.COMPLETED) {
      c.header('Cache-Control', 'public, max-age=31536000, immutable');
    } else {
      c.header('Cache-Control', 'public, max-age=0, must-revalidate');
    }
  }

  if (isDownload) {
    const baseTitle = title.replace(/\.[^/.]+$/, '');

    let filename: string;
    if (version === 'signed') {
      filename = `${baseTitle}_signed.pdf`;
    } else if (shouldServeOriginalSourceFile) {
      const extension = getFileExtensionForMimeType(documentData.originalMimeType!);
      filename = `${baseTitle}${extension}`;
    } else {
      filename = `${baseTitle}.pdf`;
    }

    c.header('Content-Disposition', contentDisposition(filename));

    // For downloads, prevent caching to ensure fresh data
    c.header('Cache-Control', 'no-cache, no-store, must-revalidate');
    c.header('Pragma', 'no-cache');
    c.header('Expires', '0');
  }

  return c.body(file);
};
