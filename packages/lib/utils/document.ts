import type { Document } from '@prisma/client';
import { DocumentStatus, RecipientRole, SigningStatus } from '@prisma/client';

export const isDocumentCompleted = (document: Pick<Document, 'status'> | DocumentStatus) => {
  const status = typeof document === 'string' ? document : document.status;

  return status === DocumentStatus.COMPLETED || status === DocumentStatus.REJECTED;
};

export const isDocumentBeingProcessed = (document: {
  status: DocumentStatus;
  deletedAt: Date | null;
  recipients: Array<{
    role: RecipientRole;
    signingStatus: SigningStatus;
  }>;
}) => {
  if (document.status !== DocumentStatus.PENDING || document.deletedAt !== null) {
    return false;
  }

  const recipients = document.recipients.filter((r) => r.role !== RecipientRole.CC);

  if (recipients.length === 0) {
    return false;
  }

  return recipients.every((r) => r.signingStatus === SigningStatus.SIGNED);
};
