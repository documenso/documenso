import { useState } from 'react';

import { motion } from 'framer-motion';
import { AnimatePresence } from 'framer-motion';
import { CheckSquareIcon, CopyIcon } from 'lucide-react';

import { useCopyToClipboard } from '@documenso/lib/client-only/hooks/use-copy-to-clipboard';
import { Button } from '@documenso/ui/primitives/button';

import { cn } from '../../lib/utils';

export type CopyTextButtonProps = {
  value: string;
  badgeContentUncopied?: React.ReactNode;
  badgeContentCopied?: React.ReactNode;
  onCopySuccess?: () => void;
};

export const CopyTextButton = ({
  value,
  onCopySuccess,
  badgeContentUncopied,
  badgeContentCopied,
}: CopyTextButtonProps) => {
  const [, copy] = useCopyToClipboard();

  const [copiedTimeout, setCopiedTimeout] = useState<NodeJS.Timeout | null>(null);

  const onCopy = async () => {
    await copy(value).then(() => onCopySuccess?.());

    if (copiedTimeout) {
      clearTimeout(copiedTimeout);
    }

    setCopiedTimeout(
      setTimeout(() => {
        setCopiedTimeout(null);
      }, 2000),
    );
  };

  return (
    <Button
      type="button"
      variant="none"
      className="ml-2 h-7 rounded border bg-neutral-50 px-0.5 font-normal dark:border dark:border-neutral-500 dark:bg-neutral-600"
      onClick={async () => onCopy()}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          className="flex flex-row items-center"
          key={copiedTimeout ? 'copied' : 'copy'}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.1 } }}
        >
          {copiedTimeout ? badgeContentCopied : badgeContentUncopied}

          <div
            className={cn(
              'flex h-6 w-6 items-center justify-center rounded transition-all hover:bg-neutral-200 hover:active:bg-neutral-300 dark:hover:bg-neutral-500 dark:hover:active:bg-neutral-400',
              {
                'ml-1': Boolean(badgeContentCopied || badgeContentUncopied),
              },
            )}
          >
            <div className="absolute">
              {copiedTimeout ? (
                <CheckSquareIcon className="h-3.5 w-3.5" />
              ) : (
                <CopyIcon className="h-3.5 w-3.5" />
              )}
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </Button>
  );
};
