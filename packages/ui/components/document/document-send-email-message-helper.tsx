import React from 'react';

import { Trans } from '@lingui/react/macro';

export const DocumentSendEmailMessageHelper = () => {
  return (
    <div>
      <p className="text-muted-foreground text-sm">
        <Trans>You can use the following variables in your message:</Trans>
      </p>

      <ul className="mt-2 flex list-inside list-disc flex-col gap-y-2 text-sm">
        <li className="text-muted-foreground">
          <code className="text-muted-foreground bg-muted-foreground/20 rounded p-1 text-sm">
            {'{signer.name}'}
          </code>{' '}
          - <Trans>The signer's name</Trans>
        </li>
        <li className="text-muted-foreground">
          <code className="text-muted-foreground bg-muted-foreground/20 rounded p-1 text-sm">
            {'{signer.email}'}
          </code>{' '}
          - <Trans>The signer's email</Trans>
        </li>
        <li className="text-muted-foreground">
          <code className="text-muted-foreground bg-muted-foreground/20 rounded p-1 text-sm">
            {'{document.name}'}
          </code>{' '}
          - <Trans>The document's name</Trans>
        </li>
      </ul>
    </div>
  );
};
