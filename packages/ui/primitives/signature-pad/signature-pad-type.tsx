import { useEffect, useRef } from 'react';

import { useLingui } from '@lingui/react/macro';

import { cn } from '../../lib/utils';

export type SignaturePadTypeProps = {
  className?: string;
  value?: string;
  defaultValue?: string;
  onChange: (_value: string) => void;
};

export const SignaturePadType = ({
  className,
  value,
  defaultValue,
  onChange,
}: SignaturePadTypeProps) => {
  const { t } = useLingui();

  const $isDirty = useRef(false);
  // Colors don't actually work for text.

  useEffect(() => {
    if (!$isDirty.current && !value && defaultValue) {
      $isDirty.current = true;
      onChange(defaultValue);
    }
  }, [defaultValue, value, onChange]);

  return (
    <div className={cn('flex h-full w-full items-center justify-center', className)}>
      <input
        data-testid="signature-pad-type-input"
        placeholder={t`Type your signature`}
        className="w-full bg-transparent px-4 text-center font-signature text-7xl text-black placeholder:text-4xl focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 dark:text-white"
        // style={{ color: selectedColor }}
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
