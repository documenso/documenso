import { useCallback, useMemo, useRef, useState } from 'react';

import { CheckIcon, CopyIcon } from 'lucide-react';
import { DateTime } from 'luxon';

import { cn } from '../../lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '../../primitives/popover';

const HOVER_DELAY_MS = 500;

export type LocalTimeProps = {
  date: Date | string;
  className?: string;
};

export const LocalTime = ({ date, className }: LocalTimeProps) => {
  const [open, setOpen] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const hoverTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMouseOver = useRef(false);

  const dt = useMemo(() => DateTime.fromJSDate(new Date(date)), [date]);

  const relative = dt.toRelative() ?? '';
  const local = dt.toFormat('yyyy-MM-dd HH:mm:ss ZZZZ');
  const utc = dt.toUTC().toFormat('yyyy-MM-dd HH:mm:ss') + ' UTC';
  const unix = Math.floor(dt.toSeconds()).toString();

  const onMouseEnter = useCallback(() => {
    isMouseOver.current = true;

    hoverTimeout.current = setTimeout(() => {
      if (isMouseOver.current) {
        setOpen(true);
      }
    }, HOVER_DELAY_MS);
  }, []);

  const onMouseLeave = useCallback(() => {
    isMouseOver.current = false;

    if (hoverTimeout.current) {
      clearTimeout(hoverTimeout.current);
      hoverTimeout.current = null;
    }

    setTimeout(() => {
      if (!isMouseOver.current) {
        setOpen(false);
      }
    }, 200);
  }, []);

  const onCopy = async (label: string, value: string) => {
    await navigator.clipboard.writeText(value);
    setCopiedField(label);
    setTimeout(() => setCopiedField(null), 1500);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className={cn(
          'cursor-pointer underline decoration-muted-foreground/50 decoration-dotted underline-offset-4',
          className,
        )}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
      >
        {relative}
      </PopoverTrigger>

      <PopoverContent
        className="w-auto p-3"
        align="start"
        onMouseEnter={() => {
          isMouseOver.current = true;
        }}
        onMouseLeave={onMouseLeave}
      >
        <div className="space-y-1.5 text-xs">
          <TimeRow
            label="Local"
            value={local}
            isCopied={copiedField === 'Local'}
            onCopy={() => void onCopy('Local', local)}
          />
          <TimeRow
            label="UTC"
            value={utc}
            isCopied={copiedField === 'UTC'}
            onCopy={() => void onCopy('UTC', utc)}
          />
          <TimeRow
            label="Unix"
            value={unix}
            isCopied={copiedField === 'Unix'}
            onCopy={() => void onCopy('Unix', unix)}
          />
        </div>
      </PopoverContent>
    </Popover>
  );
};

type TimeRowProps = {
  label: string;
  value: string;
  isCopied: boolean;
  onCopy: () => void;
};

const TimeRow = ({ label, value, isCopied, onCopy }: TimeRowProps) => (
  <div className="flex items-center justify-between gap-x-4">
    <div>
      <span className="text-muted-foreground">{label}: </span>
      <span className="font-mono">{value}</span>
    </div>

    <button type="button" className="text-muted-foreground hover:text-foreground" onClick={onCopy}>
      {isCopied ? <CheckIcon className="h-3 w-3" /> : <CopyIcon className="h-3 w-3" />}
    </button>
  </div>
);
