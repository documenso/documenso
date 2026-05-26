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
   *            Only valid while the envelope is in PENDING status. Not supported via
   *            recipient token.
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

export const downloadPDF = async ({ envelopeItem, token, fileName, version = 'signed' }: DownloadPDFProps) => {
  const downloadUrl = getEnvelopeItemPdfUrl({
    type: 'download',
    envelopeItem: envelopeItem,
    token,
    version,
  });

  const blob = await fetch(downloadUrl).then(async (res) => await res.blob());

  const baseTitle = (fileName ?? 'document').replace(/\.pdf$/, '');

  downloadFile({
    filename: `${baseTitle}${versionToFilenameSuffix(version)}`,
    data: blob,
  });
};
