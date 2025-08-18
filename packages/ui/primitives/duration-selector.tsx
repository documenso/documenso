'use client';

import React from 'react';

import { useLingui } from '@lingui/react';
import { DateTime } from 'luxon';

import { cn } from '../lib/utils';
import { Input } from './input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './select';

export type TimeUnit = 'minutes' | 'hours' | 'days' | 'weeks' | 'months';

export interface DurationValue {
  amount: number;
  unit: TimeUnit;
}

export interface DurationSelectorProps {
  value?: DurationValue;
  onChange?: (value: DurationValue) => void;
  disabled?: boolean;
  className?: string;
  minAmount?: number;
  maxAmount?: number;
}

const TIME_UNITS: Array<{ value: TimeUnit; label: string; labelPlural: string }> = [
  { value: 'minutes', label: 'Minute', labelPlural: 'Minutes' },
  { value: 'hours', label: 'Hour', labelPlural: 'Hours' },
  { value: 'days', label: 'Day', labelPlural: 'Days' },
  { value: 'weeks', label: 'Week', labelPlural: 'Weeks' },
  { value: 'months', label: 'Month', labelPlural: 'Months' },
];

export const DurationSelector = ({
  value = { amount: 1, unit: 'days' },
  onChange,
  disabled = false,
  className,
  minAmount = 1,
  maxAmount = 365,
}: DurationSelectorProps) => {
  const { _ } = useLingui();

  const handleAmountChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const amount = parseInt(event.target.value, 10);
    if (!isNaN(amount) && amount >= minAmount && amount <= maxAmount) {
      onChange?.({ ...value, amount });
    }
  };

  const handleUnitChange = (unit: TimeUnit) => {
    onChange?.({ ...value, unit });
  };

  const getUnitLabel = (unit: TimeUnit, amount: number) => {
    const unitConfig = TIME_UNITS.find((u) => u.value === unit);
    if (!unitConfig) return unit;

    return amount === 1 ? unitConfig.label : unitConfig.labelPlural;
  };

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <Input
        type="number"
        value={value.amount}
        onChange={handleAmountChange}
        disabled={disabled}
        min={minAmount}
        max={maxAmount}
        className="w-20"
      />
      <Select value={value.unit} onValueChange={handleUnitChange} disabled={disabled}>
        <SelectTrigger className="w-24">
          <SelectValue>{getUnitLabel(value.unit, value.amount)}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {TIME_UNITS.map((unit) => (
            <SelectItem key={unit.value} value={unit.value}>
              {getUnitLabel(unit.value, value.amount)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};

export const calculateExpiryDate = (duration: DurationValue, fromDate: Date = new Date()): Date => {
  switch (duration.unit) {
    case 'minutes':
      return DateTime.fromJSDate(fromDate).plus({ minutes: duration.amount }).toJSDate();
    case 'hours':
      return DateTime.fromJSDate(fromDate).plus({ hours: duration.amount }).toJSDate();
    case 'days':
      return DateTime.fromJSDate(fromDate).plus({ days: duration.amount }).toJSDate();
    case 'weeks':
      return DateTime.fromJSDate(fromDate).plus({ weeks: duration.amount }).toJSDate();
    case 'months':
      return DateTime.fromJSDate(fromDate).plus({ months: duration.amount }).toJSDate();
    default:
      return DateTime.fromJSDate(fromDate).plus({ days: duration.amount }).toJSDate();
  }
};
