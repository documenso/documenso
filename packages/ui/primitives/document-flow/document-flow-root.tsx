'use client';

import type { HTMLAttributes } from 'react';
import React from 'react';

import { cn } from '@documenso/ui/lib/utils';

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
        'dark:bg-background border-border bg-widget sticky top-20 flex h-full max-h-[64rem] flex-col rounded-xl border px-4 py-6',
        className,
      )}
      {...props}
    >
      <div className={cn('-mx-2 flex flex-1 flex-col overflow-hidden px-2')}>{children}</div>
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
      className={cn(
        'custom-scrollbar -mx-2 flex flex-1 flex-col overflow-y-auto overflow-x-hidden px-2',
        className,
      )}
      {...props}
    >
      <div className="flex flex-1 flex-col">{children}</div>
    </div>
  );
};
