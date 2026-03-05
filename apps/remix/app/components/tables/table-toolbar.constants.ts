import type { MessageDescriptor } from '@lingui/core';
import { msg } from '@lingui/core/macro';

export const PERIOD_OPTIONS: Array<{ label: MessageDescriptor; value: string }> = [
  {
    label: msg`All Time`,
    value: 'all',
  },
  {
    label: msg`Last 7 days`,
    value: '7d',
  },
  {
    label: msg`Last 14 days`,
    value: '14d',
  },
  {
    label: msg`Last 30 days`,
    value: '30d',
  },
];
