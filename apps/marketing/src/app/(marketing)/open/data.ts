import { msg } from '@lingui/macro';

export const TEAM_MEMBERS = [
  {
    name: 'Timur Ercan',
    role: 'Co-Founder, CEO',
    salary: 95_000,
    location: 'Germany',
    engagement: msg`Full-Time`,
    joinDate: 'November 14th, 2022',
  },
  {
    name: 'Lucas Smith',
    role: 'Co-Founder, CTO',
    salary: 95_000,
    location: 'Australia',
    engagement: msg`Full-Time`,
    joinDate: 'April 19th, 2023',
  },
  {
    name: 'Ephraim Atta-Duncan',
    role: 'Software Engineer - I',
    salary: 60_000,
    location: 'Ghana',
    engagement: msg`Full-Time`,
    joinDate: 'June 6th, 2023',
  },
  {
    name: 'David Nguyen',
    role: 'Software Engineer - III',
    salary: 100_000,
    location: 'Australia',
    engagement: msg`Full-Time`,
    joinDate: 'July 26th, 2023',
  },
  {
    name: 'Catalin-Marinel Pit',
    role: 'Software Engineer - II',
    salary: 80_000,
    location: 'Romania',
    engagement: msg`Full-Time`,
    joinDate: 'September 4th, 2023',
  },
  {
    name: 'Gowdhama Rajan B',
    role: 'Designer - III',
    salary: 100_000,
    location: 'India',
    engagement: msg`Full-Time`,
    joinDate: 'October 9th, 2023',
  },
];

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

export const CAP_TABLE = [
  { name: 'Founders', percentage: 75.5 },
  { name: 'Investors', percentage: 14.5 },
  { name: 'Team Pool', percentage: 10 },
];
