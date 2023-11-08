export type PeriodSelectorValue = '' | '7d' | '14d' | '30d';

export const isPeriodSelectorValue = (value: unknown): value is PeriodSelectorValue => {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  return ['', '7d', '14d', '30d'].includes(value as string);
};
