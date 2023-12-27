'use client';

import type { HTMLAttributes } from 'react';
import React from 'react';

import { motion } from 'framer-motion';

import { cn } from '../../lib/utils';
import { Button } from '../button';

export type DocumentFlowFormContainerProps = HTMLAttributes<HTMLFormElement> & {
  children?: React.ReactNode;
};

export const DocumentFlowFormContainer = ({
  children,
  id = 'document-flow-form-container',
  className,
  ...props
}: DocumentFlowFormContainerProps) => {
  return (
    <form
      id={id}
      className={cn(
        'dark:bg-background border-border bg-widget sticky top-20 flex h-full max-h-[64rem] flex-col overflow-auto rounded-xl border px-4 py-6',
        className,
      )}
      {...props}
    >
      <div className={cn('-mx-2 flex flex-1 flex-col px-2')}>{children}</div>
    </form>
  );
};

export type DocumentFlowFormContainerHeaderProps = {
  title: string;
  description: string;
};

export const DocumentFlowFormContainerHeader = ({
  title,
  description,
}: DocumentFlowFormContainerHeaderProps) => {
  return (
    <>
      <h3 className="text-foreground text-2xl font-semibold">{title}</h3>

      <p className="text-muted-foreground mt-2 text-sm">{description}</p>

      <hr className="border-border mb-8 mt-4" />
    </>
  );
};

export type DocumentFlowFormContainerContentProps = HTMLAttributes<HTMLDivElement> & {
  children?: React.ReactNode;
};

export const DocumentFlowFormContainerContent = ({
  children,
  className,
  ...props
}: DocumentFlowFormContainerContentProps) => {
  return (
    <div
      className={cn('custom-scrollbar -mx-2 flex flex-1 flex-col overflow-hidden px-2', className)}
      {...props}
    >
      <div className="flex flex-1 flex-col">{children}</div>
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
  step,
  maxStep,
}: DocumentFlowFormContainerStepProps) => {
  return (
    <div>
      <p className="text-muted-foreground text-sm">
        Step <span>{`${step} of ${maxStep}`}</span>
      </p>

      <div className="bg-muted relative mt-4 h-[2px] rounded-md">
        <motion.div
          layout="size"
          layoutId="document-flow-container-step"
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
        disabled={disabled || loading || !canGoBack || !onGoBackClick}
        onClick={onGoBackClick}
      >
        {goBackLabel}
      </Button>

      <Button
        type="button"
        className="bg-documenso flex-1"
        size="lg"
        disabled={disabled || loading || !canGoNext}
        loading={loading}
        onClick={onGoNextClick}
      >
        {goNextLabel}
      </Button>
    </div>
  );
};
