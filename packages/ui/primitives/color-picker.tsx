import type { HTMLAttributes } from 'react';
import React, { useState } from 'react';

import { HexColorInput, HexColorPicker } from 'react-colorful';

import { cn } from '../lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from './popover';

export type ColorPickerProps = {
  disabled?: boolean;
  value: string;
  defaultValue?: string;
  onChange: (color: string) => void;
} & HTMLAttributes<HTMLDivElement>;

export const ColorPicker = ({
  className,
  disabled = false,
  value,
  defaultValue = '#000000',
  onChange,
  ...props
}: ColorPickerProps) => {
  const [color, setColor] = useState(value || defaultValue);
  const [inputColor, setInputColor] = useState(value || defaultValue);

  const onColorChange = (newColor: string) => {
    setColor(newColor);
    setInputColor(newColor);
    onChange(newColor);
  };

  const onInputChange = (newColor: string) => {
    setInputColor(newColor);
  };

  const onInputBlur = () => {
    setColor(inputColor);
    onChange(inputColor);
  };

  return (
    <Popover>
      <PopoverTrigger>
        <button
          type="button"
          disabled={disabled}
          className="bg-background h-12 w-12 rounded-md border p-1 disabled:pointer-events-none disabled:opacity-50"
        >
          <div className="h-full w-full rounded-sm" style={{ backgroundColor: color }} />
        </button>
      </PopoverTrigger>

      <PopoverContent className="w-auto">
        <HexColorPicker
          className={cn(
            className,
            'w-full aria-disabled:pointer-events-none aria-disabled:opacity-50',
          )}
          color={color}
          onChange={onColorChange}
          aria-disabled={disabled}
          {...props}
        />

        <HexColorInput
          className="mt-4 h-10 rounded-md border bg-transparent px-3 py-2 text-sm disabled:pointer-events-none disabled:opacity-50"
          color={inputColor}
          onChange={onInputChange}
          onBlur={onInputBlur}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              onInputBlur();
            }
          }}
          disabled={disabled}
        />
      </PopoverContent>
    </Popover>
  );
};
