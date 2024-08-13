'use client';

import { useEffect } from 'react';

import { useRouter } from 'next/navigation';

import type { Document } from '@documenso/prisma/client';
import { DocumentStatus } from '@documenso/prisma/client';

export type PollUntilDocumentCompletedProps = {
  document: Pick<Document, 'id' | 'status' | 'deletedAt'>;
};

export const PollUntilDocumentCompleted = ({ document }: PollUntilDocumentCompletedProps) => {
  const router = useRouter();

  useEffect(() => {
    if (document.status === DocumentStatus.COMPLETED) {
      return;
    }

    const interval = setInterval(() => {
      if (window.document.hasFocus()) {
        router.refresh();
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [router, document.status]);

  return <></>;
};
