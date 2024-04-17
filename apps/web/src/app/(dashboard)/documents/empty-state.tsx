import { Bird, CheckCircle2 } from 'lucide-react';
import { match } from 'ts-pattern';

import { ExtendedDocumentStatus } from '@documenso/prisma/types/extended-document-status';

export type EmptyDocumentProps = { status: ExtendedDocumentStatus };

export const EmptyDocumentState = ({ status }: EmptyDocumentProps) => {
  const {
    title,
    message,
    icon: Icon,
  } = match(status)
    .with(ExtendedDocumentStatus.COMPLETED, () => ({
      title: 'Nothing to do',
      message:
        'There are no completed documents yet. Documents that you have created or received that become completed will appear here later.',
      icon: CheckCircle2,
    }))
    .with(ExtendedDocumentStatus.DRAFT, () => ({
      title: 'No active drafts',
      message:
        'There are no active drafts at then current moment. You can upload a document to start drafting.',
      icon: CheckCircle2,
    }))
    .with(ExtendedDocumentStatus.ALL, () => ({
      title: "We're all empty",
      message:
        'You have not yet created or received any documents. To create a document please upload one.',
      icon: Bird,
    }))
    .otherwise(() => ({
      title: 'Nothing to do',
      message:
        'All documents are currently actioned. Any new documents are sent or recieved they will start to appear here.',
      icon: CheckCircle2,
    }));

  return (
    <div className="text-muted-foreground/60 flex h-60 flex-col items-center justify-center gap-y-4">
      <Icon className="h-12 w-12" strokeWidth={1.5} />

      <div className="text-center">
        <h3 className="text-lg font-semibold">{title}</h3>

        <p className="mt-2 max-w-[60ch]">{message}</p>
      </div>
    </div>
  );
};
