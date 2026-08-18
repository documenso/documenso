import { useSearchParams } from 'react-router';

export const useUpdateSearchParams = () => {
  const [, setSearchParams] = useSearchParams();

  return (params: Record<string, string | number | boolean | null | undefined>) => {
    // Rebuild from the live URL, not the router's snapshot: nuqs shallow
    // updates write with pushState and never notify React Router (no popstate
    // fires), so useSearchParams can lag behind filters written moments
    // earlier -- paginating from that snapshot silently dropped every active
    // filter (#3196). window.location reflects both nuqs and router writes.
    const nextSearchParams = new URLSearchParams(window.location.search);

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
