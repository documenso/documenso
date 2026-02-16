import type { NavigateOptions } from 'react-router';
import { useSearchParams } from 'react-router';

type SearchParamValues = Record<string, string | number | boolean | null | undefined>;
type UpdateSearchParamsOptions = Pick<NavigateOptions, 'preventScrollReset' | 'replace' | 'state'>;

export const useUpdateSearchParams = (defaultOptions: UpdateSearchParamsOptions = {}) => {
  const [searchParams, setSearchParams] = useSearchParams();

  return (params: SearchParamValues, options?: UpdateSearchParamsOptions) => {
    const nextSearchParams = new URLSearchParams(searchParams?.toString() ?? '');

    Object.entries(params).forEach(([key, value]) => {
      if (value === undefined || value === null) {
        nextSearchParams.delete(key);
      } else {
        nextSearchParams.set(key, String(value));
      }
    });

    setSearchParams(nextSearchParams, {
      ...defaultOptions,
      ...options,
    });
  };
};
