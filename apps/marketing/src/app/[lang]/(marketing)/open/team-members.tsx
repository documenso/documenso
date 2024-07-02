import type { HTMLAttributes } from 'react';

import type { getDictionary } from 'get-dictionary';

import type { stringLocales } from '@documenso/lib/internationalization/i18n-config';
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

export type TeamMembersProps = HTMLAttributes<HTMLDivElement> & {
  dictionary: {
    open_startup: Awaited<ReturnType<typeof getDictionary>>['open_startup'];
    team_members: Awaited<ReturnType<typeof getDictionary>>['team_members'];
    stringLocale: stringLocales;
  };
};

export const TeamMembers = ({ className, ...props }: TeamMembersProps) => {
  const team_members = TEAM_MEMBERS(props.dictionary.team_members, props.dictionary.stringLocale);
  return (
    <div className={cn('flex flex-col', className)} {...props}>
      <h2 className="px-4 text-2xl font-semibold">{props.dictionary.open_startup.team}</h2>

      <div className="border-border mt-2.5 flex-1 rounded-2xl border shadow-sm hover:shadow">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="">{props.dictionary.open_startup.name}</TableHead>
              <TableHead>{props.dictionary.open_startup.role}</TableHead>
              <TableHead>{props.dictionary.open_startup.salary}</TableHead>
              <TableHead>{props.dictionary.open_startup.engagement}</TableHead>
              <TableHead>{props.dictionary.open_startup.location}</TableHead>
              <TableHead className="w-[100px] text-right">
                {props.dictionary.open_startup.join_date}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {team_members.map((member) => (
              <TableRow key={member.name}>
                <TableCell className="font-medium">{member.name}</TableCell>
                <TableCell>{member.role}</TableCell>

                <TableCell>{member.salary}</TableCell>
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
