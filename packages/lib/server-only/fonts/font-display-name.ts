export const resolveFontDisplayName = ({
  displayName,
  parsedName,
}: {
  displayName?: string | null;
  parsedName: string;
}) => {
  const trimmedDisplayName = displayName?.trim();

  return trimmedDisplayName || parsedName;
};
