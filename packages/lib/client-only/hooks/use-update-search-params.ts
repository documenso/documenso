import { useCallback, useRef } from 'react';

import type { NavigateOptions } from 'react-router';
import { useSearchParams } from 'react-router';

type SearchParamValues = Record<string, string | number | boolean | null | undefined>;
type UpdateSearchParamsOptions = Pick<NavigateOptions, 'preventScrollReset' | 'replace' | 'state'>;

export const useUpdateSearchParams = (defaultOptions: UpdateSearchParamsOptions = {}) => {
  const [searchParams, setSearchParams] = useSearchParams();

  const searchParamsRef = useRef(searchParams);
  searchParamsRef.current = searchParams;

  const defaultOptionsRef = useRef(defaultOptions);
  defaultOptionsRef.current = defaultOptions;

  return useCallback(
    (params: SearchParamValues, options?: UpdateSearchParamsOptions) => {
      const nextSearchParams = new URLSearchParams(searchParamsRef.current?.toString() ?? '');

      Object.entries(params).forEach(([key, value]) => {
        if (value === undefined || value === null) {
          nextSearchParams.delete(key);
        } else {
          nextSearchParams.set(key, String(value));
        }
      });

      setSearchParams(nextSearchParams, {
        ...defaultOptionsRef.current,
        ...options,
      });
    },
    [setSearchParams],
  );
};
