import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Bird, CheckCircle2 } from 'lucide-react';
import { match } from 'ts-pattern';

import { ExtendedDocumentStatus } from '@documenso/prisma/types/extended-document-status';

export type TemplateDocumentsTableEmptyStateProps = { status: ExtendedDocumentStatus };

export const TemplateDocumentsTableEmptyState = ({
  status,
}: TemplateDocumentsTableEmptyStateProps) => {
  const { _ } = useLingui();

  const {
    title,
    message,
    icon: Icon,
  } = match(status)
    .with(ExtendedDocumentStatus.COMPLETED, () => ({
      title: msg`No completed documents`,
      message: msg`No documents created from this template have been completed yet. Completed documents will appear here once all recipients have signed.`,
      icon: CheckCircle2,
    }))
    .with(ExtendedDocumentStatus.DRAFT, () => ({
      title: msg`No draft documents`,
      message: msg`There are no draft documents created from this template. Use this template to create a new document.`,
      icon: CheckCircle2,
    }))
    .with(ExtendedDocumentStatus.PENDING, () => ({
      title: msg`No pending documents`,
      message: msg`There are no pending documents created from this template. Documents awaiting signatures will appear here.`,
      icon: CheckCircle2,
    }))
    .with(ExtendedDocumentStatus.REJECTED, () => ({
      title: msg`No rejected documents`,
      message: msg`No documents created from this template have been rejected. Documents that have been declined will appear here.`,
      icon: CheckCircle2,
    }))
    .with(ExtendedDocumentStatus.INBOX, () => ({
      title: msg`No documents in inbox`,
      message: msg`There are no documents from this template waiting for your action. Documents requiring your signature will appear here.`,
      icon: CheckCircle2,
    }))
    .with(ExtendedDocumentStatus.ALL, () => ({
      title: msg`No documents yet`,
      message: msg`No documents have been created from this template yet. Use this template to create your first document.`,
      icon: Bird,
    }))
    .otherwise(() => ({
      title: msg`No documents found`,
      message: msg`No documents created from this template match the current filters. Try adjusting your search criteria.`,
      icon: CheckCircle2,
    }));

  return (
    <div
      className="text-muted-foreground/60 mt-12 flex h-60 flex-col items-center justify-center gap-y-4"
      data-testid="empty-template-document-state"
    >
      <Icon className="h-12 w-12" strokeWidth={1.5} />

      <div className="text-center">
        <h3 className="text-lg font-semibold">{_(title)}</h3>

        <p className="mt-2 max-w-[60ch]">{_(message)}</p>
      </div>
    </div>
  );
};
