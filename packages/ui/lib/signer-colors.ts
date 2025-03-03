// !: We declare all of our classes here since TailwindCSS will remove any unused CSS classes,
// !: therefore doing this at runtime is not possible without whitelisting a set of classnames.
// !:
// !: This will later be improved as we move to a CSS variable approach and rotate the lightness

// !: values of the declared variable to do all the background, border and shadow styles.
export const SIGNER_COLOR_STYLES = {
  green: {
    default: {
      base: 'ring-signer-green hover:bg-signer-green/30',
      fieldItem: 'group/field-item rounded-sm',
      fieldItemInitials: 'group-hover/field-item:bg-[hsl(var(--signer-green))]',
      comboxBoxItem:
        'hover:bg-[hsl(var(--signer-green)/15%)] active:bg-[hsl(var(--signer-green)/15%)]',
    },
  },

  blue: {
    default: {
      base: 'ring-signer-blue hover:bg-signer-blue/30',
      fieldItem: 'group/field-item rounded-sm',
      fieldItemInitials: 'group-hover/field-item:bg-[hsl(var(--signer-blue))]',
      comboxBoxItem:
        'hover:bg-[hsl(var(--signer-blue)/15%)] active:bg-[hsl(var(--signer-blue)/15%)]',
    },
  },

  purple: {
    default: {
      base: 'ring-signer-purple hover:bg-signer-purple/30',
      fieldItem: 'group/field-item rounded-sm',
      fieldItemInitials: 'group-hover/field-item:bg-[hsl(var(--signer-purple))]',
      comboxBoxItem:
        'hover:bg-[hsl(var(--signer-purple)/15%)] active:bg-[hsl(var(--signer-purple)/15%)]',
    },
  },

  orange: {
    default: {
      base: 'ring-signer-orange hover:bg-signer-orange/30',
      fieldItem: 'group/field-item rounded-sm',
      fieldItemInitials: 'group-hover/field-item:bg-[hsl(var(--signer-orange))]',
      comboxBoxItem:
        'hover:bg-[hsl(var(--signer-orange)/15%)] active:bg-[hsl(var(--signer-orange)/15%)]',
    },
  },

  yellow: {
    default: {
      base: 'ring-signer-yellow hover:bg-signer-yellow/30',
      fieldItem: 'group/field-item rounded-sm',
      fieldItemInitials: 'group-hover/field-item:bg-[hsl(var(--signer-yellow))]',
      comboxBoxItem:
        'hover:bg-[hsl(var(--signer-yellow)/15%)] active:bg-[hsl(var(--signer-yellow)/15%)]',
    },
  },

  pink: {
    default: {
      base: 'ring-signer-pink hover:bg-signer-pink/30',
      fieldItem: 'group/field-item rounded-sm',
      fieldItemInitials: 'group-hover/field-item:bg-[hsl(var(--signer-pink))]',
      comboxBoxItem:
        'hover:bg-[hsl(var(--signer-pink)/15%)] active:bg-[hsl(var(--signer-pink)/15%)]',
    },
  },
};

export type CombinedStylesKey = keyof typeof SIGNER_COLOR_STYLES;

export const AVAILABLE_SIGNER_COLORS = [
  'green',
  'blue',
  'purple',
  'orange',
  'yellow',
  'pink',
] satisfies CombinedStylesKey[];

export const useSignerColors = (index: number) => {
  const key = AVAILABLE_SIGNER_COLORS[index % AVAILABLE_SIGNER_COLORS.length];

  return SIGNER_COLOR_STYLES[key];
};

export const getSignerColorStyles = (index: number) => {
  // Disabling the rule since the hook doesn't do anything special and can
  // be used universally.
  // eslint-disable-next-line react-hooks/rules-of-hooks
  return useSignerColors(index);
};
