// !: We declare all of our classes here since TailwindCSS will remove any unused CSS classes,
// !: therefore doing this at runtime is not possible without whitelisting a set of classnames.
// !:
// !: This will later be improved as we move to a CSS variable approach and rotate the lightness
// !: values of the declared variable to do all the background, border and shadow styles.
export const SIGNER_COLOR_STYLES = {
  green: {
    default: {
      background: 'bg-[hsl(var(--signer-green))]',
      base: 'rounded-lg shadow-[0_0_0_5px_hsl(var(--signer-green)/10%),0_0_0_2px_hsl(var(--signer-green)/60%),0_0_0_0.5px_hsl(var(--signer-green))]',
      fieldItem:
        'group/field-item p-2 border-none ring-none hover:bg-gradient-to-r hover:from-[hsl(var(--signer-green))]/10 hover:to-[hsl(var(--signer-green))]/10',
      fieldItemInitials:
        'opacity-0 transition duration-200 group-hover/field-item:opacity-100 group-hover/field-item:bg-[hsl(var(--signer-green))]',
      comboxBoxItem:
        'hover:bg-[hsl(var(--signer-green)/15%)] active:bg-[hsl(var(--signer-green)/15%)]',
    },
  },

  blue: {
    default: {
      background: 'bg-[hsl(var(--signer-blue))]',
      base: 'rounded-lg shadow-[0_0_0_5px_hsl(var(--signer-blue)/10%),0_0_0_2px_hsl(var(--signer-blue)/60%),0_0_0_0.5px_hsl(var(--signer-blue))]',
      fieldItem:
        'group/field-item p-2 border-none ring-none hover:bg-gradient-to-r hover:from-[hsl(var(--signer-blue))]/10 hover:to-[hsl(var(--signer-blue))]/10',
      fieldItemInitials:
        'opacity-0 transition duration-200 group-hover/field-item:opacity-100 group-hover/field-item:bg-[hsl(var(--signer-blue))]',
      comboxBoxItem:
        'hover:bg-[hsl(var(--signer-blue)/15%)] active:bg-[hsl(var(--signer-blue)/15%)]',
    },
  },

  purple: {
    default: {
      background: 'bg-[hsl(var(--signer-purple))]',
      base: 'rounded-lg shadow-[0_0_0_5px_hsl(var(--signer-purple)/10%),0_0_0_2px_hsl(var(--signer-purple)/60%),0_0_0_0.5px_hsl(var(--signer-purple))]',
      fieldItem:
        'group/field-item p-2 border-none ring-none hover:bg-gradient-to-r hover:from-[hsl(var(--signer-purple))]/10 hover:to-[hsl(var(--signer-purple))]/10',
      fieldItemInitials:
        'opacity-0 transition duration-200 group-hover/field-item:opacity-100 group-hover/field-item:bg-[hsl(var(--signer-purple))]',
      comboxBoxItem:
        'hover:bg-[hsl(var(--signer-purple)/15%)] active:bg-[hsl(var(--signer-purple)/15%)]',
    },
  },

  orange: {
    default: {
      background: 'bg-[hsl(var(--signer-orange))]',
      base: 'rounded-lg shadow-[0_0_0_5px_hsl(var(--signer-orange)/10%),0_0_0_2px_hsl(var(--signer-orange)/60%),0_0_0_0.5px_hsl(var(--signer-orange))]',
      fieldItem:
        'group/field-item p-2 border-none ring-none hover:bg-gradient-to-r hover:from-[hsl(var(--signer-orange))]/10 hover:to-[hsl(var(--signer-orange))]/10',
      fieldItemInitials:
        'opacity-0 transition duration-200 group-hover/field-item:opacity-100 group-hover/field-item:bg-[hsl(var(--signer-orange))]',
      comboxBoxItem:
        'hover:bg-[hsl(var(--signer-orange)/15%)] active:bg-[hsl(var(--signer-orange)/15%)]',
    },
  },

  yellow: {
    default: {
      background: 'bg-[hsl(var(--signer-yellow))]',
      base: 'rounded-lg shadow-[0_0_0_5px_hsl(var(--signer-yellow)/10%),0_0_0_2px_hsl(var(--signer-yellow)/60%),0_0_0_0.5px_hsl(var(--signer-yellow))]',
      fieldItem:
        'group/field-item p-2 border-none ring-none hover:bg-gradient-to-r hover:from-[hsl(var(--signer-yellow))]/10 hover:to-[hsl(var(--signer-yellow))]/10',
      fieldItemInitials:
        'opacity-0 transition duration-200 group-hover/field-item:opacity-100 group-hover/field-item:bg-[hsl(var(--signer-yellow))]',
      comboxBoxItem:
        'hover:bg-[hsl(var(--signer-yellow)/15%)] active:bg-[hsl(var(--signer-yellow)/15%)]',
    },
  },

  pink: {
    default: {
      background: 'bg-[hsl(var(--signer-pink))]',
      base: 'rounded-lg shadow-[0_0_0_5px_hsl(var(--signer-pink)/10%),0_0_0_2px_hsl(var(--signer-pink)/60%),0_0_0_0.5px_hsl(var(--signer-pink))]',
      fieldItem:
        'group/field-item p-2 border-none ring-none hover:bg-gradient-to-r hover:from-[hsl(var(--signer-pink))]/10 hover:to-[hsl(var(--signer-pink))]/10',
      fieldItemInitials:
        'opacity-0 transition duration-200 group-hover/field-item:opacity-100 group-hover/field-item:bg-[hsl(var(--signer-pink))]',
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
