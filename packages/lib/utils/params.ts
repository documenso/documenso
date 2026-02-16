export const parseToIntegerArray = (value: unknown): number[] => {
  if (typeof value !== 'string') {
    return [];
  }

  return value
    .split(',')
    .map((value) => parseInt(value, 10))
    .filter((value) => !isNaN(value));
};

export const parseToStringArray = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === 'string');
  }

  if (typeof value !== 'string') {
    return [];
  }

  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
};

export const parseCommaSeparatedValues = (value: unknown): string[] | undefined => {
  const parsed = parseToStringArray(value);
  return parsed.length > 0 ? parsed : undefined;
};

export const toCommaSeparatedSearchParam = (values: string[]): string | undefined => {
  return values.length > 0 ? values.join(',') : undefined;
};

type GetRootHrefOptions = {
  returnEmptyRootString?: boolean;
};

export const getRootHref = (
  params: Record<string, string | string[] | undefined> | null,
  options: GetRootHrefOptions = {},
) => {
  if (typeof params?.teamUrl === 'string') {
    return `/t/${params.teamUrl}`;
  }

  return options.returnEmptyRootString ? '' : '/';
};
