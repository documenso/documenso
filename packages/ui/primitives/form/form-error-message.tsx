import { AnimatePresence, motion } from 'framer-motion';

import { cn } from '@documenso/ui/lib/utils';

export type FormErrorMessageProps = {
  className?: string;
  error: { message?: string } | undefined | unknown;
};

const isErrorWithMessage = (error: unknown): error is { message?: string } => {
  return typeof error === 'object' && error !== null && 'message' in error;
};

export const FormErrorMessage = ({ error, className }: FormErrorMessageProps) => {
  return (
    <AnimatePresence>
      {isErrorWithMessage(error) && (
        <motion.p
          initial={{
            opacity: 0,
            y: -10,
          }}
          animate={{
            opacity: 1,
            y: 0,
          }}
          exit={{
            opacity: 0,
            y: 10,
          }}
          className={cn('text-xs text-red-500', className)}
        >
          {error.message}
        </motion.p>
      )}
    </AnimatePresence>
  );
};
