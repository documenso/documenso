export const formatMonth = (monthStr: string) => {
  const [year, month] = monthStr.split('-');
  const monthNames = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];
  return `${monthNames[parseInt(month, 10) - 1]} ${year}`;
};
