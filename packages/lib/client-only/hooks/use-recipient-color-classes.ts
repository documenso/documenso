import { useMemo } from 'react';

import type { Recipient } from '@documenso/prisma/client';

import type { CombinedStylesKey } from '../../../ui/primitives/document-flow/add-fields';

export const useRecipientColorClasses = (
  recipients: Recipient[],
  colorClasses: CombinedStylesKey[],
) => {
  return useMemo(() => {
    const colorMap = new Map<Recipient['id'], CombinedStylesKey>();
    recipients.forEach((recipient, index) => {
      colorMap.set(recipient.id, colorClasses[index % colorClasses.length]);
    });
    return colorMap;
  }, [recipients, colorClasses]);
};
