import type { MessageDescriptor } from '@lingui/core';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { motion } from 'framer-motion';
import { AlertTriangle, Plus } from 'lucide-react';
import type { FileRejection } from 'react-dropzone';
import { useDropzone } from 'react-dropzone';
import { Link } from 'react-router';

import { useCurrentOrganisation } from '@documenso/lib/client-only/providers/organisation';
import { APP_DOCUMENT_UPLOAD_SIZE_LIMIT, IS_BILLING_ENABLED } from '@documenso/lib/constants/app';
import { megabytesToBytes } from '@documenso/lib/universal/unit-convertions';

import {
  DocumentDropzoneCardCenterVariants,
  DocumentDropzoneCardLeftVariants,
  DocumentDropzoneCardRightVariants,
  DocumentDropzoneContainerVariants,
  DocumentDropzoneDisabledCardCenterVariants,
  DocumentDropzoneDisabledCardLeftVariants,
  DocumentDropzoneDisabledCardRightVariants,
} from '../lib/document-dropzone-constants';
import { cn } from '../lib/utils';
import { Button } from './button';
import { Card, CardContent } from './card';

export type DocumentDropzoneProps = {
  className?: string;
  allowMultiple?: boolean;
  disabled?: boolean;
  disabledHeading?: MessageDescriptor;
  disabledMessage?: MessageDescriptor;
  onDrop?: (_file: File[]) => void | Promise<void>;
  onDropRejected?: (fileRejections: FileRejection[]) => void;
  type?: 'document' | 'template';
  maxFiles?: number;
  [key: string]: unknown;
};

