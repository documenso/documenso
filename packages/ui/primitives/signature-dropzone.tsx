'use client'

import { useDropzone } from 'react-dropzone';
import type { Variants } from 'framer-motion';
import { motion } from 'framer-motion';

import { megabytesToBytes } from "@documenso/lib/universal/unit-convertions";
import { Card, CardContent } from './card';
import { cn } from '../lib/utils';

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


export type SignatureDropzoneProps =  {
  className?: string;
  onDrop?: (_file: File) => void | Promise<void>;
  disabled?: boolean;
  disabledMessage?: string;
}

export const SignatureDropzone = ({
  className,
  onDrop,
  disabledMessage = 'You cannot upload a signature',
  ...props
}: SignatureDropzoneProps) => {

  const {getRootProps, getInputProps } = useDropzone({
    accept: {
      'image/png': ['.png'],
    },
    maxFiles: 1,
    onDrop: ([accceptedFile]) => {
      if (accceptedFile && onDrop) {
        void onDrop(accceptedFile);
      }
    },
    maxSize: megabytesToBytes(40),
  });

  return ( 
    <motion.div
      className={cn('flex aria-disabled:cursor-not-allowed', className)}
      variants={DocumentDropzoneContainerVariants}
      initial="initial"
      animate="animate"
      whileHover="hover"
    >
      <Card
        role="button"
        className='flex justify-center w-full border-0'
        degrees={120}
        {...props}
        {...getRootProps()}
      >
        <CardContent className="text-muted-foreground/40 flex flex-col items-center justify-center ">
          <input {...getInputProps()} />
          <p className="group-hover:text-foreground text-muted-foreground font-medium">
            Add a signature
          </p>

          <p className="text-muted-foreground/80 mt-1 text-sm">
            Drag & drop your signature here.
          </p>
        </CardContent>
      </Card>
    </motion.div>
  )
}
