import React from 'react';

import { cn } from '@documenso/ui/lib/utils';

type SlideProps = {
  selected: boolean;
  index: number;
  onClick: () => void;
  label: string;
};

export const Slide: React.FC<SlideProps> = (props) => {
  const { selected, label, onClick } = props;

  return (
    <button
      onClick={onClick}
      type="button"
      className={cn(
        'text-muted-foreground dark:text-muted-foreground/60 border-b-2 border-transparent py-1 text-xs sm:py-4 sm:text-base',
        {
          'border-primary text-foreground dark:text-muted-foreground border-b-2': selected,
        },
      )}
    >
      {label}
    </button>
  );
};
