'use client';

import type { Variants } from 'framer-motion';
import { motion } from 'framer-motion';
import { Plus } from 'lucide-react';
import { useDropzone } from 'react-dropzone';

import { megabytesToBytes } from '@documenso/lib/universal/unit-convertions';

import { cn } from '../lib/utils';
import { Card, CardContent } from './card';

const DocumentDropzoneContainerVariants: Variants = {
  initial: {
    scale: 1,
  },
  animate: {
    scale: 1,
  },
  hover: {
    transition: {
      staggerChildren: 0.05,
    },
  },
};

const DocumentDropzoneCardLeftVariants: Variants = {
  initial: {
    x: 40,
    y: -10,
    rotate: -14,
  },
  animate: {
    x: 40,
    y: -10,
    rotate: -14,
  },
  hover: {
    x: -25,
    y: -25,
    rotate: -22,
  },
};

const DocumentDropzoneCardRightVariants: Variants = {
  initial: {
    x: -40,
    y: -10,
    rotate: 14,
  },
  animate: {
    x: -40,
    y: -10,
    rotate: 14,
  },
  hover: {
    x: 25,
    y: -25,
    rotate: 22,
  },
};

const DocumentDropzoneCardCenterVariants: Variants = {
  initial: {
    x: 0,
    y: 0,
  },
  animate: {
    x: 0,
    y: 0,
  },
  hover: {
    x: 0,
    y: -25,
  },
};

const DocumentDescription = {
  document: {
    headline: 'Add a document',
  },
  template: {
    headline: 'Upload Template Document',
  },
};

export type DocumentDropzoneProps = {
  className?: string;
  disabled?: boolean;
  disabledMessage?: string;
  onDrop?: (_file: File) => void | Promise<void>;
  type?: 'document' | 'template';
  [key: string]: unknown;
};

export const DocumentDropzone = ({
  className,
  onDrop,
  disabled,
  disabledMessage = 'You cannot upload documents at this time.',
  type = 'document',
  ...props
}: DocumentDropzoneProps) => {
  const { getRootProps, getInputProps } = useDropzone({
    accept: {
      'application/pdf': ['.pdf'],
    },
    multiple: false,
    disabled,
    onDrop: ([acceptedFile]) => {
      if (acceptedFile && onDrop) {
        void onDrop(acceptedFile);
      }
    },
    maxSize: megabytesToBytes(50),
  });

  return (
    <motion.div
      className={cn('flex aria-disabled:cursor-not-allowed', className)}
      variants={DocumentDropzoneContainerVariants}
      initial="initial"
      animate="animate"
      whileHover="hover"
      aria-disabled={disabled}
    >
      <Card
        role="button"
        className={cn(
          'focus-visible:ring-ring ring-offset-background flex flex-1 cursor-pointer flex-col items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 aria-disabled:pointer-events-none aria-disabled:opacity-60',
          className,
        )}
        gradient={true}
        degrees={120}
        aria-disabled={disabled}
        {...getRootProps()}
        {...props}
      >
        <CardContent className="text-muted-foreground/40 flex flex-col items-center justify-center p-6">
          {/* <FilePlus strokeWidth="1px" className="h-16 w-16"/> */}
          <div className="flex">
            <motion.div
              className="border-muted-foreground/20 group-hover:border-documenso/80 dark:bg-muted/80 a z-10 flex aspect-[3/4] w-24 origin-top-right -rotate-[22deg] flex-col gap-y-1 rounded-lg border bg-white/80 px-2 py-4 backdrop-blur-sm"
              variants={!disabled ? DocumentDropzoneCardLeftVariants : undefined}
            >
              <div className="bg-muted-foreground/20 group-hover:bg-documenso h-2 w-full rounded-[2px]" />
              <div className="bg-muted-foreground/20 group-hover:bg-documenso h-2 w-5/6 rounded-[2px]" />
              <div className="bg-muted-foreground/20 group-hover:bg-documenso h-2 w-full rounded-[2px]" />
            </motion.div>

            <motion.div
              className="border-muted-foreground/20 group-hover:border-documenso/80 dark:bg-muted/80 z-20 flex aspect-[3/4] w-24 flex-col items-center justify-center gap-y-1 rounded-lg border bg-white/80 px-2 py-4 backdrop-blur-sm"
              variants={!disabled ? DocumentDropzoneCardCenterVariants : undefined}
            >
              <Plus
                strokeWidth="2px"
                className="text-muted-foreground/20 group-hover:text-documenso h-12 w-12"
              />
            </motion.div>

            <motion.div
              className="border-muted-foreground/20 group-hover:border-documenso/80 dark:bg-muted/80 z-10 flex aspect-[3/4] w-24 origin-top-left rotate-[22deg] flex-col gap-y-1 rounded-lg border bg-white/80 px-2 py-4 backdrop-blur-sm"
              variants={!disabled ? DocumentDropzoneCardRightVariants : undefined}
            >
              <div className="bg-muted-foreground/20 group-hover:bg-documenso h-2 w-full rounded-[2px]" />
              <div className="bg-muted-foreground/20 group-hover:bg-documenso h-2 w-5/6 rounded-[2px]" />
              <div className="bg-muted-foreground/20 group-hover:bg-documenso h-2 w-full rounded-[2px]" />
            </motion.div>
          </div>

          <input {...getInputProps()} />

          <p className="group-hover:text-foreground text-muted-foreground mt-8 font-medium">
            {DocumentDescription[type].headline}
          </p>

          <p className="text-muted-foreground/80 mt-1 text-sm">
            {disabled ? disabledMessage : 'Drag & drop your document here.'}
          </p>
        </CardContent>
      </Card>
    </motion.div>
  );
};
