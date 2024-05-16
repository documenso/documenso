type ColorVariant = {
  ring: string;
  border: string;
  borderWithHover: string;
  borderActive: string;
  background: string;
  initialsBackground: string;
};

type ColorVariantsMap = Record<string, ColorVariant>;

function createColorVariants(colorClasses: string[]): ColorVariantsMap {
  return colorClasses.reduce((variants, colorClass) => {
    variants[colorClass] = {
      ring: `ring-${colorClass}/30 ring-offset-${colorClass}`,
      border: `border-${colorClass}`,
      borderWithHover: `group-data-[selected]:border-${colorClass} hover:border-${colorClass}`,
      borderActive: `border-${colorClass} bg-${colorClass}/20`,
      background: `bg-${colorClass}/60 border-${colorClass}`,
      initialsBackground: `bg-${colorClass}`,
    };
    return variants;
  }, {} as ColorVariantsMap);
}

export const colorClasses = [
  'orange-500',
  'green-500',
  'cyan-500',
  'blue-500',
  'indigo-500',
  'purple-500',
  'pink-500',
];

export const colorVariants = createColorVariants(colorClasses);
