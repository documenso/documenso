import type { EnvelopeItem } from '@prisma/client';

import { getEnvelopeItemPdfUrl } from '../utils/envelope-download';
import { downloadFile } from './download-file';

type DocumentVersion = 'original' | 'signed';

type DownloadPDFProps = {
  envelopeItem: Pick<EnvelopeItem, 'id' | 'envelopeId'>;
  token: string | undefined;

  fileName?: string;
  /**
   * Specifies which version of the document to download.
   * 'signed': Downloads the signed version (default).
   * 'original': Downloads the original version (may be DOCX, PNG, JPEG if converted).
   */
  version?: DocumentVersion;
};

const getFilenameFromContentDisposition = (header: string | null): string | null => {
  if (!header) return null;

  const filenameStarMatch = header.match(/filename\*=(?:UTF-8''|utf-8'')([^;]+)/i);
  if (filenameStarMatch) {
    return decodeURIComponent(filenameStarMatch[1]);
  }

  const filenameMatch = header.match(/filename="([^"]+)"/);
  if (filenameMatch) {
    return filenameMatch[1];
  }

  const filenameNoQuotesMatch = header.match(/filename=([^;\s]+)/);
  if (filenameNoQuotesMatch) {
    return filenameNoQuotesMatch[1];
  }

  return null;
};

export const downloadPDF = async ({
  envelopeItem,
  token,
  fileName,
  version = 'signed',
}: DownloadPDFProps) => {
  const downloadUrl = getEnvelopeItemPdfUrl({
    type: 'download',
    envelopeItem: envelopeItem,
    token,
    version,
  });

  const response = await fetch(downloadUrl);
  const blob = await response.blob();

  const contentDisposition = response.headers.get('Content-Disposition');
  const serverFilename = getFilenameFromContentDisposition(contentDisposition);

  let filename: string;
  if (serverFilename) {
    filename = serverFilename;
  } else {
    const baseTitle = (fileName ?? 'document').replace(/\.[^/.]+$/, '');
    const suffix = version === 'signed' ? '_signed.pdf' : '.pdf';
    filename = `${baseTitle}${suffix}`;
  }

  downloadFile({
    filename,
    data: blob,
  });
};
