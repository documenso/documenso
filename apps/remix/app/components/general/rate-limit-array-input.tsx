import { RATE_LIMIT_WINDOW_REGEX } from '@documenso/lib/types/subscription';
import { Button } from '@documenso/ui/primitives/button';
import { Input } from '@documenso/ui/primitives/input';
import { Trans, useLingui } from '@lingui/react/macro';
import { PlusIcon, Trash2Icon } from 'lucide-react';
import { useState } from 'react';

type RateLimitEntryValue = { window: string; max: number };

type RateLimitArrayInputProps = {
  value: RateLimitEntryValue[];
  onChange: (value: RateLimitEntryValue[]) => void;
  disabled?: boolean;
};

const EMPTY_ENTRY: RateLimitEntryValue = { window: '', max: 0 };

/** A row counts as "started" once either field has input; fully-empty rows are dropped on commit. */
const hasEntryInput = (entry: RateLimitEntryValue) => entry.window.trim() !== '' || entry.max > 0;

/** Keep in-progress rows; drop rows that are completely empty. */
const persistEntries = (entries: RateLimitEntryValue[]) => {
  return entries.map((entry) => ({ ...entry, window: entry.window.trim() })).filter(hasEntryInput);
};

export const RateLimitArrayInput = ({ value, onChange, disabled }: RateLimitArrayInputProps) => {
  const { t } = useLingui();
  const [draftEntry, setDraftEntry] = useState<RateLimitEntryValue | null>(null);

  const entries = draftEntry ? [...value, draftEntry] : value.length ? value : [EMPTY_ENTRY];

  const getWindowError = (entry: RateLimitEntryValue, index: number) => {
    const window = entry.window.trim();

    if (!hasEntryInput(entry)) {
      return null;
    }

    if (window === '') {
      return t`Enter a window, e.g. 5m`;
    }

    if (!RATE_LIMIT_WINDOW_REGEX.test(window)) {
      return t`Use a duration with a unit, e.g. 5m, 1h, or 24h`;
    }

    const isDuplicateWindow = entries.some((otherEntry, otherIndex) => {
      return otherIndex !== index && otherEntry.window.trim() === window;
    });

    return isDuplicateWindow ? t`Use a unique window for each rate limit` : null;
  };

  const getMaxError = (entry: RateLimitEntryValue) => {
    if (!hasEntryInput(entry)) {
      return null;
    }

    return entry.max > 0 ? null : t`Enter a max request count greater than 0`;
  };

  const updateEntry = (index: number, patch: Partial<RateLimitEntryValue>) => {
    if (index >= value.length) {
      const nextDraftEntry = { ...(draftEntry ?? EMPTY_ENTRY), ...patch };

      if (hasEntryInput(nextDraftEntry)) {
        onChange(persistEntries([...value, nextDraftEntry]));
        setDraftEntry(null);
        return;
      }

      setDraftEntry(nextDraftEntry);
      return;
    }

    const next = value.map((entry, i) => (i === index ? { ...entry, ...patch } : entry));
    onChange(persistEntries(next));
  };

  const removeEntry = (index: number) => {
    if (index >= value.length) {
      setDraftEntry(null);
      return;
    }

    const next = value.filter((_, i) => i !== index);
    onChange(persistEntries(next));
  };

  const addEntry = () => {
    setDraftEntry(EMPTY_ENTRY);
  };

  const hasErrors = entries.some((entry, index) => getWindowError(entry, index) || getMaxError(entry));
  const isAddDisabled = disabled || value.length === 0 || Boolean(draftEntry) || hasErrors;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-muted-foreground text-xs">
        <span className="w-20 shrink-0">
          <Trans>Window</Trans>
        </span>
        <span className="flex-1">
          <Trans>Max requests</Trans>
        </span>
        <span className="w-9 shrink-0" aria-hidden="true" />
      </div>

      {entries.map((entry, index) => {
        const windowError = getWindowError(entry, index);
        const maxError = getMaxError(entry);

        return (
          <div key={index} className="space-y-1">
            <div className="flex items-center gap-2">
              <Input
                className="w-20 shrink-0"
                placeholder="5m"
                value={entry.window}
                disabled={disabled}
                aria-invalid={Boolean(windowError)}
                onChange={(e) => updateEntry(index, { window: e.target.value })}
              />
              <Input
                className="flex-1"
                type="number"
                min={1}
                placeholder="100"
                value={entry.max || ''}
                disabled={disabled}
                aria-invalid={Boolean(maxError)}
                onChange={(e) => updateEntry(index, { max: parseInt(e.target.value, 10) || 0 })}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-9 w-9 shrink-0 p-0 text-muted-foreground hover:text-foreground"
                disabled={disabled}
                aria-label={t`Remove rate limit`}
                onClick={() => removeEntry(index)}
              >
                <Trash2Icon className="h-4 w-4" />
              </Button>
            </div>

            {windowError ? <p className="text-destructive text-xs">{windowError}</p> : null}
            {maxError ? <p className="text-destructive text-xs">{maxError}</p> : null}
          </div>
        );
      })}

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-full border-dashed"
        disabled={isAddDisabled}
        onClick={addEntry}
      >
        <PlusIcon className="mr-2 h-4 w-4" />
        <Trans>Add rate limit window</Trans>
      </Button>
    </div>
  );
};
