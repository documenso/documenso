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

import { TEAM_MEMBERS } from './data';

export type TeamMembersProps = HTMLAttributes<HTMLDivElement>;

export const TeamMembers = ({ className, ...props }: TeamMembersProps) => {
  return (
    <div className={cn('flex flex-col', className)} {...props}>
      <h2 className="px-4 text-2xl font-semibold">Team</h2>

      <div className="border-border mt-2.5 flex-1 rounded-2xl border shadow-sm hover:shadow">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="">Name</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Salary</TableHead>
              <TableHead>Engagement</TableHead>
              <TableHead>Location</TableHead>
              <TableHead className="w-[100px] text-right">Join Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {TEAM_MEMBERS.map((member) => (
              <TableRow key={member.name}>
                <TableCell className="font-medium">{member.name}</TableCell>
                <TableCell>{member.role}</TableCell>

                <TableCell>
                  {member.salary.toLocaleString('en-US', {
                    style: 'currency',
                    currency: 'USD',
                    maximumFractionDigits: 0,
                  })}
                </TableCell>
                <TableCell>{member.engagement}</TableCell>
                <TableCell>{member.location}</TableCell>
                <TableCell className="text-right">{member.joinDate}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};
