// !: We declare all of our classes here since TailwindCSS will remove any unused CSS classes,
// !: therefore doing this at runtime is not possible without whitelisting a set of classnames.
// !:
// !: This will later be improved as we move to a CSS variable approach and rotate the lightness

export type RecipientColorMap = Record<number, RecipientColorStyles>;

export type RecipientColorStyles = {
  base: string;
  fieldItem: string;
  fieldItemInitials: string;
  comboxBoxTrigger: string;
  comboxBoxItem: string;
};

// !: values of the declared variable to do all the background, border and shadow styles.
export const RECIPIENT_COLOR_STYLES = {
  green: {
    base: 'ring-recipient-green hover:bg-recipient-green/30',
    fieldItem: 'group/field-item rounded-[2px]',
    fieldItemInitials: 'group-hover/field-item:bg-recipient-green',
    comboxBoxTrigger:
      'ring-2 ring-recipient-green hover:bg-recipient-green/15 active:bg-recipient-green/15 shadow-[0_0_0_5px_hsl(var(--recipient-green)/10%),0_0_0_2px_hsl(var(--recipient-green)/60%),0_0_0_0.5px_hsl(var(--recipient-green))]',
    comboxBoxItem: 'hover:bg-recipient-green/15 active:bg-recipient-green/15',
  },

  blue: {
    base: 'ring-recipient-blue hover:bg-recipient-blue/30',
    fieldItem: 'group/field-item rounded-[2px]',
    fieldItemInitials: 'group-hover/field-item:bg-recipient-blue',
    comboxBoxTrigger:
      'ring-2 ring-recipient-blue hover:bg-recipient-blue/15 active:bg-recipient-blue/15 shadow-[0_0_0_5px_hsl(var(--recipient-blue)/10%),0_0_0_2px_hsl(var(--recipient-blue)/60%),0_0_0_0.5px_hsl(var(--recipient-blue))]',
    comboxBoxItem: 'ring-recipient-blue hover:bg-recipient-blue/15 active:bg-recipient-blue/15',
  },

  purple: {
    base: 'ring-recipient-purple hover:bg-recipient-purple/30',
    fieldItem: 'group/field-item rounded-[2px]',
    fieldItemInitials: 'group-hover/field-item:bg-recipient-purple',
    comboxBoxTrigger:
      'ring-2 ring-recipient-purple hover:bg-recipient-purple/15 active:bg-recipient-purple/15 shadow-[0_0_0_5px_hsl(var(--recipient-purple)/10%),0_0_0_2px_hsl(var(--recipient-purple)/60%),0_0_0_0.5px_hsl(var(--recipient-purple))]',
    comboxBoxItem: 'hover:bg-recipient-purple/15 active:bg-recipient-purple/15',
  },

  orange: {
    base: 'ring-recipient-orange hover:bg-recipient-orange/30',
    fieldItem: 'group/field-item rounded-[2px]',
    fieldItemInitials: 'group-hover/field-item:bg-recipient-orange',
    comboxBoxTrigger:
      'ring-2 ring-recipient-orange hover:bg-recipient-orange/15 active:bg-recipient-orange/15 shadow-[0_0_0_5px_hsl(var(--recipient-orange)/10%),0_0_0_2px_hsl(var(--recipient-orange)/60%),0_0_0_0.5px_hsl(var(--recipient-orange))]',
    comboxBoxItem: 'hover:bg-recipient-orange/15 active:bg-recipient-orange/15',
  },

  yellow: {
    base: 'ring-recipient-yellow hover:bg-recipient-yellow/30',
    fieldItem: 'group/field-item rounded-[2px]',
    fieldItemInitials: 'group-hover/field-item:bg-recipient-yellow',
    comboxBoxTrigger:
      'ring-2 ring-recipient-yellow hover:bg-recipient-yellow/15 active:bg-recipient-yellow/15 shadow-[0_0_0_5px_hsl(var(--recipient-yellow)/10%),0_0_0_2px_hsl(var(--recipient-yellow)/60%),0_0_0_0.5px_hsl(var(--recipient-yellow))]',
    comboxBoxItem: 'hover:bg-recipient-yellow/15 active:bg-recipient-yellow/15',
  },

  pink: {
    base: 'ring-recipient-pink hover:bg-recipient-pink/30',
    fieldItem: 'group/field-item rounded-[2px]',
    fieldItemInitials: 'group-hover/field-item:bg-recipient-pink',
    comboxBoxTrigger:
      'ring-2 ring-recipient-pink hover:bg-recipient-pink/15 active:bg-recipient-pink/15 shadow-[0_0_0_5px_hsl(var(--recipient-pink)/10%),0_0_0_2px_hsl(var(--recipient-pink)/60%),0_0_0_0.5px_hsl(var(--recipient-pink',
    comboxBoxItem: 'hover:bg-recipient-pink/15 active:bg-recipient-pink/15',
  },
} satisfies Record<string, RecipientColorStyles>;

export type CombinedStylesKey = keyof typeof RECIPIENT_COLOR_STYLES;

export const AVAILABLE_RECIPIENT_COLORS = [
  'green',
  'blue',
  'purple',
  'orange',
  'yellow',
  'pink',
] satisfies CombinedStylesKey[];

export const useRecipientColors = (index: number) => {
  const key = AVAILABLE_RECIPIENT_COLORS[index % AVAILABLE_RECIPIENT_COLORS.length];

  return RECIPIENT_COLOR_STYLES[key];
};

export const getRecipientColorStyles = (index: number) => {
  // Disabling the rule since the hook doesn't do anything special and can
  // be used universally.
  // eslint-disable-next-line react-hooks/rules-of-hooks
  return useRecipientColors(index);
};
