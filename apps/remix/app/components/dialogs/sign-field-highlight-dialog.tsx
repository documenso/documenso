import { cn } from '@documenso/ui/lib/utils';
import { Button } from '@documenso/ui/primitives/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@documenso/ui/primitives/dialog';
import { Trans } from '@lingui/react/macro';
import { createCallable } from 'react-call';
import { useState } from 'react';

const HIGHLIGHT_COLORS = [
  { label: 'Yellow', value: '#fef08a' },
  { label: 'Green', value: '#bbf7d0' },
  { label: 'Blue', value: '#bfdbfe' },
  { label: 'Pink', value: '#fecdd3' },
  { label: 'Orange', value: '#fed7aa' },
  { label: 'Purple', value: '#e9d5ff' },
];

export type SignFieldHighlightDialogProps = Record<string, never>;

export type SignFieldHighlightDialogResult = {
  color: string;
};

export const SignFieldHighlightDialog = createCallable<SignFieldHighlightDialogProps, SignFieldHighlightDialogResult | null>(
  ({ call }) => {
    const [selectedColor, setSelectedColor] = useState<string>(HIGHLIGHT_COLORS[0].value);

    return (
      <Dialog open={true} onOpenChange={(value) => (!value ? call.end(null) : null)}>
        <DialogContent position="center">
          <DialogHeader>
            <DialogTitle>
              <Trans>Select Highlight Color</Trans>
            </DialogTitle>
          </DialogHeader>

          <div className="flex flex-wrap gap-3 px-6 pb-4">
            {HIGHLIGHT_COLORS.map((color) => (
              <button
                key={color.value}
                type="button"
                className={cn(
                  'flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border-2 transition-all',
                  selectedColor === color.value
                    ? 'border-primary scale-110'
                    : 'border-transparent hover:scale-105',
                )}
                style={{ backgroundColor: color.value }}
                onClick={() => setSelectedColor(color.value)}
                title={color.label}
              />
            ))}
          </div>

          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => call.end(null)}>
              <Trans>Cancel</Trans>
            </Button>

            <Button type="button" onClick={() => call.end({ color: selectedColor })}>
              <Trans>Start Highlighting</Trans>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  },
);