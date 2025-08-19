'use client';

import React from 'react';

import type { DurationValue } from '@documenso/lib/utils/expiry';

import { cn } from '../lib/utils';
import { Input } from './input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './select';

export interface DurationSelectorProps {
  value?: DurationValue;
  onChange?: (value: DurationValue) => void;
  disabled?: boolean;
  className?: string;
  minAmount?: number;
  maxAmount?: number;
}

const TIME_UNITS: Array<{ value: string; label: string; labelPlural: string }> = [
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
  const handleAmountChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const amount = parseInt(event.target.value, 10);
    if (!isNaN(amount) && amount >= minAmount && amount <= maxAmount) {
      onChange?.({ ...value, amount });
    }
  };

  const handleUnitChange = (unit: string) => {
    onChange?.({ ...value, unit });
  };

  const getUnitLabel = (unit: string, amount: number) => {
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
