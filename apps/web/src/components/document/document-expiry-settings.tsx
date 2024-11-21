'use client';

import { useState } from 'react';

import { Trans, msg } from '@lingui/macro';
import { useLingui } from '@lingui/react';

import { Input } from '@documenso/ui/primitives/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@documenso/ui/primitives/select';

type DocumentExpirySettingsProps = {
  onChange: (value: number | undefined, unit: 'day' | 'week' | 'month' | undefined) => void;
};

export const DocumentExpirySettings = ({ onChange }: DocumentExpirySettingsProps) => {
  const [expiryValue, setExpiryValue] = useState<number | undefined>(undefined);
  const [expiryUnit, setExpiryUnit] = useState<'day' | 'week' | 'month'>();
  const { _ } = useLingui();

  const handleExpiryValueChange = (value: string) => {
    const parsedValue = parseInt(value, 10);

    if (Number.isNaN(parsedValue) || parsedValue <= 0) {
      setExpiryValue(undefined);
      return;
    } else {
      setExpiryValue(parsedValue);
      onChange(parsedValue, expiryUnit);
    }
  };

  const handleExpiryUnitChange = (value: 'day' | 'week' | 'month') => {
    setExpiryUnit(value);
    onChange(expiryValue, value);
  };

  return (
    <div className="mt-2 flex flex-row gap-4">
      <Input
        type="number"
        placeholder={_(msg`Enter a number`)}
        className="w-16"
        value={expiryValue}
        onChange={(e) => handleExpiryValueChange(e.target.value)}
        min={1}
      />
      <Select value={expiryUnit} onValueChange={handleExpiryUnitChange}>
        <SelectTrigger className="text-muted-foreground">
          <SelectValue placeholder={_(msg`Select...`)} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="day">
            <Trans>Day</Trans>
          </SelectItem>
          <SelectItem value="week">
            <Trans>Week</Trans>
          </SelectItem>
          <SelectItem value="month">
            <Trans>Month</Trans>
          </SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
};
