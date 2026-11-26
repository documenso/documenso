import { useSearchParams } from 'react-router';

export const useUpdateSearchParams = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  return (params: Record<string, string | number | boolean | null | undefined>) => {
    // Shallow nuqs updates mutate history without notifying React Router, so read
    // the live query string instead of React Router's snapshot.
    const nextSearchParams = new URLSearchParams(
      typeof window !== 'undefined' ? window.location.search : (searchParams?.toString() ?? ''),
    );

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
