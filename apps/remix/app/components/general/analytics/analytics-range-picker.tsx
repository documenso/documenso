import { useWindowSize } from '@documenso/lib/client-only/hooks/use-window-size';
import { ANALYTICS_CUSTOM_RANGE_MAX_LOOKBACK } from '@documenso/trpc/server/team-router/get-team-analytics.types';
import { Button } from '@documenso/ui/primitives/button';
import type { CalendarProps } from '@documenso/ui/primitives/calendar';
import { Calendar } from '@documenso/ui/primitives/calendar';
import { Popover, PopoverAnchor, PopoverContent } from '@documenso/ui/primitives/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@documenso/ui/primitives/select';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Plural, Trans } from '@lingui/react/macro';
import { DateTime } from 'luxon';
import { useRef, useState } from 'react';

import type { AnalyticsRangeValue, TAnalyticsPresetRange } from '~/utils/analytics';
import {
  ANALYTICS_PRESET_RANGES,
  ANALYTICS_RANGE_LABELS,
  formatAnalyticsDate,
  formatAnalyticsDateRange,
  getAnalyticsDateRangeDays,
} from '~/utils/analytics';

export type AnalyticsRangePickerProps = {
  value: AnalyticsRangeValue;
  onValueChange: (value: AnalyticsRangeValue) => void;
};

/** The calendar selection while the popover is open; `to` is unset until the second day is picked. */
type DraftRange = {
  from: Date | undefined;
  to: Date | undefined;
};

/** A single react-day-picker matcher, e.g. `{ after: Date }`. */
type DayMatcher = Exclude<CalendarProps['disabled'], undefined | unknown[]>;

/**
 * A preset select with a "Custom range…" item that opens a two month range
 * calendar anchored to the select. The custom window is only committed when
 * "Apply" is pressed.
 */
