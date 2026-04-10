import { ZDocumentTitleSchema } from '@documenso/trpc/server/document-router/schema';
import { cn } from '@documenso/ui/lib/utils';
import { useEffect, useRef, useState } from 'react';

export type EnvelopeItemTitleInputProps = {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
  dataTestId?: string;
};

export const EnvelopeItemTitleInput = ({
  value,
  onChange,
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

  // Update input width based on content
  useEffect(() => {
    if (measureRef.current) {
      const width = measureRef.current.offsetWidth;
      setInputWidth(Math.max(width + 16, 100)); // Add padding and minimum width
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

  return (
    <div className="relative">
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
        disabled={disabled}
        style={{ width: `${inputWidth}px` }}
        className={cn(
          'rounded-sm border-0 bg-transparent p-1 font-medium text-foreground text-sm outline-none hover:outline hover:outline-1 hover:outline-muted-foreground focus:outline focus:outline-1 focus:outline-muted-foreground',
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
