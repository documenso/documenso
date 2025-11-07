import type { MessageDescriptor } from '@lingui/core';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { Upload } from 'lucide-react';
import type { DropEvent, FileRejection } from 'react-dropzone';
import { useDropzone } from 'react-dropzone';
import { Link } from 'react-router';

import { useCurrentOrganisation } from '@documenso/lib/client-only/providers/organisation';
import { useSession } from '@documenso/lib/client-only/providers/session';
import { APP_DOCUMENT_UPLOAD_SIZE_LIMIT, IS_BILLING_ENABLED } from '@documenso/lib/constants/app';
import { megabytesToBytes } from '@documenso/lib/universal/unit-convertions';
import { isPersonalLayout } from '@documenso/lib/utils/organisations';

import { Button } from './button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './tooltip';

export type DocumentDropzoneProps = {
  className?: string;
  disabled?: boolean;
  loading?: boolean;
  disabledMessage?: MessageDescriptor;
  onDrop?: (_files: File[]) => void | Promise<void>;
  onDropRejected?: (fileRejections: FileRejection[], event: DropEvent) => void;
  type?: 'document' | 'template' | 'envelope';
  maxFiles?: number;
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
  maxFiles,
  ...props
}: DocumentDropzoneProps) => {
  const { _ } = useLingui();

  const { organisations } = useSession();

  const organisation = useCurrentOrganisation();

  const isPersonalLayoutMode = isPersonalLayout(organisations);

  const { getRootProps, getInputProps } = useDropzone({
    accept: {
      'application/pdf': ['.pdf'],
    },
    multiple: type === 'envelope',
    disabled,
    maxFiles,
    onDrop: (acceptedFiles) => {
      if (acceptedFiles.length > 0 && onDrop) {
        void onDrop(acceptedFiles);
      }
    },
    onDropRejected,
    maxSize: megabytesToBytes(APP_DOCUMENT_UPLOAD_SIZE_LIMIT),
  });

  const heading = {
    document: msg`Upload Document`,
    template: msg`Upload Template Document`,
    envelope: msg`Upload Envelope`,
  };

  if (disabled && IS_BILLING_ENABLED()) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button className="hover:bg-warning/80 bg-warning" asChild>
              <Link
                to={
                  isPersonalLayoutMode
                    ? `/settings/billing`
                    : `/o/${organisation.url}/settings/billing`
                }
              >
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
        <input data-testid="document-upload-input" {...getInputProps()} />
        {!loading && <Upload className="h-4 w-4" />}
        {disabled ? _(disabledMessage) : _(heading[type])}
      </div>
    </Button>
  );
};
