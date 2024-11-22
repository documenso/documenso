import { useLingui } from '@lingui/react';
import { AnimatePresence, motion } from 'framer-motion';

import { cn } from '../../lib/utils';

export type FormErrorMessageProps = {
  className?: string;
  error: { message?: string } | undefined | unknown;
};

const isErrorWithMessage = (error: unknown): error is { message?: string } => {
  return typeof error === 'object' && error !== null && 'message' in error;
};

export const FormErrorMessage = ({ error, className }: FormErrorMessageProps) => {
  const { i18n } = useLingui();

  let errorMessage = isErrorWithMessage(error) ? error.message : '';

  // Checks to see if there's a translation for the string, since we're passing IDs for Zod errors.
  if (typeof errorMessage === 'string' && i18n.t(errorMessage)) {
    errorMessage = i18n.t(errorMessage);
  }

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
          {errorMessage}
        </motion.p>
      )}
    </AnimatePresence>
  );
};
