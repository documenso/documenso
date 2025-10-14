import { useEffect, useRef, useState } from 'react';

import { ZDocumentTitleSchema } from '@documenso/trpc/server/document-router/schema';
import { cn } from '@documenso/ui/lib/utils';

export type EnvelopeItemTitleInputProps = {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
};

export const EnvelopeItemTitleInput = ({
  value,
  onChange,
  className,
  placeholder,
  disabled,
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
        className="pointer-events-none absolute left-0 top-0 whitespace-nowrap text-sm font-medium text-gray-600 opacity-0"
        style={{ font: 'inherit' }}
      >
        {envelopeItemTitle || placeholder}
      </span>
      <input
        data-1p-ignore
        autoComplete="off"
        ref={inputRef}
        type="text"
        value={envelopeItemTitle}
        onChange={(e) => handleTitleChange(e.target.value)}
        disabled={disabled}
        style={{ width: `${inputWidth}px` }}
        className={cn(
          'text-foreground hover:outline-muted-foreground focus:outline-muted-foreground rounded-sm border-0 bg-transparent p-1 text-sm font-medium outline-none hover:outline hover:outline-1 focus:outline focus:outline-1',
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
