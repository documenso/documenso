import { ZDocumentTitleSchema } from '@documenso/trpc/server/document-router/schema';
import { cn } from '@documenso/ui/lib/utils';
import { type KeyboardEvent, useEffect, useRef, useState } from 'react';

const MIN_INPUT_WIDTH = 100;
const INPUT_WIDTH_PADDING = 16;

export type EnvelopeItemTitleInputProps = {
  value: string;
  onChange: (value: string) => void;
  /**
   * Called when the user finishes editing (blur or Enter) with a valid title that differs from the
   * last committed one. Runs after any click that moved focus away has been handled.
   */
  onCommit?: (value: string) => void;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
  dataTestId?: string;
};

export const EnvelopeItemTitleInput = ({
  value,
  onChange,
  onCommit,
  className,
  placeholder,
  disabled,
  dataTestId,
}: EnvelopeItemTitleInputProps) => {
  const [envelopeItemTitle, setEnvelopeItemTitle] = useState(value);
  const [isError, setIsError] = useState(false);

  const [inputWidth, setInputWidth] = useState(200);
  const inputRef = useRef<HTMLInputElement>(null);
  const measureRef = useRef<HTMLSpanElement>(null);

  const committedTitleRef = useRef(value);
  const isPointerDownRef = useRef(false);

  const onCommitRef = useRef(onCommit);
  onCommitRef.current = onCommit;

  const isCommitEnabled = onCommit !== undefined;

  // Reflect external value changes, but never while the user is typing.
  useEffect(() => {
    if (document.activeElement === inputRef.current) {
      return;
    }

    setEnvelopeItemTitle(value);
    setIsError(false);
    committedTitleRef.current = value;
  }, [value]);

  useEffect(() => {
    if (!isCommitEnabled) {
      return;
    }

    const onPointerDown = () => {
      isPointerDownRef.current = true;
    };

    const onPointerUp = () => {
      isPointerDownRef.current = false;
    };

    window.addEventListener('pointerdown', onPointerDown, true);
    window.addEventListener('pointerup', onPointerUp, true);
    window.addEventListener('pointercancel', onPointerUp, true);

    return () => {
      window.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener('pointerup', onPointerUp, true);
      window.removeEventListener('pointercancel', onPointerUp, true);
    };
  }, [isCommitEnabled]);

  useEffect(() => {
    if (measureRef.current) {
      const width = measureRef.current.offsetWidth;
      const nextInputWidth = Math.max(width + INPUT_WIDTH_PADDING, MIN_INPUT_WIDTH);

      setInputWidth(nextInputWidth);
    }
  }, [envelopeItemTitle]);

  const handleTitleChange = (title: string) => {
    if (title === '') {
      setIsError(true);
    }

    setEnvelopeItemTitle(title);

    const parsedTitle = ZDocumentTitleSchema.safeParse(title);

    if (!parsedTitle.success) {
      setIsError(true);
      return;
    }

    setIsError(false);

    onChange(parsedTitle.data);
  };

  const handleBlur = () => {
    // Switching to another window blurs the input without ending the edit.
    if (!onCommitRef.current || !document.hasFocus()) {
      return;
    }

    const parsedTitle = ZDocumentTitleSchema.safeParse(envelopeItemTitle);

    if (!parsedTitle.success || parsedTitle.data === committedTitleRef.current) {
      return;
    }

    const title = parsedTitle.data;

    committedTitleRef.current = title;

    // A dialog opened mid-click would swallow the click that moved focus away.
    if (isPointerDownRef.current) {
      runAfterPointerRelease(() => onCommitRef.current?.(title));
      return;
    }

    onCommitRef.current(title);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (!isCommitEnabled || event.key !== 'Enter' || event.nativeEvent.isComposing) {
      return;
    }

    // Stops the rest of this key press from activating a button in whatever the commit opens.
    event.preventDefault();
    event.currentTarget.blur();
  };

  return (
    <div className="relative min-w-0 max-w-full shrink">
      {/* Hidden span to measure text width */}
      <span
        ref={measureRef}
        className="pointer-events-none absolute top-0 left-0 whitespace-nowrap font-medium text-gray-600 text-sm opacity-0"
        style={{ font: 'inherit' }}
      >
        {envelopeItemTitle || placeholder}
      </span>
      <input
        data-testid={dataTestId}
        data-1p-ignore
        autoComplete="off"
        ref={inputRef}
        type="text"
        value={envelopeItemTitle}
        onChange={(e) => handleTitleChange(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        style={{ width: `${inputWidth}px`, maxWidth: '100%' }}
        className={cn(
          'max-w-full rounded-sm border-0 bg-transparent p-1 font-medium text-foreground text-sm outline-none hover:outline hover:outline-1 hover:outline-muted-foreground focus:outline focus:outline-1 focus:outline-muted-foreground',
          className,
          {
            'outline-red-500': isError,
          },
        )}
        placeholder={placeholder}
      />
    </div>
  );
};

/**
 * Runs the callback once the current pointer press is released and the resulting click has been handled.
 */
const runAfterPointerRelease = (callback: () => void) => {
  const onRelease = () => {
    window.removeEventListener('pointerup', onRelease, true);
    window.removeEventListener('pointercancel', onRelease, true);

    setTimeout(callback, 0);
  };

  window.addEventListener('pointerup', onRelease, true);
  window.addEventListener('pointercancel', onRelease, true);
};
