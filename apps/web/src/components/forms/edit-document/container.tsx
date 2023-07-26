import React, { HTMLAttributes } from 'react';

import { Loader } from 'lucide-react';

import { cn } from '@documenso/ui/lib/utils';
import { Button } from '@documenso/ui/primitives/button';

export type EditDocumentFormContainerProps = HTMLAttributes<HTMLFormElement> & {
  children?: React.ReactNode;
};

export const EditDocumentFormContainer = ({
  children,
  id = 'edit-document-form',
  className,
  ...props
}: EditDocumentFormContainerProps) => {
  return (
    <form
      id={id}
      className={cn(
        'dark:bg-background border-border bg-widget flex-col sticky top-20 flex h-[calc(100vh-6rem)] max-h-screen rounded-xl border px-4 py-6',
        className,
      )}
      {...props}
    >
      <div className={cn('flex-col -mx-2 flex flex-1 overflow-hidden px-2')}>{children}</div>
    </form>
  );
};

export type EditDocumentFormContainerContentProps = HTMLAttributes<HTMLDivElement> & {
  title: string;
  description: string;
  children?: React.ReactNode;
};

export const EditDocumentFormContainerContent = ({
  children,
  title,
  description,
  className,
  ...props
}: EditDocumentFormContainerContentProps) => {
  return (
    <div className={cn('flex-col flex flex-1', className)} {...props}>
      <h3 className="text-foreground text-2xl font-semibold">{title}</h3>

      <p className="text-muted-foreground mt-2 text-sm">{description}</p>

      <hr className="border-border mb-8 mt-4" />

      <div className="flex-col -mx-2 flex flex-1 overflow-y-auto px-2">{children}</div>
    </div>
  );
};

export type EditDocumentFormContainerFooterProps = HTMLAttributes<HTMLDivElement> & {
  children?: React.ReactNode;
};

export const EditDocumentFormContainerFooter = ({
  children,
  className,
  ...props
}: EditDocumentFormContainerFooterProps) => {
  return (
    <div className={cn('mt-4 flex-shrink-0', className)} {...props}>
      {children}
    </div>
  );
};

export type EditDocumentFormContainerStepProps = {
  title: string;
  step: number;
  maxStep: number;
};

export const EditDocumentFormContainerStep = ({
  title,
  step,
  maxStep,
}: EditDocumentFormContainerStepProps) => {
  return (
    <div>
      <p className="text-muted-foreground text-sm">
        {title}{' '}
        <span>
          ({step}/{maxStep})
        </span>
      </p>

      <div className="bg-muted relative mt-4 h-[2px] rounded-md">
        <div
          className="bg-documenso absolute inset-y-0 left-0"
          style={{
            width: `${(100 / maxStep) * step}%`,
          }}
        />
      </div>
    </div>
  );
};

export type EditDocumentFormContainerActionsProps = {
  canGoBack?: boolean;
  canGoNext?: boolean;
  goNextLabel?: string;
  goBackLabel?: string;
  onGoBackClick?: () => void;
  onGoNextClick?: () => void;
  loading?: boolean;
  disabled?: boolean;
};

export const EditDocumentFormContainerActions = ({
  canGoBack = true,
  canGoNext = true,
  goNextLabel = 'Continue',
  goBackLabel = 'Go Back',
  onGoBackClick,
  onGoNextClick,
  loading,
  disabled,
}: EditDocumentFormContainerActionsProps) => {
  return (
    <div className="mt-4 flex gap-x-4">
      <Button
        type="button"
        className="dark:bg-muted dark:hover:bg-muted/80 flex-1 bg-black/5 hover:bg-black/10"
        size="lg"
        variant="secondary"
        disabled={disabled || loading || !canGoBack}
        onClick={onGoBackClick}
      >
        {goBackLabel}
      </Button>

      <Button
        type="button"
        className="bg-documenso flex-1"
        size="lg"
        disabled={disabled || loading || !canGoNext}
        onClick={onGoNextClick}
      >
        {loading && <Loader className="mr-2 h-5 w-5 animate-spin" />}
        {goNextLabel}
      </Button>
    </div>
  );
};
