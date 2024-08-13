import { Trans } from '@lingui/macro';
import { Bird } from 'lucide-react';

export const EmptyTemplateState = () => {
  return (
    <div className="text-muted-foreground/60 flex h-96 flex-col items-center justify-center gap-y-4">
      <Bird className="h-12 w-12" strokeWidth={1.5} />

      <div className="text-center">
        <h3 className="text-lg font-semibold">
          <Trans>We're all empty</Trans>
        </h3>

        <p className="mt-2 max-w-[50ch]">
          <Trans>
            You have not yet created any templates. To create a template please upload one.
          </Trans>
        </p>
      </div>
    </div>
  );
};
