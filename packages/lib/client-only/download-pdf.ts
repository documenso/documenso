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
   * 'original': Downloads the original version.
   */
  version?: DocumentVersion;
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

  const blob = await fetch(downloadUrl).then(async (res) => await res.blob());

  const baseTitle = (fileName ?? 'document').replace(/\.pdf$/, '');
  const suffix = version === 'signed' ? '_signed.pdf' : '.pdf';

  downloadFile({
    filename: `${baseTitle}${suffix}`,
    data: blob,
  });
};
