import { CheckCircle2, Clock, File, Inbox, XCircle } from 'lucide-react';

export const statuses = [
  {
    value: 'DRAFT',
    label: 'Draft',
    icon: File,
    color: 'text-yellow-500 dark:text-yellow-300',
    bgColor: 'bg-yellow-100 dark:bg-yellow-100 text-yellow-700 dark:text-yellow-700',
  },
  {
    value: 'PENDING',
    label: 'Pending',
    icon: Clock,
    color: 'text-water-700 dark:text-water-300',
    bgColor: 'bg-water-100 dark:bg-water-100 text-water-700 dark:text-water-700',
  },
  {
    value: 'COMPLETED',
    label: 'Completed',
    icon: CheckCircle2,
    color: 'text-documenso-700 dark:text-documenso-300',
    bgColor: 'bg-documenso-200 dark:bg-documenso-200 text-documenso-800 dark:text-documenso-800',
  },
  {
    value: 'REJECTED',
    label: 'Rejected',
    icon: XCircle,
    color: 'text-red-700 dark:text-red-300',
    bgColor: 'bg-red-100 dark:bg-red-100 text-red-500 dark:text-red-700',
  },
  {
    value: 'INBOX',
    label: 'Inbox',
    icon: Inbox,
    color: 'text-blue-700 dark:text-blue-300',
    bgColor: 'bg-blue-100 dark:bg-blue-100 text-blue-700 dark:text-blue-700',
  },
];

export const timePeriods = [
  {
    value: 'today',
    label: 'Today',
  },
  {
    value: 'this-week',
    label: 'This Week',
  },
  {
    value: 'this-month',
    label: 'This Month',
  },
  {
    value: 'this-quarter',
    label: 'This Quarter',
  },
  {
    value: 'this-year',
    label: 'This Year',
  },
  {
    value: 'yesterday',
    label: 'Yesterday',
  },
  {
    value: 'last-week',
    label: 'Last Week',
  },
  {
    value: 'last-month',
    label: 'Last Month',
  },
  {
    value: 'last-quarter',
    label: 'Last Quarter',
  },
  {
    value: 'last-year',
    label: 'Last Year',
  },
  {
    value: 'all-time',
    label: 'All Time',
  },
];

export const timePeriodGroups = [
  {
    label: 'Present',
    values: ['today', 'this-week', 'this-month', 'this-quarter', 'this-year'],
  },
  {
    label: 'Past',
    values: ['yesterday', 'last-week', 'last-month', 'last-quarter', 'last-year'],
  },
  {
    label: '',
    values: ['all-time'],
  },
];
