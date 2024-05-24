'use client';

import React from 'react';

import { Badge } from '@documenso/ui/primitives/badge';

export type DocumentHistorySheetChangesProps = {
  values: {
    key: string | React.ReactNode;
    value: string | React.ReactNode;
  }[];
};

export const DocumentHistorySheetChanges = ({ values }: DocumentHistorySheetChangesProps) => {
  return (
    <Badge
      className="text-muted-foreground mt-3 block w-full space-y-0.5 text-xs"
      variant="neutral"
    >
      {values.map(({ key, value }, i) => (
        <p key={typeof key === 'string' ? key : i}>
          <span>{key}: </span>
          <span className="font-normal">{value}</span>
        </p>
      ))}
    </Badge>
  );
};