export const AnalyticsRangePicker = ({ value, onValueChange }: AnalyticsRangePickerProps) => {
  const { _, i18n } = useLingui();
  const { width } = useWindowSize();

  const triggerRef = useRef<HTMLButtonElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [draft, setDraft] = useState<DraftRange | undefined>();

  const numberOfMonths = width >= SM_BREAKPOINT ? 2 : 1;

  const today = DateTime.local().startOf('day');

  const openPicker = () => {
    setDraft(
      value.range === 'custom'
        ? { from: DateTime.fromISO(value.from).toJSDate(), to: DateTime.fromISO(value.to).toJSDate() }
        : undefined,
    );

    setIsPickerOpen(true);
  };

  const closePicker = () => {
    setIsPickerOpen(false);
    setDraft(undefined);
  };

  const handleSelectValueChange = (nextValue: string) => {
    if (nextValue === CUSTOM_RANGE_VALUE) {
      openPicker();

      return;
    }

    const preset = ANALYTICS_PRESET_RANGES.find((range) => range === nextValue);

    if (!preset) {
      return;
    }

    onValueChange({ range: preset });
  };

  /**
   * Picking a day starts a new window unless one end is already pending, in which
   * case it completes it. This replaces react-day-picker's default, which extends
   * a completed window instead of starting over.
   */
  const handleDaySelect = (_nextRange: unknown, day: Date) => {
    if (draft?.from && !draft.to) {
      setDraft(day < draft.from ? { from: day, to: draft.from } : { from: draft.from, to: day });

      return;
    }

    setDraft({ from: day, to: undefined });
  };

  const handleApply = () => {
    if (!draft?.from || !draft.to) {
      return;
    }

    onValueChange({ range: 'custom', from: formatAnalyticsDate(draft.from), to: formatAnalyticsDate(draft.to) });

    closePicker();
  };

  // Only the last year (plus a day) up to today is selectable.
  const earliestDay = today.minus(ANALYTICS_CUSTOM_RANGE_MAX_LOOKBACK);
  const disabledDays: DayMatcher[] = [{ before: earliestDay.toJSDate() }, { after: today.toJSDate() }];

  // Open on the month of the pending window (or today), keeping the current month
  // as the right-most one so no fully disabled future month is shown.
  const anchorMonth = draft?.from ? DateTime.fromJSDate(draft.from).startOf('month') : today.startOf('month');
  const lastVisibleMonth = today.startOf('month').minus({ months: numberOfMonths - 1 });
  const defaultMonth = DateTime.min(anchorMonth, lastVisibleMonth).toJSDate();

  const draftFrom = draft?.from ? formatAnalyticsDate(draft.from) : null;
  const draftTo = draft?.to ? formatAnalyticsDate(draft.to) : null;
  const draftDays = draftFrom && draftTo ? getAnalyticsDateRangeDays(draftFrom, draftTo) : 0;

  const customLabel =
    value.range === 'custom' ? formatAnalyticsDateRange(value.from, value.to, i18n.locale) : undefined;

  return (
    <Popover
      open={isPickerOpen}
      onOpenChange={(open) => {
        if (!open) {
          closePicker();
        }
      }}
    >
      {/*
       * The select never holds "custom" as its value so choosing "Custom range…" always
       * fires a change, letting an active custom window be adjusted. The trigger shows
       * the formatted window through the placeholder instead.
       */}
      <Select value={value.range === 'custom' ? '' : value.range} onValueChange={handleSelectValueChange}>
        <PopoverAnchor asChild>
          <SelectTrigger
            ref={triggerRef}
            className="w-full sm:w-auto sm:min-w-44"
            aria-label={_(msg`Date range`)}
            data-testid="analytics-range"
          >
            <SelectValue placeholder={customLabel} />
          </SelectTrigger>
        </PopoverAnchor>

        <SelectContent position="popper">
          {ANALYTICS_PRESET_OPTIONS.map(({ value: optionValue, label }) => (
            <SelectItem key={optionValue} value={optionValue}>
              {_(label)}
            </SelectItem>
          ))}

          <SelectSeparator />

          <SelectItem value={CUSTOM_RANGE_VALUE} data-testid="analytics-range-custom">
            <Trans>Custom range…</Trans>
          </SelectItem>
        </SelectContent>
      </Select>

      <PopoverContent
        ref={contentRef}
        align="end"
        className="w-auto p-0"
        // The select refocuses its trigger (asynchronously) as it closes, which
        // would otherwise dismiss the popover that has just opened and strand
        // keyboard focus outside it. Pointer interaction with the trigger still
        // dismisses the popover so the select can be reopened.
        onFocusOutside={(event) => {
          if (!(event.target instanceof Node) || !triggerRef.current?.contains(event.target)) {
            return;
          }

          event.preventDefault();

          const content = contentRef.current;
          const firstTabbable = content?.querySelector<HTMLElement>(TABBABLE_SELECTOR);

          (firstTabbable ?? content)?.focus();
        }}
        // There is no popover trigger element, so hand focus back to the select.
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          triggerRef.current?.focus();
        }}
      >
        <div data-testid="analytics-range-calendar">
          <Calendar
            mode="range"
            selected={draft}
            onSelect={handleDaySelect}
            numberOfMonths={numberOfMonths}
            // Adjacent months would otherwise show the same days twice.
            showOutsideDays={false}
            defaultMonth={defaultMonth}
            fromDate={earliestDay.toJSDate()}
            toDate={today.toJSDate()}
            disabled={disabledDays}
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-border border-t px-3 py-2">
          <p className="text-muted-foreground text-sm" aria-live="polite">
            {draftFrom && draftTo ? (
              <>
                {formatAnalyticsDateRange(draftFrom, draftTo, i18n.locale)} ·{' '}
                <Plural value={draftDays} one="# day" other="# days" />
              </>
            ) : draftFrom ? (
              <Trans>Pick an end date</Trans>
            ) : (
              <Trans>Pick a start date</Trans>
            )}
          </p>

          <div className="flex items-center gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={closePicker}>
              <Trans>Cancel</Trans>
            </Button>

            <Button
              type="button"
              size="sm"
              onClick={handleApply}
              disabled={!draftFrom || !draftTo}
              data-testid="analytics-range-apply"
            >
              <Trans>Apply</Trans>
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};

const CUSTOM_RANGE_VALUE = 'custom';

/** Tailwind `sm` breakpoint; two months are shown from here up. */
const SM_BREAKPOINT = 640;

/** First element the popover should focus: the calendar's month navigation, then the days. */
const TABBABLE_SELECTOR = 'button:not([disabled]):not([tabindex="-1"]), [tabindex="0"]';

const ANALYTICS_PRESET_OPTIONS = ANALYTICS_PRESET_RANGES.map((value: TAnalyticsPresetRange) => ({
  value,
  label: ANALYTICS_RANGE_LABELS[value],
}));
