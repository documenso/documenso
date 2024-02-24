import type { DocumentData } from '@documenso/prisma/client';

import { getFile } from '../universal/upload/get-file';
import { downloadFile } from './download-file';

type DownloadPDFProps = {
  documentData: DocumentData;
  fileName?: string;
};

export const downloadPDF = async ({ documentData, fileName }: DownloadPDFProps) => {
  const bytes = await getFile(documentData);

  const blob = new Blob([bytes], {
    type: 'application/pdf',
  });

  const [baseTitle] = fileName?.includes('.pdf')
    ? fileName.split('.pdf')
    : [fileName ?? 'document'];

  downloadFile({
    filename: baseTitle,
    data: blob,
  });
};
