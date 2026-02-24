import { Plural, Trans } from '@lingui/react/macro';

import type {
  TEnvelopeExpirationDurationPeriod,
  TEnvelopeExpirationPeriod,
} from '@documenso/lib/constants/envelope-expiration';
import { Input } from '@documenso/ui/primitives/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@documenso/ui/primitives/select';

type ExpirationMode = 'duration' | 'disabled' | 'inherit';

const getMode = (value: TEnvelopeExpirationPeriod | null | undefined): ExpirationMode => {
  if (!value) {
    return 'inherit';
  }

  if ('disabled' in value) {
    return 'disabled';
  }

  return 'duration';
};

const getAmount = (value: TEnvelopeExpirationPeriod | null | undefined): number => {
  if (value && 'amount' in value) {
    return value.amount;
  }

  return 1;
};

const getUnit = (
  value: TEnvelopeExpirationPeriod | null | undefined,
): TEnvelopeExpirationDurationPeriod['unit'] => {
  if (value && 'unit' in value) {
    return value.unit;
  }

  return 'month';
};

export type ExpirationPeriodPickerProps = {
  value: TEnvelopeExpirationPeriod | null | undefined;
  onChange: (value: TEnvelopeExpirationPeriod | null) => void;
  disabled?: boolean;
  inheritLabel?: string;
};

export const ExpirationPeriodPicker = ({
  value,
  onChange,
  disabled = false,
  inheritLabel,
}: ExpirationPeriodPickerProps) => {
  const mode = getMode(value);
  const amount = getAmount(value);
  const unit = getUnit(value);

  const onModeChange = (newMode: string) => {
    if (newMode === 'inherit') {
      onChange(null);
      return;
    }

    if (newMode === 'disabled') {
      onChange({ disabled: true });
      return;
    }

    onChange({ unit, amount });
  };

  const onAmountChange = (newAmount: number) => {
    const clamped = Math.max(1, Math.floor(newAmount));

    onChange({ unit, amount: clamped });
  };

  const onUnitChange = (newUnit: string) => {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    onChange({ unit: newUnit as TEnvelopeExpirationDurationPeriod['unit'], amount });
  };

  return (
    <div className="flex flex-col gap-2">
      <Select value={mode} onValueChange={onModeChange} disabled={disabled}>
        <SelectTrigger className="bg-background">
          <SelectValue />
        </SelectTrigger>

        <SelectContent>
          <SelectItem value="duration">
            <Trans>Custom duration</Trans>
          </SelectItem>

          <SelectItem value="disabled">
            <Trans>Never expires</Trans>
          </SelectItem>

          {inheritLabel !== undefined && <SelectItem value="inherit">{inheritLabel}</SelectItem>}
        </SelectContent>
      </Select>

      {mode === 'duration' && (
        <div className="flex flex-row gap-2">
          <Input
            type="number"
            min={1}
            className="w-20 bg-background"
            value={amount}
            onChange={(e) => onAmountChange(Number(e.target.value))}
            disabled={disabled}
          />

          <Select value={unit} onValueChange={onUnitChange} disabled={disabled}>
            <SelectTrigger className="flex-1 bg-background">
              <SelectValue />
            </SelectTrigger>

            <SelectContent>
              <SelectItem value="day">
                <Plural value={amount} one="Day" other="Days" />
              </SelectItem>
              <SelectItem value="week">
                <Plural value={amount} one="Week" other="Weeks" />
              </SelectItem>
              <SelectItem value="month">
                <Plural value={amount} one="Month" other="Months" />
              </SelectItem>
              <SelectItem value="year">
                <Plural value={amount} one="Year" other="Years" />
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
};