export const DocumentDropzone = ({
  className,
  allowMultiple,
  onDrop,
  onDropRejected,
  disabled,
  disabledHeading,
  disabledMessage = msg`You cannot upload documents at this time.`,
  type = 'document',
  maxFiles,
  ...props
}: DocumentDropzoneProps) => {
  const { _ } = useLingui();

  const organisation = useCurrentOrganisation();

  const { getRootProps, getInputProps } = useDropzone({
    accept: {
      'application/pdf': ['.pdf'],
    },
    multiple: allowMultiple,
    disabled,
    onDrop: (acceptedFiles) => {
      if (acceptedFiles.length > 0 && onDrop) {
        void onDrop(acceptedFiles);
      }
    },
    onDropRejected,
    maxFiles,
    maxSize: megabytesToBytes(APP_DOCUMENT_UPLOAD_SIZE_LIMIT),
  });

  const heading = {
    document: disabled
      ? disabledHeading || msg`You have reached your document limit.`
      : msg`Add a document`,
    template: msg`Upload Template Document`,
  };

  return (
    <motion.div
      variants={DocumentDropzoneContainerVariants}
      initial="initial"
      animate="animate"
      whileHover="hover"
    >
      <Card
        role="button"
        className={cn(
          'group flex flex-1 cursor-pointer flex-col items-center justify-center ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          className,
        )}
        gradient={!disabled}
        degrees={120}
        aria-disabled={disabled}
        {...getRootProps()}
        {...props}
      >
        <CardContent className="flex flex-col items-center justify-center p-6 text-muted-foreground/40">
          {disabled ? (
            // Disabled State
            <div className="flex">
              <motion.div
                className="group-hover:bg-destructive/2 a z-10 flex aspect-[3/4] w-24 origin-top-right -rotate-[22deg] flex-col gap-y-1 rounded-lg border border-muted-foreground/20 bg-white/80 px-2 py-4 backdrop-blur-sm group-hover:border-destructive/10 dark:bg-muted/80"
                variants={DocumentDropzoneDisabledCardLeftVariants}
              >
                <div className="h-2 w-full rounded-[2px] bg-muted-foreground/10 group-hover:bg-destructive/10" />
                <div className="h-2 w-5/6 rounded-[2px] bg-muted-foreground/10 group-hover:bg-destructive/10" />
                <div className="h-2 w-full rounded-[2px] bg-muted-foreground/10 group-hover:bg-destructive/10" />
              </motion.div>
              <motion.div
                className="z-20 flex aspect-[3/4] w-24 flex-col items-center justify-center gap-y-1 rounded-lg border border-muted-foreground/20 bg-white/80 px-2 py-4 backdrop-blur-sm group-hover:border-destructive/50 group-hover:bg-destructive/5 dark:bg-muted/80"
                variants={DocumentDropzoneDisabledCardCenterVariants}
              >
                <AlertTriangle
                  strokeWidth="2px"
                  className="h-12 w-12 text-muted-foreground/20 group-hover:text-destructive"
                />
              </motion.div>
              <motion.div
                className="group-hover:bg-destructive/2 z-10 flex aspect-[3/4] w-24 origin-top-left rotate-[22deg] flex-col gap-y-1 rounded-lg border border-muted-foreground/20 bg-white/80 px-2 py-4 backdrop-blur-sm group-hover:border-destructive/10 dark:bg-muted/80"
                variants={DocumentDropzoneDisabledCardRightVariants}
              >
                <div className="h-2 w-full rounded-[2px] bg-muted-foreground/10 group-hover:bg-destructive/10" />
                <div className="h-2 w-5/6 rounded-[2px] bg-muted-foreground/10 group-hover:bg-destructive/10" />
                <div className="h-2 w-full rounded-[2px] bg-muted-foreground/10 group-hover:bg-destructive/10" />
              </motion.div>
            </div>
          ) : (
            // Non Disabled State
            <div className="flex">
              <motion.div
                className="a z-10 flex aspect-[3/4] w-24 origin-top-right -rotate-[22deg] flex-col gap-y-1 rounded-lg border border-muted-foreground/20 bg-white/80 px-2 py-4 backdrop-blur-sm group-hover:border-brand/80 dark:bg-muted/80"
                variants={DocumentDropzoneCardLeftVariants}
              >
                <div className="h-2 w-full rounded-[2px] bg-muted-foreground/20 group-hover:bg-brand" />
                <div className="h-2 w-5/6 rounded-[2px] bg-muted-foreground/20 group-hover:bg-brand" />
                <div className="h-2 w-full rounded-[2px] bg-muted-foreground/20 group-hover:bg-brand" />
              </motion.div>
              <motion.div
                className="z-20 flex aspect-[3/4] w-24 flex-col items-center justify-center gap-y-1 rounded-lg border border-muted-foreground/20 bg-white/80 px-2 py-4 backdrop-blur-sm group-hover:border-brand/80 dark:bg-muted/80"
                variants={DocumentDropzoneCardCenterVariants}
              >
                <Plus
                  strokeWidth="2px"
                  className="h-12 w-12 text-muted-foreground/20 group-hover:text-brand"
                />
              </motion.div>
              <motion.div
                className="z-10 flex aspect-[3/4] w-24 origin-top-left rotate-[22deg] flex-col gap-y-1 rounded-lg border border-muted-foreground/20 bg-white/80 px-2 py-4 backdrop-blur-sm group-hover:border-brand/80 dark:bg-muted/80"
                variants={DocumentDropzoneCardRightVariants}
              >
                <div className="h-2 w-full rounded-[2px] bg-muted-foreground/20 group-hover:bg-brand" />
                <div className="h-2 w-5/6 rounded-[2px] bg-muted-foreground/20 group-hover:bg-brand" />
                <div className="h-2 w-full rounded-[2px] bg-muted-foreground/20 group-hover:bg-brand" />
              </motion.div>
            </div>
          )}

          <input {...getInputProps()} />

          <p className="mt-6 font-medium text-foreground">{_(heading[type])}</p>

          <p className="mt-1 text-center text-sm text-muted-foreground/80">
            {_(disabled ? disabledMessage : msg`Drag & drop your PDF here.`)}
          </p>

          {disabled && IS_BILLING_ENABLED() && (
            <Button className="mt-4 w-32 bg-warning hover:bg-warning/80" asChild>
              <Link to={`/o/${organisation.url}/settings/billing`}>
                <Trans>Upgrade</Trans>
              </Link>
            </Button>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
};
