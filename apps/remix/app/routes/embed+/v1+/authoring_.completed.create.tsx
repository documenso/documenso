import { Trans } from '@lingui/react/macro';
import { CheckCircle2 } from 'lucide-react';
import { useEffect } from 'react';
import { useSearchParams } from 'react-router';

export default function EmbeddingAuthoringCompletedPage() {
  const [searchParams] = useSearchParams();

  // Get templateId and externalId from URL search params
  const templateId = searchParams.get('templateId');
  const documentId = searchParams.get('documentId');
  const externalId = searchParams.get('externalId');

  const id = Number(templateId || documentId);
  const type = templateId ? 'template' : 'document';

  // Send postMessage to parent window with the details
  useEffect(() => {
    if (!id || !window.parent || window.parent === window) {
      return;
    }

    window.parent.postMessage(
      {
        type: `${type}-created`,
        [`${type}Id`]: id,
        externalId,
      },
      '*',
    );
  }, [id, type, externalId]);

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center p-6 text-center">
      <div className="mx-auto w-full max-w-md">
        <CheckCircle2 className="mx-auto h-16 w-16 text-primary" />

        <h1 className="mt-6 font-bold text-2xl">
          {type === 'template' ? <Trans>Template Created</Trans> : <Trans>Document Created</Trans>}
        </h1>

        <p className="mt-2 text-muted-foreground">
          {type === 'template' ? (
            <Trans>Your template has been created successfully</Trans>
          ) : (
            <Trans>Your document has been created successfully</Trans>
          )}
        </p>
      </div>
    </div>
  );
}
