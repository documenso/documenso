import { useSearchParams } from 'react-router';

export const useUpdateSearchParams = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  return (params: Record<string, string | number | boolean | null | undefined>) => {
    const nextSearchParams = new URLSearchParams(searchParams?.toString() ?? '');

    Object.entries(params).forEach(([key, value]) => {
      if (value === undefined || value === null) {
        nextSearchParams.delete(key);
      } else {
        nextSearchParams.set(key, String(value));
      }
    });

    setSearchParams(nextSearchParams);
  };
};
