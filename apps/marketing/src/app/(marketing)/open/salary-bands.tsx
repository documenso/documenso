import { HTMLAttributes } from 'react';

import { cn } from '@documenso/ui/lib/utils';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@documenso/ui/primitives/table';

import { SALARY_BANDS } from '~/app/(marketing)/open/data';

export type SalaryBandsProps = HTMLAttributes<HTMLDivElement>;

export const SalaryBands = ({ className, ...props }: SalaryBandsProps) => {
  return (
    <div className={cn('flex flex-col', className)} {...props}>
      <h3 className="px-4 text-lg font-semibold">Global Salary Bands</h3>

      <div className="border-border mt-2.5 flex-1 rounded-2xl border shadow-sm hover:shadow">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[200px]">Title</TableHead>
              <TableHead>Seniority</TableHead>
              <TableHead className="w-[100px] text-right">Salary</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {SALARY_BANDS.map((band, index) => (
              <TableRow key={index}>
                <TableCell className="font-medium">{band.title}</TableCell>
                <TableCell>{band.seniority}</TableCell>
                <TableCell className="text-right">
                  {band.salary.toLocaleString('en-US', {
                    style: 'currency',
                    currency: 'USD',
                    maximumFractionDigits: 0,
                  })}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};
