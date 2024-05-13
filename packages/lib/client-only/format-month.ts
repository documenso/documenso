export const formatMonth = (monthStr: string) => {
  const [year, month] = monthStr.split('-');
  const monthNames = [
    'იანვარი',
    'თებერვალი',
    'მარტი',
    'აპრილი',
    'მაისი',
    'ივნისი',
    'ივლისი',
    'აგვისტო',
    'სექტემბერი',
    'ოქტომბერი',
    'ნოემბერი',
    'დეკემბერი',
  ];
  return `${monthNames[parseInt(month, 10) - 1]} ${year}`;
};
