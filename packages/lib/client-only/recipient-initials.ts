export const initials = (text: string) =>
  text
    ?.split(' ')
    .map((name: string) => name.slice(0, 1).toUpperCase())
    .slice(0, 2)
    .join('') ?? 'UK';
