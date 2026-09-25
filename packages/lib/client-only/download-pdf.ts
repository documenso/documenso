import type { EnvelopeItem } from '@prisma/client';

import { getEnvelopeItemPdfUrl } from '../utils/envelope-download';
import { downloadFile } from './download-file';

type DocumentVersion = 'original' | 'signed' | 'pending';

type DownloadPDFProps = {
  envelopeItem: Pick<EnvelopeItem, 'id' | 'envelopeId'>;
  token: string | undefined;

  fileName?: string;
  /**
   * Specifies which version of the document to download.
   * 'signed': Downloads the signed version (default).
   * 'original': Downloads the original version.
   * 'pending': Downloads the original document with currently-inserted fields burned in.
   *            Only valid while the envelope is in PENDING status.
   */
  version?: DocumentVersion;
};

const versionToFilenameSuffix = (version: DocumentVersion): string => {
  switch (version) {
    case 'signed':
      return '_signed.pdf';
    case 'pending':
      return '_pending.pdf';
    case 'original':
      return '.pdf';
  }
};

/**
 * Fetches a PDF for an envelope item and returns it as a blob alongside the
 * filename it should be saved as. Throws on non-OK responses.
 */
export const fetchPDF = async ({ envelopeItem, token, fileName, version = 'signed' }: DownloadPDFProps) => {
  const downloadUrl = getEnvelopeItemPdfUrl({
    type: 'download',
    envelopeItem: envelopeItem,
    token,
    version,
  });

  const response = await fetch(downloadUrl);

  if (!response.ok) {
    throw new Error(`Failed to download PDF: ${response.status}`);
  }

  const blob = await response.blob();

  const baseTitle = (fileName ?? 'document').replace(/\.pdf$/, '');

  return {
    filename: `${baseTitle}${versionToFilenameSuffix(version)}`,
    blob,
  };
};

export const downloadPDF = async (options: DownloadPDFProps) => {
  const { filename, blob } = await fetchPDF(options);

  downloadFile({
    filename,
    data: blob,
  });
};
