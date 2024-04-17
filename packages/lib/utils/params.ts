/**
 * From an unknown string, parse it into an integer array.
 *
 * Filter out unknown values.
 */
export const parseToIntegerArray = (value: unknown): number[] => {
  if (typeof value !== 'string') {
    return [];
  }

  return value
    .split(',')
    .map((value) => parseInt(value, 10))
    .filter((value) => !isNaN(value));
};

type GetRootHrefOptions = {
  returnEmptyRootString?: boolean;
};

export const getRootHref = (
  params: Record<string, string | string[]> | null,
  options: GetRootHrefOptions = {},
) => {
  if (typeof params?.teamUrl === 'string') {
    return `/t/${params.teamUrl}`;
  }

  return options.returnEmptyRootString ? '' : '/';
};
