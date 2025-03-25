import type { MessageDescriptor } from '@lingui/core';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { FileText } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { Link } from 'react-router';

import { APP_DOCUMENT_UPLOAD_SIZE_LIMIT, IS_BILLING_ENABLED } from '@documenso/lib/constants/app';
import { megabytesToBytes } from '@documenso/lib/universal/unit-convertions';

import { cn } from '../lib/utils';
import { Button } from './button';

export type DocumentDropzoneProps = {
  className?: string;
  disabled?: boolean;
  disabledMessage?: MessageDescriptor;
  onDrop?: (_file: File) => void | Promise<void>;
  onDropRejected?: () => void | Promise<void>;
  type?: 'document' | 'template';
  [key: string]: unknown;
};

export const DocumentDropzone = ({
  className,
  onDrop,
  onDropRejected,
  disabled,
  disabledMessage = msg`You cannot upload documents at this time.`,
  type = 'document',
  ...props
}: DocumentDropzoneProps) => {
  const { _ } = useLingui();

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
    onDropRejected: () => {
      if (onDropRejected) {
        void onDropRejected();
      }
    },
    maxSize: megabytesToBytes(APP_DOCUMENT_UPLOAD_SIZE_LIMIT),
  });

  const heading = {
    document: disabled ? msg`You have reached your document limit.` : msg`Add a document`,
    template: msg`Upload Template Document`,
  };

  return (
    <Button
      className={cn(
        'focus-visible:ring-ring ring-offset-background group flex flex-1 cursor-pointer flex-col items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
        className,
      )}
      variant="outline"
      aria-disabled={disabled}
      {...getRootProps()}
      {...props}
    >
      <div className="text-muted-foreground/40 flex flex-col items-center justify-center p-6">
        <input {...getInputProps()} />

        <p className="text-foreground flex items-center gap-2 font-medium">
          <FileText className="h-4 w-4" />
          {disabled ? _(disabledMessage) : _(heading[type])}
        </p>

        {disabled && IS_BILLING_ENABLED() && (
          <Button className="hover:bg-warning/80 bg-warning mt-4 w-32" asChild>
            <Link to="/settings/billing">
              <Trans>Upgrade</Trans>
            </Link>
          </Button>
        )}
      </div>
    </Button>
  );
};
