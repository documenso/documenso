import { Plural, Trans } from '@lingui/react/macro';

import type {
  TEnvelopeReminderDurationPeriod,
  TEnvelopeReminderPeriod,
  TEnvelopeReminderSettings,
} from '@documenso/lib/constants/envelope-reminder';
import { Input } from '@documenso/ui/primitives/input';
import { Label } from '@documenso/ui/primitives/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@documenso/ui/primitives/select';

type ReminderMode = 'enabled' | 'disabled' | 'inherit';

const getMode = (value: TEnvelopeReminderSettings | null | undefined): ReminderMode => {
  if (value === null || value === undefined) {
    return 'inherit';
  }

  if ('disabled' in value.sendAfter) {
    return 'disabled';
  }

  return 'enabled';
};

const getPeriodAmount = (period: TEnvelopeReminderPeriod | undefined): number => {
  if (period && 'amount' in period) {
    return period.amount;
  }

  return 1;
};

const getPeriodUnit = (
  period: TEnvelopeReminderPeriod | undefined,
): TEnvelopeReminderDurationPeriod['unit'] => {
  if (period && 'unit' in period) {
    return period.unit;
  }

  return 'day';
};

export type ReminderSettingsPickerProps = {
  value: TEnvelopeReminderSettings | null | undefined;
  onChange: (value: TEnvelopeReminderSettings | null) => void;
  disabled?: boolean;
  inheritLabel?: string;
};

export const ReminderSettingsPicker = ({
  value,
  onChange,
  disabled = false,
  inheritLabel,
}: ReminderSettingsPickerProps) => {
  const mode = getMode(value);

  const sendAfterAmount = getPeriodAmount(value?.sendAfter);
  const sendAfterUnit = getPeriodUnit(value?.sendAfter);
  const repeatEveryAmount = getPeriodAmount(value?.repeatEvery);
  const repeatEveryUnit = getPeriodUnit(value?.repeatEvery);

  const onModeChange = (newMode: string) => {
    if (newMode === 'inherit') {
      onChange(null);
      return;
    }

    if (newMode === 'disabled') {
      onChange({
        sendAfter: { disabled: true },
        repeatEvery: { disabled: true },
      });
      return;
    }

    onChange({
      sendAfter: { unit: sendAfterUnit, amount: sendAfterAmount },
      repeatEvery: { unit: repeatEveryUnit, amount: repeatEveryAmount },
    });
  };

  const updateSendAfter = (
    updates: Partial<{ amount: number; unit: TEnvelopeReminderDurationPeriod['unit'] }>,
  ) => {
    const newAmount = Math.max(1, Math.floor(updates.amount ?? sendAfterAmount));
    const newUnit = updates.unit ?? sendAfterUnit;

    onChange({
      sendAfter: { unit: newUnit, amount: newAmount },
      repeatEvery: value?.repeatEvery ?? { unit: repeatEveryUnit, amount: repeatEveryAmount },
    });
  };

  const updateRepeatEvery = (
    updates: Partial<{ amount: number; unit: TEnvelopeReminderDurationPeriod['unit'] }>,
  ) => {
    const newAmount = Math.max(1, Math.floor(updates.amount ?? repeatEveryAmount));
    const newUnit = updates.unit ?? repeatEveryUnit;

    onChange({
      sendAfter: value?.sendAfter ?? { unit: sendAfterUnit, amount: sendAfterAmount },
      repeatEvery: { unit: newUnit, amount: newAmount },
    });
  };

  const onRepeatModeChange = (newMode: string) => {
    if (newMode === 'disabled') {
      onChange({
        sendAfter: value?.sendAfter ?? { unit: sendAfterUnit, amount: sendAfterAmount },
        repeatEvery: { disabled: true },
      });
      return;
    }

    onChange({
      sendAfter: value?.sendAfter ?? { unit: sendAfterUnit, amount: sendAfterAmount },
      repeatEvery: { unit: repeatEveryUnit, amount: repeatEveryAmount },
    });
  };

  const repeatMode = value?.repeatEvery && 'disabled' in value.repeatEvery ? 'disabled' : 'enabled';

  return (
    <div className="flex flex-col gap-4" data-testid="reminder-settings-picker">
      <Select value={mode} onValueChange={onModeChange} disabled={disabled}>
        <SelectTrigger className="bg-background" data-testid="reminder-mode-select">
          <SelectValue />
        </SelectTrigger>

        <SelectContent>
          <SelectItem value="enabled">
            <Trans>Enabled</Trans>
          </SelectItem>

          <SelectItem value="disabled">
            <Trans>No reminders</Trans>
          </SelectItem>

          {inheritLabel !== undefined && <SelectItem value="inherit">{inheritLabel}</SelectItem>}
        </SelectContent>
      </Select>

      {mode === 'enabled' && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label className="text-sm text-muted-foreground">
              <Trans>Send first reminder after</Trans>
            </Label>

            <div className="flex flex-row gap-2">
              <Input
                type="number"
                min={1}
                className="w-20 bg-background"
                value={sendAfterAmount}
                onChange={(e) => updateSendAfter({ amount: Number(e.target.value) })}
                disabled={disabled}
                data-testid="reminder-send-after-amount"
              />

              <UnitSelect
                value={sendAfterUnit}
                amount={sendAfterAmount}
                onChange={(unit) =>
                  updateSendAfter({
                    unit: unit as TEnvelopeReminderDurationPeriod['unit'],
                  })
                }
                disabled={disabled}
                testId="reminder-send-after-unit"
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label className="text-sm text-muted-foreground">
              <Trans>Then repeat every</Trans>
            </Label>

            <Select value={repeatMode} onValueChange={onRepeatModeChange} disabled={disabled}>
              <SelectTrigger className="bg-background" data-testid="reminder-repeat-mode-select">
                <SelectValue />
              </SelectTrigger>

              <SelectContent>
                <SelectItem value="enabled">
                  <Trans>Custom interval</Trans>
                </SelectItem>

                <SelectItem value="disabled">
                  <Trans>Don't repeat</Trans>
                </SelectItem>
              </SelectContent>
            </Select>

            {repeatMode === 'enabled' && (
              <div className="flex flex-row gap-2">
                <Input
                  type="number"
                  min={1}
                  className="w-20 bg-background"
                  value={repeatEveryAmount}
                  onChange={(e) => updateRepeatEvery({ amount: Number(e.target.value) })}
                  disabled={disabled}
                  data-testid="reminder-repeat-amount"
                />

                <UnitSelect
                  value={repeatEveryUnit}
                  amount={repeatEveryAmount}
                  onChange={(unit) =>
                    updateRepeatEvery({
                      unit: unit as TEnvelopeReminderDurationPeriod['unit'],
                    })
                  }
                  disabled={disabled}
                  testId="reminder-repeat-unit"
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const UnitSelect = ({
  value,
  amount,
  onChange,
  disabled,
  testId,
}: {
  value: string;
  amount: number;
  onChange: (value: string) => void;
  disabled: boolean;
  testId: string;
}) => (
  <Select value={value} onValueChange={onChange} disabled={disabled}>
    <SelectTrigger className="flex-1 bg-background" data-testid={testId}>
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
    </SelectContent>
  </Select>
);
