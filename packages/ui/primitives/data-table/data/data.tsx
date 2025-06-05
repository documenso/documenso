import { msg } from '@lingui/core/macro';
import { CheckCircle2, Clock, File, FileText, Inbox, Link, XCircle } from 'lucide-react';

export const statuses = [
  {
    value: 'INBOX',
    label: msg`Inbox`,
    icon: Inbox,
    color: 'text-blue-700 dark:text-blue-300',
    bgColor: 'bg-blue-100 dark:bg-blue-100 text-blue-700 dark:text-blue-700',
  },
  {
    value: 'DRAFT',
    label: msg`Draft`,
    icon: File,
    color: 'text-yellow-500 dark:text-yellow-300',
    bgColor: 'bg-yellow-100 dark:bg-yellow-100 text-yellow-700 dark:text-yellow-700',
  },
  {
    value: 'PENDING',
    label: msg`Pending`,
    icon: Clock,
    color: 'text-blue-700 dark:text-blue-300',
    bgColor: 'bg-blue-100 dark:bg-blue-100 text-blue-700 dark:text-blue-700',
  },
  {
    value: 'COMPLETED',
    label: msg`Completed`,
    icon: CheckCircle2,
    color: 'text-documenso-700 dark:text-documenso-300',
    bgColor: 'bg-documenso-200 dark:bg-documenso-200 text-documenso-800 dark:text-documenso-800',
  },
  {
    value: 'REJECTED',
    label: msg`Rejected`,
    icon: XCircle,
    color: 'text-red-700 dark:text-red-300',
    bgColor: 'bg-red-100 dark:bg-red-100 text-red-500 dark:text-red-700',
  },
];

export const sources = [
  {
    value: 'TEMPLATE',
    label: msg`Template`,
    icon: FileText,
    color: 'text-blue-700 dark:text-blue-300',
    bgColor: 'bg-blue-100 dark:bg-blue-100 text-blue-700 dark:text-blue-700',
  },
  {
    value: 'DIRECT_LINK',
    label: msg`Direct Link`,
    icon: Link,
    color: 'text-green-700 dark:text-green-300',
    bgColor: 'bg-green-100 dark:bg-green-100 text-green-700 dark:text-green-700',
  },
];

export const timePeriods = [
  {
    value: 'today',
    label: msg`Today`,
  },
  {
    value: 'this-week',
    label: msg`This Week`,
  },
  {
    value: 'this-month',
    label: msg`This Month`,
  },
  {
    value: 'this-quarter',
    label: msg`This Quarter`,
  },
  {
    value: 'this-year',
    label: msg`This Year`,
  },
  {
    value: 'yesterday',
    label: msg`Yesterday`,
  },
  {
    value: 'last-week',
    label: msg`Last Week`,
  },
  {
    value: 'last-month',
    label: msg`Last Month`,
  },
  {
    value: 'last-quarter',
    label: msg`Last Quarter`,
  },
  {
    value: 'last-year',
    label: msg`Last Year`,
  },
  {
    value: 'all-time',
    label: msg`All Time`,
  },
];

export const timePeriodGroups = [
  {
    label: msg`Present`,
    values: ['today', 'this-week', 'this-month', 'this-quarter', 'this-year'],
  },
  {
    label: msg`Past`,
    values: ['yesterday', 'last-week', 'last-month', 'last-quarter', 'last-year'],
  },
  {
    label: msg``,
    values: ['all-time'],
  },
];
