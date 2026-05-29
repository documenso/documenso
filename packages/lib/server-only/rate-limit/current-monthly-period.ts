/** Current UTC calendar month as `YYYY-MM`. */
export const currentMonthlyPeriod = (): string => {
  const now = new Date();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');

  return `${now.getUTCFullYear()}-${month}`;
};
