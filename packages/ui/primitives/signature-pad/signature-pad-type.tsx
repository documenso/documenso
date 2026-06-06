import { useLingui } from '@lingui/react/macro';
import { useLayoutEffect, useRef, useState } from 'react';

import { cn } from '../../lib/utils';

export type SignaturePadTypeProps = {
  className?: string;
  value?: string;
  defaultValue?: string;
  onChange: (_value: string) => void;
};

export const SignaturePadType = ({ className, value, defaultValue, onChange }: SignaturePadTypeProps) => {
  const { t } = useLingui();

  const minimumFontSize = 28;
  const maximumFontSize = 72;

  const $isDirty = useRef(false);
  const $input = useRef<HTMLInputElement>(null);
  const [fontSize, setFontSize] = useState(72);

  const displayValue = value || defaultValue || '';

  const fitFontSize = () => {
    const input = $input.current;

    if (!input) {
      return;
    }

    const parent = input.parentElement;

    if (!parent) {
      return;
    }

    const availableWidth = Math.max(0, parent.clientWidth - 32);
    const availableHeight = parent.clientHeight;
    const text = displayValue;

    if (!text) {
      setFontSize(maximumFontSize);
      return;
    }

    const measurementCanvas = document.createElement('canvas');
    const measurementContext = measurementCanvas.getContext('2d');

    if (!measurementContext) {
      return;
    }

    const fontFamily = 'Caveat';
    let lowerBound = minimumFontSize;
    let upperBound = maximumFontSize;
    let nextFontSize = maximumFontSize;

    for (let iteration = 0; iteration < 18; iteration += 1) {
      measurementContext.font = `${nextFontSize}px ${fontFamily}`;
      const metrics = measurementContext.measureText(text);
      const textWidth = metrics.width;
      const textHeight = metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent || nextFontSize;

      const fitsWithinBounds = textWidth <= availableWidth && textHeight <= availableHeight;

      if (fitsWithinBounds) {
        lowerBound = nextFontSize;
      } else {
        upperBound = nextFontSize;
      }

      nextFontSize = (lowerBound + upperBound) / 2;

      if (Math.abs(upperBound - lowerBound) < 0.5) {
        break;
      }
    }

    setFontSize(lowerBound);
  };

  useLayoutEffect(() => {
    fitFontSize();

    const input = $input.current;
    const parent = input?.parentElement;

    if (!parent) {
      return;
    }

    const resizeObserver = new ResizeObserver(() => {
      fitFontSize();
    });

    resizeObserver.observe(parent);

    return () => {
      resizeObserver.disconnect();
    };
  }, [displayValue, defaultValue]);

  useLayoutEffect(() => {
    if (!$isDirty.current && !value && defaultValue) {
      $isDirty.current = true;
      onChange(defaultValue);
    }
  }, [defaultValue, value, onChange]);

  return (
    <div className={cn('flex h-full w-full items-center justify-center', className)}>
      <input
        ref={$input}
        data-testid="signature-pad-type-input"
        placeholder={t`Type your signature`}
        className="w-full min-w-0 bg-transparent px-4 text-center font-signature text-foreground leading-none placeholder:text-4xl focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0"
        style={{
          fontSize: `${fontSize}px`,
        }}
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
