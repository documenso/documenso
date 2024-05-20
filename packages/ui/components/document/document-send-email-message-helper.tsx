'use client';

import React from 'react';

export const DocumentSendEmailMessageHelper = () => {
  return (
    <div>
      <p className="text-muted-foreground text-sm">
        თქვენს შეტყობინებაში შეგიძლიათ შემდეგი ცვლადები გამოიყენოთ:
      </p>

      <ul className="mt-2 flex list-inside list-disc flex-col gap-y-2 text-sm">
        <li className="text-muted-foreground">
          <code className="text-muted-foreground bg-muted-foreground/20 rounded p-1 text-sm">
            {'{signer.name}'}
          </code>{' '}
          - ხელმომწერის სახელი
        </li>
        <li className="text-muted-foreground">
          <code className="text-muted-foreground bg-muted-foreground/20 rounded p-1 text-sm">
            {'{signer.email}'}
          </code>{' '}
          - ხელმომწერის ელ.ფოსტა
        </li>
        <li className="text-muted-foreground">
          <code className="text-muted-foreground bg-muted-foreground/20 rounded p-1 text-sm">
            {'{document.name}'}
          </code>{' '}
          - დოკუმენტის სახელი
        </li>
      </ul>
    </div>
  );
};
