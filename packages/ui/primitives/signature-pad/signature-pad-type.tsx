import { useLingui } from '@lingui/react/macro';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { clamp } from 'remeda';

import { cn } from '../../lib/utils';

const MAX_FONT_SIZE = 72;

// Names that still overflow at this size scroll instead of shrinking further, to keep them legible.
const MIN_FONT_SIZE = 24;

export type SignaturePadTypeProps = {
  className?: string;
  value: string;
  defaultValue?: string;
  onChange: (_value: string) => void;
};

export const SignaturePadType = ({ className, value, defaultValue, onChange }: SignaturePadTypeProps) => {
  const { t } = useLingui();

  const $input = useRef<HTMLInputElement>(null);
  const $isDirty = useRef(false);

  const [fontSize, setFontSize] = useState(MAX_FONT_SIZE);

  useEffect(() => {
    if (!$isDirty.current && !value && defaultValue) {
      $isDirty.current = true;
      onChange(defaultValue);
    }
  }, [defaultValue, value, onChange]);

  const fitText = useCallback(() => {
    const input = $input.current;

    if (!input) {
      return;
    }

    setFontSize(getFittedFontSize(input));
  }, []);

  // `value` is only a trigger: fitText measures the text React has already written to the input.
  useLayoutEffect(() => {
    fitText();
  }, [fitText, value]);

  useEffect(() => {
    const input = $input.current;

    if (!input) {
      return;
    }

    const resizeObserver = new ResizeObserver(fitText);
    resizeObserver.observe(input);

    // Text measured before the signature font has loaded uses the fallback font's metrics.
    void document.fonts.load(getMeasurementFont(getComputedStyle(input))).then(fitText, fitText);

    return () => resizeObserver.disconnect();
  }, [fitText]);

  return (
    <input
      ref={$input}
      data-testid="signature-pad-type-input"
      placeholder={t`Type your signature`}
      className={cn(
        'h-full w-full bg-transparent px-4 text-center font-signature text-foreground leading-none placeholder:text-4xl focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0',
        className,
      )}
      style={{ fontSize }}
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
  );
};

// Leaves out font-stretch: its computed value ("100%") is invalid in the font shorthand and voids the whole string.
const getMeasurementFont = ({ fontStyle, fontWeight, fontFamily }: CSSStyleDeclaration) =>
  `${fontStyle} ${fontWeight} ${MAX_FONT_SIZE}px ${fontFamily}`;

const getFittedFontSize = (input: HTMLInputElement) => {
  const text = input.value;

  if (!text) {
    return MAX_FONT_SIZE;
  }

  const style = getComputedStyle(input);

  const availableWidth = input.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
  const context = document.createElement('canvas').getContext('2d');

  if (!context || availableWidth <= 0) {
    return MAX_FONT_SIZE;
  }

  context.font = getMeasurementFont(style);

  // Chromium's canvas skips kerning across spaces by default, which would measure
  // multi-word names a few pixels off what the input renders.
  context.fontKerning = 'normal';

  const { width, actualBoundingBoxLeft, actualBoundingBoxRight } = context.measureText(text);

  // Script glyphs can draw past their advance width, and the input centres text by that width,
  // so the larger overhang has to fit on both sides or the first/last letter gets clipped.
  const overhang = Math.max(0, actualBoundingBoxLeft, actualBoundingBoxRight - width);

  const fittedFontSize = Math.floor((MAX_FONT_SIZE * availableWidth) / (width + overhang * 2));

  return clamp(fittedFontSize, { min: MIN_FONT_SIZE, max: MAX_FONT_SIZE });
};
