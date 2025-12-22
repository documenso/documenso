import type { HTMLAttributes } from 'react';
import { useState } from 'react';

import type { MessageDescriptor } from '@lingui/core';
import { Trans, useLingui } from '@lingui/react/macro';
import { motion } from 'framer-motion';

import { parseMessageDescriptor } from '@documenso/lib/utils/i18n';
import { Dialog, DialogClose, DialogContent, DialogFooter } from '@documenso/ui/primitives/dialog';

import { cn } from '../../lib/utils';
import { Button } from '../button';
import { SignaturePad } from './signature-pad';
import { SignatureRender } from './signature-render';

export type SignaturePadDialogProps = Omit<HTMLAttributes<HTMLCanvasElement>, 'onChange'> & {
  disabled?: boolean;
  fullName?: string;
  value?: string;
  onChange: (_value: string) => void;
  dialogConfirmText?: MessageDescriptor | string;
  disableAnimation?: boolean;
  typedSignatureEnabled?: boolean;
  uploadSignatureEnabled?: boolean;
  drawSignatureEnabled?: boolean;
};

export const SignaturePadDialog = ({
  className,
  fullName,
  value,
  onChange,
  disabled = false,
  disableAnimation = false,
  typedSignatureEnabled,
  uploadSignatureEnabled,
  drawSignatureEnabled,
  dialogConfirmText,
}: SignaturePadDialogProps) => {
  const { i18n } = useLingui();

  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [signature, setSignature] = useState<string>(value ?? '');

  return (
    <div
      className={cn(
        'relative block aspect-signature-pad w-full select-none rounded-lg border bg-background',
        className,
        {
          'pointer-events-none opacity-50': disabled,
        },
      )}
    >
      {value && (
        <div className="inset-0 h-full w-full">
          <SignatureRender value={value} />
        </div>
      )}

      <motion.button
        data-testid="signature-pad-dialog-button"
        type="button"
        disabled={disabled}
        className="absolute inset-0 flex items-center justify-center bg-transparent"
        onClick={() => setShowSignatureModal(true)}
        whileHover="onHover"
      >
        {!value && !disableAnimation && (
          <motion.svg
            width="120"
            height="120"
            viewBox="0 0 16 16"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="text-muted-foreground/60"
            variants={{
              onHover: {
                scale: 1.1,
                transition: {
                  type: 'spring',
                  stiffness: 300,
                  damping: 12,
                  mass: 0.8,
                  restDelta: 0.001,
                },
              },
            }}
          >
            <motion.path
              d="M1.5 11H14.5M1.5 14C1.5 14 8.72 2 4.86938 2H4.875C2.01 2 1.97437 14.0694 8 6.51188V6.5C8 6.5 9 11.3631 11.5 7.52375V7.5C11.5 7.5 11.5 9 14.5 9"
              stroke="currentColor"
              strokeWidth="1.1"
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{
                pathLength: 1,
                opacity: 1,
                transition: {
                  pathLength: {
                    duration: 2,
                    ease: 'easeInOut',
                  },
                  opacity: { duration: 0.6 },
                },
              }}
            />
          </motion.svg>
        )}
      </motion.button>

      <Dialog open={showSignatureModal} onOpenChange={disabled ? undefined : setShowSignatureModal}>
        <DialogContent hideClose={true} className="p-6 pt-4">
          <SignaturePad
            id="signature"
            fullName={fullName}
            value={value}
            className={className}
            disabled={disabled}
            onChange={({ value }) => setSignature(value)}
            typedSignatureEnabled={typedSignatureEnabled}
            uploadSignatureEnabled={uploadSignatureEnabled}
            drawSignatureEnabled={drawSignatureEnabled}
          />

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="ghost">
                <Trans>Cancel</Trans>
              </Button>
            </DialogClose>

            <Button
              type="button"
              disabled={!signature}
              onClick={() => {
                onChange(signature);
                setShowSignatureModal(false);
              }}
            >
              {dialogConfirmText ? (
                parseMessageDescriptor(i18n._, dialogConfirmText)
              ) : (
                <Trans>Next</Trans>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
