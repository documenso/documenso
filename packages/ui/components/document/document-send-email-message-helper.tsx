'use client';

import React from 'react';

export const DocumentSendEmailMessageHelper = () => {
  return (
    <div>
      <p className="text-muted-foreground text-sm">
        You can use the following variables in your message:
      </p>

      <ul className="mt-2 flex list-inside list-disc flex-col gap-y-2 text-sm">
        <li className="text-muted-foreground">
          <code className="text-muted-foreground bg-muted-foreground/20 rounded p-1 text-sm">
            {'{signer.name}'}
          </code>{' '}
          - The signer's name
        </li>
        <li className="text-muted-foreground">
          <code className="text-muted-foreground bg-muted-foreground/20 rounded p-1 text-sm">
            {'{signer.email}'}
          </code>{' '}
          - The signer's email
        </li>
        <li className="text-muted-foreground">
          <code className="text-muted-foreground bg-muted-foreground/20 rounded p-1 text-sm">
            {'{document.name}'}
          </code>{' '}
          - The document's name
        </li>
      </ul>
    </div>
  );
};
