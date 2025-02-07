import type { HTMLAttributes } from 'react';
import React from 'react';

import type { MessageDescriptor } from '@lingui/core';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
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
  title: MessageDescriptor;
  description: MessageDescriptor;
};

export const DocumentFlowFormContainerHeader = ({
  title,
  description,
}: DocumentFlowFormContainerHeaderProps) => {
  const { _ } = useLingui();

  return (
    <>
      <h3 className="text-foreground text-2xl font-semibold">{_(title)}</h3>

      <p className="text-muted-foreground mt-2 text-sm">{_(description)}</p>

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
        <Trans>
          Step <span>{`${step} of ${maxStep}`}</span>
        </Trans>
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
  goNextLabel?: MessageDescriptor;
  goBackLabel?: MessageDescriptor;
  onGoBackClick?: () => void;
  onGoNextClick?: () => void;
  loading?: boolean;
  disabled?: boolean;
  disableNextStep?: boolean;
};

export const DocumentFlowFormContainerActions = ({
  canGoBack = true,
  canGoNext = true,
  goNextLabel = msg`Continue`,
  goBackLabel = msg`Go Back`,
  onGoBackClick,
  onGoNextClick,
  loading,
  disabled,
  disableNextStep = false,
}: DocumentFlowFormContainerActionsProps) => {
  const { _ } = useLingui();
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
        {_(goBackLabel)}
      </Button>

      <Button
        type="button"
        className="bg-documenso flex-1"
        size="lg"
        disabled={disabled || disableNextStep || loading || !canGoNext}
        loading={loading}
        onClick={onGoNextClick}
      >
        {_(goNextLabel)}
      </Button>
    </div>
  );
};
