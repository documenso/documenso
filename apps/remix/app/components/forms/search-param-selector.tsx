import { Select, SelectContent, SelectTrigger, SelectValue } from '@documenso/ui/primitives/select';
import type React from 'react';
import { useMemo } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router';

export type SearchParamSelector = {
  paramKey: string;
  isValueValid: (value: unknown) => boolean;
  children: React.ReactNode;
};

export const SearchParamSelector = ({ children, paramKey, isValueValid }: SearchParamSelector) => {
  const { pathname } = useLocation();
  const [searchParams] = useSearchParams();

  const navigate = useNavigate();

  const value = useMemo(() => {
    const p = searchParams?.get(paramKey) ?? 'all';

    return isValueValid(p) ? p : 'all';
  }, [searchParams]);

  const onValueChange = (newValue: string) => {
    if (!pathname) {
      return;
    }

    const params = new URLSearchParams(searchParams?.toString());

    params.set(paramKey, newValue);

    if (newValue === '' || newValue === 'all') {
      params.delete(paramKey);
    }

    void navigate(`${pathname}?${params.toString()}`, { preventScrollReset: true });
  };

  return (
    <Select defaultValue={value} onValueChange={onValueChange}>
      <SelectTrigger className="max-w-[200px] text-muted-foreground">
        <SelectValue />
      </SelectTrigger>

      <SelectContent position="popper">{children}</SelectContent>
    </Select>
  );
};
