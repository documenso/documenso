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
