'use client';

import { Variants, motion } from 'framer-motion';
import { Plus } from 'lucide-react';
import { useDropzone } from 'react-dropzone';

import { cn } from '@documenso/ui/lib/utils';
import { Card, CardContent } from '@documenso/ui/primitives/card';

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

export type DocumentDropzoneProps = {
  className?: string;
  disabled?: boolean;
  onDrop?: (_file: File) => void | Promise<void>;
  [key: string]: unknown;
};

export const DocumentDropzone = ({
  className,
  onDrop,
  disabled,
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
  });

  return (
    <motion.div
      className={cn('flex', className)}
      variants={DocumentDropzoneContainerVariants}
      initial="initial"
      animate="animate"
      whileHover="hover"
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
              className="border-muted-foreground/20 group-hover:border-documenso/80 dark:bg-muted/80 z-10 flex aspect-[3/4] w-24 origin-top-right -rotate-[22deg] flex-col gap-y-1 rounded-lg border bg-white/80 px-2 py-4 backdrop-blur-sm"
              variants={DocumentDropzoneCardLeftVariants}
            >
              <div className="bg-muted-foreground/20 group-hover:bg-documenso h-2 w-full rounded-[2px]" />
              <div className="bg-muted-foreground/20 group-hover:bg-documenso h-2 w-5/6 rounded-[2px]" />
              <div className="bg-muted-foreground/20 group-hover:bg-documenso h-2 w-full rounded-[2px]" />
            </motion.div>

            <motion.div
              className="border-muted-foreground/20 group-hover:border-documenso/80 dark:bg-muted/80 z-20 flex aspect-[3/4] w-24 flex-col items-center justify-center gap-y-1 rounded-lg border bg-white/80 px-2 py-4 backdrop-blur-sm"
              variants={DocumentDropzoneCardCenterVariants}
            >
              <Plus
                strokeWidth="2px"
                className="text-muted-foreground/20 group-hover:text-documenso h-12 w-12"
              />
            </motion.div>

            <motion.div
              className="border-muted-foreground/20 group-hover:border-documenso/80 dark:bg-muted/80 z-10 flex aspect-[3/4] w-24 origin-top-left rotate-[22deg] flex-col gap-y-1 rounded-lg border bg-white/80 px-2 py-4 backdrop-blur-sm"
              variants={DocumentDropzoneCardRightVariants}
            >
              <div className="bg-muted-foreground/20 group-hover:bg-documenso h-2 w-full rounded-[2px]" />
              <div className="bg-muted-foreground/20 group-hover:bg-documenso h-2 w-5/6 rounded-[2px]" />
              <div className="bg-muted-foreground/20 group-hover:bg-documenso h-2 w-full rounded-[2px]" />
            </motion.div>
          </div>

          <input {...getInputProps()} />

          <p className="group-hover:text-foreground text-muted-foreground mt-8 font-medium">
            Add a document
          </p>

          <p className="text-muted-foreground/80 mt-1 text-sm ">Drag & drop your document here.</p>
        </CardContent>
      </Card>
    </motion.div>
  );
};
