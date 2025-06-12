import { useEffect } from 'react';

import type { DocumentStatus, RecipientRole, SigningStatus } from '@prisma/client';
import { useRevalidator } from 'react-router';

import { isDocumentBeingProcessed } from '@documenso/lib/utils/document';

type DocumentType = {
  id: number;
  status: DocumentStatus;
  deletedAt: Date | null;
  recipients: Array<{
    role: RecipientRole;
    signingStatus: SigningStatus;
  }>;
};

export type DocumentProcessingPollProps = {
  documents?: DocumentType[] | DocumentType;
};

export const DocumentProcessingPoll = ({ documents }: DocumentProcessingPollProps) => {
  const { revalidate } = useRevalidator();

  useEffect(() => {
    if (!documents) {
      return;
    }

    const documentArray = Array.isArray(documents) ? documents : [documents];

    if (documentArray.length === 0) {
      return;
    }

    const hasProcessingDocuments = documentArray.some((document) =>
      isDocumentBeingProcessed(document),
    );

    if (!hasProcessingDocuments) {
      return;
    }

    const interval = setInterval(() => {
      if (window.document.hasFocus()) {
        void revalidate();
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [documents, revalidate]);

  return null;
};
