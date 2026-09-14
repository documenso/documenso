export function megabytesToBytes(megabytes: number) {
  return megabytes * 1000000;
}

/**
 * Format a byte count for display, e.g. `1.5 KB`.
 */
export const formatFileSize = (bytes: number) => {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};
