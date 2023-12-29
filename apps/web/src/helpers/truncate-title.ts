export const truncateTitle = (title: string, maxLength: number = 16) => {
  if (title.length <= maxLength) {
    return title;
  }

  const start = title.slice(0, maxLength / 2);
  const end = title.slice(-maxLength / 2);

  return `${start}.....${end}`;
};
