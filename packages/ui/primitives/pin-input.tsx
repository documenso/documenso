'use client';

import { useRef } from 'react';

import { CodeInput, getSegmentCssWidth } from 'rci';
import { useIsFocused } from 'use-is-focused';

import { cn } from '@documenso/ui/lib/utils';

export type PinInputState = 'input' | 'loading' | 'error' | 'success';
export type PinInputProps = {
  id: string;
  state: PinInputState;
  autoFocus?: boolean;
  onSubmit({ code, input }: { code: string; input: EventTarget & HTMLInputElement }): void;
};

const PinInput = ({ id, autoFocus, state, onSubmit }: PinInputProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const focused = useIsFocused(inputRef);

  const width = getSegmentCssWidth('14px');

  return (
    <CodeInput
      id={id}
      className={cn({
        'motion-safe:animate-[shake_0.15s_ease-in-out_0s_2]': state === 'error',
      })}
      inputClassName="caret-transparent selection:bg-transparent ring:ring-2"
      autoFocus={autoFocus}
      length={6}
      fontFamily="Inter"
      fontSize="36px"
      readOnly={state !== 'input'}
      disabled={state === 'loading'}
      inputRef={inputRef}
      padding={'14px'}
      spacing={'18px'}
      spellCheck={false}
      inputMode="numeric"
      pattern="[0-9]*"
      autoComplete="one-time-code"
      onChange={({ currentTarget: input }) => {
        input.value = input.value.replace(/\D+/g, '');
        onSubmit({ code: input.value, input });
      }}
      renderSegment={(segment) => {
        const isCaret = focused && segment.state === 'cursor';
        const isSelection = focused && segment.state === 'selected';
        const isLoading = state === 'loading';
        const isSuccess = state === 'success';
        const isError = state === 'error';
        const isActive = isSuccess || isError || isSelection || isCaret;

        return (
          <div
            key={segment.index}
            data-state={state}
            className={cn(
              'border-input flex appearance-none rounded-md border [--segment-color:#a2e771] data-[state="error"]:[--segment-color:#dc2626] data-[state="success"]:[--segment-color:#a2e771]',
              {
                'shadow-[var(--segment-color)_0_0_0_1px] data-[state]:border-[var(--segment-color)]':
                  isActive,
                'animate-[pulse-border_1s_ease-in-out_0s_infinite]': isLoading,
              },
            )}
            style={{ width }}
          >
            <div
              className={cn({
                'm-[5px] flex-1 rounded-sm bg-[var(--segment-color)] opacity-[0.15625]':
                  isSelection,
                'mx-auto  my-2 flex-[0_0_2px] animate-[blink-caret_1.2s_step-end_infinite] justify-self-center bg-black':
                  isCaret,
              })}
            />
          </div>
        );
      }}
    />
  );
};

export { PinInput };
