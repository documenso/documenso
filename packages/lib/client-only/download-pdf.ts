import type { EnvelopeItem } from '@prisma/client';

import { getEnvelopeItemPdfUrl } from '../utils/envelope-download';
import { downloadFile } from './download-file';

type DocumentVersion = 'original' | 'signed' | 'partial';

type DownloadPDFProps = {
  envelopeItem: Pick<EnvelopeItem, 'id' | 'envelopeId'>;
  token: string | undefined;

  fileName?: string;
  /**
   * Specifies which version of the document to download.
   * 'signed': Downloads the signed version (default).
   * 'original': Downloads the original version.
   * 'partial': Downloads a draft including signatures collected so far. Owner-only.
   */
  version?: DocumentVersion;
};

const SUFFIX_BY_VERSION: Record<DocumentVersion, string> = {
  signed: '_signed.pdf',
  partial: '_partial.pdf',
  original: '.pdf',
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
    // Partial downloads must use the session-authenticated owner endpoint, never
    // the recipient token endpoint.
    token: version === 'partial' ? undefined : token,
    version,
  });

  const response = await fetch(downloadUrl);

  if (!response.ok) {
    throw new Error(`Failed to download PDF (${response.status})`);
  }

  const blob = await response.blob();

  const baseTitle = (fileName ?? 'document').replace(/\.pdf$/, '');

  downloadFile({
    filename: `${baseTitle}${SUFFIX_BY_VERSION[version]}`,
    data: blob,
  });
};
