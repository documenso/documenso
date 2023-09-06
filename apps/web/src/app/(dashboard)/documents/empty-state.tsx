import { ArrowRight, CheckCircle2 } from 'lucide-react';

export default function EmptyDocumentState({ status }: { status: string }) {
  let headerText = 'All done';
  let bodyText = 'All documents signed for now.';
  let extraText = '';
  let showArrow = false;

  switch (status) {
    case 'COMPLETED':
      headerText = 'Nothing here';
      bodyText = 'There are no signed documents yet.';
      extraText = 'Start by adding a document';
      showArrow = true;
      break;
    case 'DRAFT':
      headerText = 'Nothing here';
      bodyText = 'There are no drafts yet.';
      extraText = 'Start by adding a document';
      showArrow = true;
      break;
    case 'ALL':
      headerText = 'Nothing here';
      bodyText = 'There are no documents yet.';
      extraText = 'Start by adding a document';
      showArrow = true;
      break;
    default:
      break;
  }

  return (
    <div className="text-muted-foreground/50 flex h-96 flex-col items-center justify-center space-y-3">
      <CheckCircle2 className="text-muted-foreground/50 h-14 w-14" />
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
