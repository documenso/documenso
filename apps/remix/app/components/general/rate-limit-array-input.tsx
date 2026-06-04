import { Button } from '@documenso/ui/primitives/button';
import { Input } from '@documenso/ui/primitives/input';
import { Trans } from '@lingui/react/macro';
import { PlusIcon, Trash2Icon } from 'lucide-react';

type RateLimitEntryValue = { window: string; max: number };

type RateLimitArrayInputProps = {
  value: RateLimitEntryValue[];
  onChange: (value: RateLimitEntryValue[]) => void;
  disabled?: boolean;
};

export const RateLimitArrayInput = ({ value, onChange, disabled }: RateLimitArrayInputProps) => {
  const entries = value ?? [];

  const updateEntry = (index: number, patch: Partial<RateLimitEntryValue>) => {
    const next = entries.map((entry, i) => (i === index ? { ...entry, ...patch } : entry));
    onChange(next);
  };

  const removeEntry = (index: number) => {
    onChange(entries.filter((_, i) => i !== index));
  };

  const addEntry = () => {
    onChange([...entries, { window: '5m', max: 100 }]);
  };

  return (
    <div className="space-y-2">
      {entries.map((entry, index) => (
        <div key={index} className="flex items-center gap-2">
          <Input
            className="w-24"
            placeholder="5m"
            value={entry.window}
            disabled={disabled}
            onChange={(e) => updateEntry(index, { window: e.target.value })}
          />
          <Input
            className="w-32"
            type="number"
            min={1}
            value={entry.max}
            disabled={disabled}
            onChange={(e) => updateEntry(index, { max: parseInt(e.target.value, 10) || 0 })}
          />
          <Button type="button" variant="ghost" size="sm" disabled={disabled} onClick={() => removeEntry(index)}>
            <Trash2Icon className="h-4 w-4" />
          </Button>
        </div>
      ))}

      <Button type="button" variant="secondary" size="sm" disabled={disabled} onClick={addEntry}>
        <PlusIcon className="mr-2 h-4 w-4" />
        <Trans>Add rate limit</Trans>
      </Button>
    </div>
  );
};
