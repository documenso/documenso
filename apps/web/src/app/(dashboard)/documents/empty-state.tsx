import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { match } from 'ts-pattern';

import { ExtendedDocumentStatus } from '@documenso/prisma/types/extended-document-status';

export type EmptyDocumentProps = { status: ExtendedDocumentStatus };

export default function EmptyDocumentState({ status }: EmptyDocumentProps) {
  const { headerText, bodyText, extraText, showArrow } = match(status)
    .with(ExtendedDocumentStatus.COMPLETED, () => ({
      headerText: 'Nothing here',
      bodyText: 'There are no signed documents yet.',
      extraText: 'Start by adding a document',
      showArrow: true,
    }))
    .with(ExtendedDocumentStatus.DRAFT, () => ({
      headerText: 'Nothing here',
      bodyText: 'There are no drafts yet.',
      extraText: 'Start by adding a document',
      showArrow: true,
    }))
    .with(ExtendedDocumentStatus.ALL, () => ({
      headerText: 'Nothing here',
      bodyText: 'There are no documents yet.',
      extraText: 'Start by adding a document',
      showArrow: true,
    }))
    .otherwise(() => ({
      headerText: 'All done',
      bodyText: 'All documents signed for now.',
      extraText: '',
      showArrow: false,
    }));

  return (
    <div className="text-muted-foreground/50 flex h-96 flex-col items-center justify-center space-y-3">
      <CheckCircle2 className="text-muted-foreground/50 h-12 w-12" strokeWidth={1.5} />
      <div className="text-center">
        <h3 className="text-lg font-semibold">{headerText}</h3>
        <p>{bodyText}</p>
        {extraText && (
          <p>
            {extraText} {showArrow && <ArrowRight className="inline h-4 w-4" />}
          </p>
        )}
      </div>
    </div>
  );
}
