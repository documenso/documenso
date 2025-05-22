import type { MessageDescriptor } from '@lingui/core';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { Upload } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { Link } from 'react-router';

import { useCurrentOrganisation } from '@documenso/lib/client-only/providers/organisation';
import { APP_DOCUMENT_UPLOAD_SIZE_LIMIT, IS_BILLING_ENABLED } from '@documenso/lib/constants/app';
import { megabytesToBytes } from '@documenso/lib/universal/unit-convertions';

import { Button } from './button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './tooltip';

export type DocumentDropzoneProps = {
  className?: string;
  disabled?: boolean;
  loading?: boolean;
  disabledMessage?: MessageDescriptor;
  onDrop?: (_file: File) => void | Promise<void>;
  onDropRejected?: () => void | Promise<void>;
  type?: 'document' | 'template';
  [key: string]: unknown;
};

export const DocumentDropzone = ({
  className,
  loading,
  onDrop,
  onDropRejected,
  disabled,
  disabledMessage = msg`You cannot upload documents at this time.`,
  type = 'document',
  ...props
}: DocumentDropzoneProps) => {
  const { _ } = useLingui();

  const organisation = useCurrentOrganisation();

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
    document: msg`Upload Document`,
    template: msg`Upload Template Document`,
  };

  if (disabled && IS_BILLING_ENABLED()) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button className="hover:bg-warning/80 bg-warning" asChild>
              <Link to={`/org/${organisation.url}/settings/billing`}>
                <Trans>Upgrade</Trans>
              </Link>
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p className="text-sm">{_(disabledMessage)}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <Button loading={loading} aria-disabled={disabled} {...getRootProps()} {...props}>
      <div className="flex items-center gap-2">
        <input {...getInputProps()} />
        {!loading && <Upload className="h-4 w-4" />}
        {disabled ? _(disabledMessage) : _(heading[type])}
      </div>
    </Button>
  );
};
