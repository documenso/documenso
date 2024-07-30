import { useMemo } from 'react';

import type { CombinedStylesKey } from '../../../ui/primitives/document-flow/add-fields';
import { combinedStyles } from '../../../ui/primitives/document-flow/field-item';

const defaultFieldItemStyles = {
  borderClass: 'border-field-card-border',
  activeBorderClass: 'border-field-card-border/80',
  initialsBGClass: 'text-field-card-foreground/50 bg-slate-900/10',
  fieldBackground: 'bg-field-card-background',
};

export const useFieldItemStyles = (color: CombinedStylesKey | null) => {
  return useMemo(() => {
    if (!color) return defaultFieldItemStyles;

    const selectedColorVariant = combinedStyles[color];
    return {
      activeBorderClass: selectedColorVariant?.borderActive,
      borderClass: selectedColorVariant?.border,
      initialsBGClass: selectedColorVariant?.initialsBG,
      fieldBackground: selectedColorVariant?.fieldBackground,
    };
  }, [color]);
};
