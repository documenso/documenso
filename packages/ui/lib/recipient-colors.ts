// !: We declare all of our classes here since TailwindCSS will remove any unused CSS classes,
// !: therefore doing this at runtime is not possible without whitelisting a set of classnames.
// !:
// !: This will later be improved as we move to a CSS variable approach and rotate the lightness

export type RecipientColorMap = Record<number, RecipientColorStyles>;

export type RecipientColorStyles = {
  base: string;
  baseRing: string;
  baseRingHover: string;
  baseTextHover: string;
  fieldButton: string;
  fieldItem: string;
  fieldItemInitials: string;
  comboxBoxTrigger: string;
  comboxBoxItem: string;
};

export const DEFAULT_RECT_BACKGROUND = 'rgba(255, 255, 255, 0.95)';

// !: values of the declared variable to do all the background, border and shadow styles.
export const RECIPIENT_COLOR_STYLES = {
  readOnly: {
    base: 'ring-neutral-400',
    baseRing: 'rgba(176, 176, 176, 1)',
    baseRingHover: 'rgba(176, 176, 176, 1)',
    baseTextHover: 'rgba(176, 176, 176, 1)',
    fieldButton: 'border-neutral-400 hover:border-neutral-400',
    fieldItem: 'group/field-item rounded-[2px]',
    fieldItemInitials: '',
    comboxBoxTrigger:
      'ring-2 ring-recipient-green shadow-[0_0_0_5px_hsl(var(--recipient-green)/10%),0_0_0_2px_hsl(var(--recipient-green)/60%),0_0_0_0.5px_hsl(var(--recipient-green))]',
    comboxBoxItem: '',
  },

  green: {
    base: 'ring-recipient-green hover:bg-recipient-green/30',
    baseRing: 'rgba(122, 195, 85, 1)',
    baseRingHover: 'rgba(122, 195, 85, 0.3)',
    baseTextHover: 'rgba(122, 195, 85, 1)',
    fieldButton: 'hover:border-recipient-green hover:bg-recipient-green/30 ',
    fieldItem: 'group/field-item rounded-[2px]',
    fieldItemInitials: 'group-hover/field-item:bg-recipient-green',
    comboxBoxTrigger:
      'ring-2 ring-recipient-green hover:bg-recipient-green/15 active:bg-recipient-green/15 shadow-[0_0_0_5px_hsl(var(--recipient-green)/10%),0_0_0_2px_hsl(var(--recipient-green)/60%),0_0_0_0.5px_hsl(var(--recipient-green))]',
    comboxBoxItem: 'hover:bg-recipient-green/15 active:bg-recipient-green/15',
  },

  blue: {
    base: 'ring-recipient-blue hover:bg-recipient-blue/30',
    baseRing: 'rgba(56, 123, 199, 1)',
    baseRingHover: 'rgba(56, 123, 199, 0.3)',
    baseTextHover: 'rgba(56, 123, 199, 1)',
    fieldButton: 'hover:border-recipient-blue hover:bg-recipient-blue/30',
    fieldItem: 'group/field-item rounded-[2px]',
    fieldItemInitials: 'group-hover/field-item:bg-recipient-blue',
    comboxBoxTrigger:
      'ring-2 ring-recipient-blue hover:bg-recipient-blue/15 active:bg-recipient-blue/15 shadow-[0_0_0_5px_hsl(var(--recipient-blue)/10%),0_0_0_2px_hsl(var(--recipient-blue)/60%),0_0_0_0.5px_hsl(var(--recipient-blue))]',
    comboxBoxItem: 'ring-recipient-blue hover:bg-recipient-blue/15 active:bg-recipient-blue/15',
  },

  purple: {
    base: 'ring-recipient-purple hover:bg-recipient-purple/30',
    baseRing: 'rgba(151, 71, 255, 1)',
    baseRingHover: 'rgba(151, 71, 255, 0.3)',
    baseTextHover: 'rgba(151, 71, 255, 1)',
    fieldButton: 'hover:border-recipient-purple hover:bg-recipient-purple/30',
    fieldItem: 'group/field-item rounded-[2px]',
    fieldItemInitials: 'group-hover/field-item:bg-recipient-purple',
    comboxBoxTrigger:
      'ring-2 ring-recipient-purple hover:bg-recipient-purple/15 active:bg-recipient-purple/15 shadow-[0_0_0_5px_hsl(var(--recipient-purple)/10%),0_0_0_2px_hsl(var(--recipient-purple)/60%),0_0_0_0.5px_hsl(var(--recipient-purple))]',
    comboxBoxItem: 'hover:bg-recipient-purple/15 active:bg-recipient-purple/15',
  },

  orange: {
    base: 'ring-recipient-orange hover:bg-recipient-orange/30',
    baseRing: 'rgba(246, 159, 30, 1)',
    baseRingHover: 'rgba(246, 159, 30, 0.3)',
    baseTextHover: 'rgba(246, 159, 30, 1)',
    fieldButton: 'hover:border-recipient-orange hover:bg-recipient-orange/30',
    fieldItem: 'group/field-item rounded-[2px]',
    fieldItemInitials: 'group-hover/field-item:bg-recipient-orange',
    comboxBoxTrigger:
      'ring-2 ring-recipient-orange hover:bg-recipient-orange/15 active:bg-recipient-orange/15 shadow-[0_0_0_5px_hsl(var(--recipient-orange)/10%),0_0_0_2px_hsl(var(--recipient-orange)/60%),0_0_0_0.5px_hsl(var(--recipient-orange))]',
    comboxBoxItem: 'hover:bg-recipient-orange/15 active:bg-recipient-orange/15',
  },

  yellow: {
    base: 'ring-recipient-yellow hover:bg-recipient-yellow/30',
    baseRing: 'rgba(219, 186, 0, 1)',
    baseRingHover: 'rgba(219, 186, 0, 0.3)',
    baseTextHover: 'rgba(219, 186, 0, 1)',
    fieldButton: 'hover:border-recipient-yellow hover:bg-recipient-yellow/30',
    fieldItem: 'group/field-item rounded-[2px]',
    fieldItemInitials: 'group-hover/field-item:bg-recipient-yellow',
    comboxBoxTrigger:
      'ring-2 ring-recipient-yellow hover:bg-recipient-yellow/15 active:bg-recipient-yellow/15 shadow-[0_0_0_5px_hsl(var(--recipient-yellow)/10%),0_0_0_2px_hsl(var(--recipient-yellow)/60%),0_0_0_0.5px_hsl(var(--recipient-yellow))]',
    comboxBoxItem: 'hover:bg-recipient-yellow/15 active:bg-recipient-yellow/15',
  },

  pink: {
    base: 'ring-recipient-pink hover:bg-recipient-pink/30',
    baseRing: 'rgba(217, 74, 186, 1)',
    baseRingHover: 'rgba(217, 74, 186, 0.3)',
    baseTextHover: 'rgba(217, 74, 186, 1)',
    fieldButton: 'hover:border-recipient-pink hover:bg-recipient-pink/30',
    fieldItem: 'group/field-item rounded-[2px]',
    fieldItemInitials: 'group-hover/field-item:bg-recipient-pink',
    comboxBoxTrigger:
      'ring-2 ring-recipient-pink hover:bg-recipient-pink/15 active:bg-recipient-pink/15 shadow-[0_0_0_5px_hsl(var(--recipient-pink)/10%),0_0_0_2px_hsl(var(--recipient-pink)/60%),0_0_0_0.5px_hsl(var(--recipient-pink',
    comboxBoxItem: 'hover:bg-recipient-pink/15 active:bg-recipient-pink/15',
  },
} satisfies Record<string, RecipientColorStyles>;

export type TRecipientColor = keyof typeof RECIPIENT_COLOR_STYLES;

export const AVAILABLE_RECIPIENT_COLORS = [
  'green',
  'blue',
  'purple',
  'orange',
  'yellow',
  'pink',
] satisfies TRecipientColor[];

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
