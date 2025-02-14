import type { DocumentData } from '@documenso/prisma/client';

import { getFile } from '../universal/upload/get-file';
import { downloadFile } from './download-file';

type DownloadPDFProps = {
  documentData: DocumentData;
  fileName?: string;
  includeCertificate?: boolean;
  includeAuditLog?: boolean;
};

export const downloadPDF = async ({
  documentData,
  fileName,
  includeCertificate,
  includeAuditLog,
}: DownloadPDFProps) => {
  const bytes = await getFile(documentData);

  const blob = new Blob([bytes], {
    type: 'application/pdf',
  });

  const baseTitle = (fileName ?? 'document').replace(/\.pdf$/, '');

  let suffix = '_signed';

  if (includeCertificate && includeAuditLog) {
    suffix = suffix + '_with_certificate_and_audit';
  } else if (includeCertificate) {
    suffix = suffix + '_with_certificate';
  } else if (includeAuditLog) {
    suffix = suffix + '_with_audit';
  }

  downloadFile({
    filename: `${baseTitle}${suffix}.pdf`,
    data: blob,
  });
};
