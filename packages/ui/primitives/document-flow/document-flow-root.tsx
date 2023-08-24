'use client';

import React, { HTMLAttributes } from 'react';

import { Loader } from 'lucide-react';

import { cn } from '@documenso/ui/lib/utils';
import { Button } from '@documenso/ui/primitives/button';

export type DocumentFlowFormContainerProps = HTMLAttributes<HTMLFormElement> & {
  children?: React.ReactNode;
};

export const DocumentFlowFormContainer = ({
  children,
  id = 'edit-document-form',
  className,
  ...props
}: DocumentFlowFormContainerProps) => {
  return (
    <form
      id={id}
      className={cn(
        'dark:bg-background border-border bg-widget sticky top-20 flex h-[calc(100vh-6rem)] max-h-screen flex-col rounded-xl border px-4 py-6',
        className,
      )}
      {...props}
    >
      <div className={cn('-mx-2 flex flex-1 flex-col overflow-hidden px-2')}>{children}</div>
    </form>
  );
};

export type DocumentFlowFormContainerContentProps = HTMLAttributes<HTMLDivElement> & {
  title: string;
  description: string;
  children?: React.ReactNode;
};

export const DocumentFlowFormContainerContent = ({
  children,
  title,
  description,
  className,
  ...props
}: DocumentFlowFormContainerContentProps) => {
  return (
    <div className={cn('flex flex-1 flex-col', className)} {...props}>
      <h3 className="text-foreground text-2xl font-semibold">{title}</h3>

      <p className="text-muted-foreground mt-2 text-sm">{description}</p>

      <hr className="border-border mb-8 mt-4" />

      <div className="-mx-2 flex flex-1 flex-col overflow-y-auto px-2">{children}</div>
    </div>
  );
};

export type DocumentFlowFormContainerFooterProps = HTMLAttributes<HTMLDivElement> & {
  children?: React.ReactNode;
};

export const DocumentFlowFormContainerFooter = ({
  children,
  className,
  ...props
}: DocumentFlowFormContainerFooterProps) => {
  return (
    <div className={cn('mt-4 flex-shrink-0', className)} {...props}>
      {children}
    </div>
  );
};

export type DocumentFlowFormContainerStepProps = {
  title: string;
  step: number;
  maxStep: number;
};

export const DocumentFlowFormContainerStep = ({
  title,
  step,
  maxStep,
}: DocumentFlowFormContainerStepProps) => {
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

export type DocumentFlowFormContainerActionsProps = {
  canGoBack?: boolean;
  canGoNext?: boolean;
  goNextLabel?: string;
  goBackLabel?: string;
  onGoBackClick?: () => void;
  onGoNextClick?: () => void;
  loading?: boolean;
  disabled?: boolean;
};

export const DocumentFlowFormContainerActions = ({
  canGoBack = true,
  canGoNext = true,
  goNextLabel = 'Continue',
  goBackLabel = 'Go Back',
  onGoBackClick,
  onGoNextClick,
  loading,
  disabled,
}: DocumentFlowFormContainerActionsProps) => {
  return (
    <div className="mt-4 flex gap-x-4">
      <Button
        type="button"
        className="dark:bg-muted dark:hover:bg-muted/80 flex-1 bg-black/5 hover:bg-black/10"
        size="lg"
        variant="secondary"
        disabled={disabled || loading || !canGoBack}
        onClick={onGoBackClick}
        aria-label={goBackLabel}
      >
        {goBackLabel}
      </Button>

      <Button
        type="button"
        className="bg-documenso flex-1"
        size="lg"
        disabled={disabled || loading || !canGoNext}
        onClick={onGoNextClick}
        aria-label={goNextLabel}
      >
        {loading && <Loader className="mr-2 h-5 w-5 animate-spin" />}
        {goNextLabel}
      </Button>
    </div>
  );
};
