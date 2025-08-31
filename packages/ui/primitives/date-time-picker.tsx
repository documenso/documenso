'use client';

import React from 'react';

import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { CalendarIcon } from 'lucide-react';
import { DateTime } from 'luxon';

import { cn } from '../lib/utils';
import { Button } from './button';
import { Calendar } from './calendar';
import { Input } from './input';
import { Popover, PopoverContent, PopoverTrigger } from './popover';

export interface DateTimePickerProps {
  value?: Date;
  onChange?: (date: Date | undefined) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  minDate?: Date;
}

export const DateTimePicker = ({
  value,
  onChange,
  placeholder,
  disabled = false,
  className,
  minDate = new Date(),
}: DateTimePickerProps) => {
  const { _ } = useLingui();
  const [open, setOpen] = React.useState(false);

  const handleDateSelect = (selectedDate: Date | undefined) => {
    if (!selectedDate) {
      onChange?.(undefined);
      return;
    }

    if (value) {
      const existingTime = DateTime.fromJSDate(value);
      const newDateTime = DateTime.fromJSDate(selectedDate).set({
        hour: existingTime.hour,
        minute: existingTime.minute,
      });
      onChange?.(newDateTime.toJSDate());
    } else {
      const now = DateTime.now();
      const newDateTime = DateTime.fromJSDate(selectedDate).set({
        hour: now.hour,
        minute: now.minute,
      });
      onChange?.(newDateTime.toJSDate());
    }
    setOpen(false);
  };

  const handleTimeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const timeValue = event.target.value;
    if (!timeValue || !value) return;

    const [hours, minutes] = timeValue.split(':').map(Number);
    const newDateTime = DateTime.fromJSDate(value).set({
      hour: hours,
      minute: minutes,
    });

    onChange?.(newDateTime.toJSDate());
  };

  const formatDateTime = (date: Date) => {
    return DateTime.fromJSDate(date).toFormat('MMM dd, yyyy');
  };

  const formatTime = (date: Date) => {
    return DateTime.fromJSDate(date).toFormat('HH:mm');
  };

  return (
    <div className={cn('flex gap-2', className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              'w-[200px] justify-start text-left font-normal',
              !value && 'text-muted-foreground',
            )}
            disabled={disabled}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {value ? formatDateTime(value) : <span>{placeholder || _(msg`Pick a date`)}</span>}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={value}
            onSelect={handleDateSelect}
            disabled={
              disabled
                ? true
                : (date) => {
                    return date < minDate;
                  }
            }
            initialFocus
          />
        </PopoverContent>
      </Popover>

      {value && (
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground text-sm">
            <Trans>at</Trans>
          </span>
          <Input
            type="time"
            value={formatTime(value)}
            onChange={handleTimeChange}
            disabled={disabled}
            className="w-[120px]"
          />
        </div>
      )}
    </div>
  );
};
