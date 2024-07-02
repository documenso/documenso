import { useMemo } from 'react';

import type { Recipient } from '@documenso/prisma/client';

import type { CombinedStylesKey } from '../../../ui/primitives/document-flow/add-fields';
import { combinedStyles } from '../../../ui/primitives/document-flow/add-fields';

export const useSelectedSignerStyles = (
  selectedSigner: Recipient | null,
  recipientColorClasses: Map<Recipient['id'], CombinedStylesKey>,
) => {
  return useMemo(() => {
    if (!selectedSigner) return {};

    const colorClass = recipientColorClasses.get(selectedSigner.id);
    if (!colorClass) return {};

    const styles = combinedStyles[colorClass];

    return {
      ringClass: styles?.ringColor,
      borderClass: styles?.borderWithHover,
      activeBorderClass: styles?.borderActive,
      activeBorderWithinBoundsClass: styles?.borderActiveWithinBounds,
      activeBorderOutsideBoundsClass: styles?.borderActiveOutsideBounds,
    };
  }, [selectedSigner, recipientColorClasses]);
};
