import type { DocumentData } from '@documenso/prisma/client';

import { getFile } from '../universal/upload/get-file';

type DownloadPDFProps = {
  documentData: DocumentData;
  fileName?: string;
};

export const downloadPDF = async ({ documentData, fileName }: DownloadPDFProps) => {
  const bytes = await getFile(documentData);

  const blob = new Blob([bytes], {
    type: 'application/pdf',
  });

  const link = window.document.createElement('a');

  const [baseTitle] = fileName?.includes('.pdf')
    ? fileName.split('.pdf')
    : [fileName ?? 'document'];

  link.href = window.URL.createObjectURL(blob);
  link.download = `${baseTitle}_signed.pdf`;

  link.click();

  window.URL.revokeObjectURL(link.href);
};
