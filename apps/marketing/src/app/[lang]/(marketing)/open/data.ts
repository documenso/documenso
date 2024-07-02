import { currencyFormatter, dateFormatter } from '@documenso/lib/internationalization';
import type { stringLocales } from '@documenso/lib/internationalization/i18n-config';

import type { Dictionary } from '~/providers/dictionary-provider';

export const TEAM_MEMBERS = (
  dictionary: Dictionary['team_members'],
  stringLocale: stringLocales,
) => {
  const data = [
    {
      name: dictionary.timur_ercan,
      role: dictionary.ceo,
      salary: 95_000,
      location: dictionary.germany,
      engagement: dictionary.full_time,
      joinDate: '11/14/2022',
    },
    {
      name: dictionary.lucas_smith,
      role: dictionary.cto,
      salary: 95_000,
      location: dictionary.australia,
      engagement: dictionary.full_time,
      joinDate: '04/19/2023',
    },
    {
      name: dictionary.ephraim_atta_duncan,
      role: dictionary.software_engineer_intern,
      salary: 15_000,
      location: dictionary.ghana,
      engagement: dictionary.part_time,
      joinDate: '06/06/2023',
    },
    {
      name: dictionary.david_nguyen,
      role: dictionary.software_engineer_iii,
      salary: 100_000,
      location: dictionary.australia,
      engagement: dictionary.full_time,
      joinDate: '07/26/2023',
    },
    {
      name: dictionary.catalin_marinel_pit,
      role: dictionary.software_engineer_ii,
      salary: 80_000,
      location: dictionary.romania,
      engagement: dictionary.full_time,
      joinDate: '09/04/2023',
    },
    {
      name: dictionary.gowdhama_rajan_b,
      role: dictionary.designer_iii,
      salary: 100_000,
      location: dictionary.india,
      engagement: dictionary.full_time,
      joinDate: '10/09/2023',
    },
  ];
  const team_members = data.map((team_member) => {
    const date = new Date(team_member.joinDate);
    const joinDate = dateFormatter(stringLocale, date);
    const salary = currencyFormatter(stringLocale, team_member.salary);
    return {
      ...team_member,
      joinDate,
      salary,
    };
  });
  return team_members;
};

export const FUNDING_RAISED = [
  {
    date: '2023-04',
    amount: 0,
  },
  {
    date: '2023-05',
    amount: 290_000,
  },
  {
    date: '2023-07',
    amount: 1_540_000,
  },
];

export const SALARY_BANDS = [
  {
    title: 'Software Engineer - Intern',
    seniority: 'Intern',
    salary: 30_000,
  },
  {
    title: 'Software Engineer - I',
    seniority: 'Junior',
    salary: 60_000,
  },
  {
    title: 'Software Engineer - II',
    seniority: 'Mid',
    salary: 80_000,
  },
  {
    title: 'Software Engineer - III',
    seniority: 'Senior',
    salary: 100_000,
  },
  {
    title: 'Software Engineer - IV',
    seniority: 'Principal',
    salary: 120_000,
  },
  {
    title: 'Designer - III',
    seniority: 'Senior',
    salary: 100_000,
  },
  {
    title: 'Designer - IV',
    seniority: 'Principal',
    salary: 120_000,
  },
  {
    title: 'Marketer - I',
    seniority: 'Junior',
    salary: 50_000,
  },
  {
    title: 'Marketer - II',
    seniority: 'Mid',
    salary: 65_000,
  },
  {
    title: 'Marketer - III',
    seniority: 'Senior',
    salary: 80_000,
  },
];

export const CAP_TABLE = (dictionary: Dictionary['open_startup']) => [
  { name: dictionary.founders, percentage: 75.5 },
  { name: dictionary.investors, percentage: 14.5 },
  { name: dictionary.team_pool, percentage: 10 },
];
