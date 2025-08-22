export function formatFolderCount(count: number, singular: string, plural?: string): string {
  const itemLabel = count === 1 ? singular : plural || `${singular}s`;

  return `${count} ${itemLabel}`;
}
