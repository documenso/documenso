import { Loader } from 'lucide-react';

import { cn } from '@documenso/ui/lib/utils';

export const DocumentSigningFieldsLoader = () => {
  return (
    <div className="bg-background absolute inset-0 flex items-center justify-center rounded-md">
      <Loader className="text-primary h-5 w-5 animate-spin md:h-8 md:w-8" />
    </div>
  );
};

export const DocumentSigningFieldsUninserted = ({ children }: { children: React.ReactNode }) => {
  return (
    <p className="group-hover:text-primary text-foreground group-hover:text-recipient-green text-[clamp(0.425rem,25cqw,0.825rem)] duration-200">
      {children}
    </p>
  );
};

type DocumentSigningFieldsInsertedProps = {
  children: React.ReactNode;

  /**
   * The text alignment of the field.
   *
   * Defaults to left.
   */
  textAlign?: 'left' | 'center' | 'right';
};

export const DocumentSigningFieldsInserted = ({
  children,
  textAlign = 'left',
}: DocumentSigningFieldsInsertedProps) => {
  return (
    <div className="flex h-full w-full items-center">
      <p
        className={cn(
          'text-foreground w-full text-left text-[clamp(0.425rem,25cqw,0.825rem)] duration-200',
          {
            '!text-center': textAlign === 'center',
            '!text-right': textAlign === 'right',
          },
        )}
      >
        {children}
      </p>
    </div>
  );
};
