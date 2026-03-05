import React from 'react';

import { Trans } from '@lingui/react/macro';

export const DocumentSendEmailMessageHelper = () => {
  return (
    <div>
      <p className="text-sm text-muted-foreground">
        <Trans>You can use the following variables in your message:</Trans>
      </p>

      <ul className="mt-2 flex list-inside list-disc flex-col gap-y-2 text-sm">
        <li className="text-muted-foreground">
          <code className="rounded bg-muted-foreground/20 p-1 text-sm text-muted-foreground">
            {'{signer.name}'}
          </code>{' '}
          - <Trans>The signer's name</Trans>
        </li>
        <li className="text-muted-foreground">
          <code className="rounded bg-muted-foreground/20 p-1 text-sm text-muted-foreground">
            {'{signer.email}'}
          </code>{' '}
          - <Trans>The signer's email</Trans>
        </li>
        <li className="text-muted-foreground">
          <code className="rounded bg-muted-foreground/20 p-1 text-sm text-muted-foreground">
            {'{document.name}'}
          </code>{' '}
          - <Trans>The document's name</Trans>
        </li>
      </ul>
    </div>
  );
};
