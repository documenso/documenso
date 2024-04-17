'use client';

import { useMemo } from 'react';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@documenso/ui/primitives/select';

import { isPeriodSelectorValue } from './types';

export const PeriodSelector = () => {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const router = useRouter();

  const period = useMemo(() => {
<<<<<<< HEAD
    const p = searchParams?.get('period') ?? '';

    return isPeriodSelectorValue(p) ? p : '';
=======
    const p = searchParams?.get('period') ?? 'all';

    return isPeriodSelectorValue(p) ? p : 'all';
>>>>>>> main
  }, [searchParams]);

  const onPeriodChange = (newPeriod: string) => {
    if (!pathname) {
      return;
    }

    const params = new URLSearchParams(searchParams?.toString());

    params.set('period', newPeriod);

<<<<<<< HEAD
    if (newPeriod === '') {
=======
    if (newPeriod === '' || newPeriod === 'all') {
>>>>>>> main
      params.delete('period');
    }

    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };

  return (
    <Select defaultValue={period} onValueChange={onPeriodChange}>
      <SelectTrigger className="text-muted-foreground max-w-[200px]">
        <SelectValue />
      </SelectTrigger>

      <SelectContent position="popper">
<<<<<<< HEAD
        <SelectItem value="">All Time</SelectItem>
=======
        <SelectItem value="all">All Time</SelectItem>
>>>>>>> main
        <SelectItem value="7d">Last 7 days</SelectItem>
        <SelectItem value="14d">Last 14 days</SelectItem>
        <SelectItem value="30d">Last 30 days</SelectItem>
      </SelectContent>
    </Select>
  );
};
