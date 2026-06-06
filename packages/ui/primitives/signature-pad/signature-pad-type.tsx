import { useLingui } from '@lingui/react/macro';
import { useEffect, useRef } from 'react';

import { cn } from '../../lib/utils';
import { SignatureRender } from './signature-render';

export type SignaturePadTypeProps = {
  className?: string;
  value?: string;
  defaultValue?: string;
  onChange: (_value: string) => void;
};

export const SignaturePadType = ({ className, value, defaultValue, onChange }: SignaturePadTypeProps) => {
  const { t } = useLingui();

  const $isDirty = useRef(false);
  const $input = useRef<HTMLInputElement>(null);

  const displayValue = value || defaultValue || '';

  useEffect(() => {
    if (!$isDirty.current && !value && defaultValue) {
      $isDirty.current = true;
      onChange(defaultValue);
    }
  }, [defaultValue, value, onChange]);

  return (
    <div className={cn('relative h-full w-full overflow-hidden', className)}>
      <SignatureRender className="pointer-events-none absolute inset-0" value={displayValue} />

      <input
        ref={$input}
        data-testid="signature-pad-type-input"
        placeholder={t`Type your signature`}
        className="absolute inset-0 w-full min-w-0 bg-transparent px-4 text-center font-signature text-transparent leading-none caret-transparent placeholder:text-foreground/40 focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0"
        aria-label={t`Type your signature`}
        value={value}
        onChange={(event) => {
          onChange(event.target.value.trimStart());
          $isDirty.current = true;
        }}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
      />

      {/* <SignaturePadColorPicker selectedColor={selectedColor} setSelectedColor={setSelectedColor} /> */}
    </div>
  );
};
