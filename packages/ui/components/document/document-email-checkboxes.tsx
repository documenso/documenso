import { Trans } from '@lingui/react/macro';
import { InfoIcon } from 'lucide-react';

import type { TDocumentEmailSettings } from '@documenso/lib/types/document-email';
import { DocumentEmailEvents } from '@documenso/lib/types/document-email';
import { Tooltip, TooltipContent, TooltipTrigger } from '@documenso/ui/primitives/tooltip';

import { cn } from '../../lib/utils';
import { Checkbox } from '../../primitives/checkbox';

type Value = TDocumentEmailSettings;

type DocumentEmailCheckboxesProps = {
  value: Value;
  onChange: (value: Value) => void;
  className?: string;
};

export const DocumentEmailCheckboxes = ({
  value,
  onChange,
  className,
}: DocumentEmailCheckboxesProps) => {
  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex flex-row items-center">
        <Checkbox
          id={DocumentEmailEvents.RecipientSigned}
          className="h-5 w-5"
          checked={value.recipientSigned}
          onCheckedChange={(checked) =>
            onChange({ ...value, [DocumentEmailEvents.RecipientSigned]: Boolean(checked) })
          }
        />

        <label
          className="ml-2 flex flex-row items-center text-sm text-muted-foreground"
          htmlFor={DocumentEmailEvents.RecipientSigned}
        >
          <Trans>Email the owner when a recipient signs</Trans>

          <Tooltip>
            <TooltipTrigger>
              <InfoIcon className="mx-2 h-4 w-4" />
            </TooltipTrigger>

            <TooltipContent className="max-w-md space-y-2 p-4 text-foreground">
              <h2>
                <strong>
                  <Trans>Recipient signed email</Trans>
                </strong>
              </h2>

              <p>
                <Trans>
                  This email is sent to the document owner when a recipient has signed the document.
                </Trans>
              </p>
            </TooltipContent>
          </Tooltip>
        </label>
      </div>

      <div className="flex flex-row items-center">
        <Checkbox
          id={DocumentEmailEvents.RecipientSigningRequest}
          className="h-5 w-5"
          checked={value.recipientSigningRequest}
          onCheckedChange={(checked) =>
            onChange({ ...value, [DocumentEmailEvents.RecipientSigningRequest]: Boolean(checked) })
          }
        />

        <label
          className="ml-2 flex flex-row items-center text-sm text-muted-foreground"
          htmlFor={DocumentEmailEvents.RecipientSigningRequest}
        >
          <Trans>Email recipients with a signing request</Trans>

          <Tooltip>
            <TooltipTrigger>
              <InfoIcon className="mx-2 h-4 w-4" />
            </TooltipTrigger>

            <TooltipContent className="max-w-md space-y-2 p-4 text-foreground">
              <h2>
                <strong>
                  <Trans>Recipient signing request email</Trans>
                </strong>
              </h2>

              <p>
                <Trans>
                  This email is sent to the recipient requesting them to sign the document.
                </Trans>
              </p>
            </TooltipContent>
          </Tooltip>
        </label>
      </div>

      <div className="flex flex-row items-center">
        <Checkbox
          id={DocumentEmailEvents.RecipientRemoved}
          className="h-5 w-5"
          checked={value.recipientRemoved}
          onCheckedChange={(checked) =>
            onChange({ ...value, [DocumentEmailEvents.RecipientRemoved]: Boolean(checked) })
          }
        />

        <label
          className="ml-2 flex flex-row items-center text-sm text-muted-foreground"
          htmlFor={DocumentEmailEvents.RecipientRemoved}
        >
          <Trans>Email recipients when they're removed from a pending document</Trans>

          <Tooltip>
            <TooltipTrigger>
              <InfoIcon className="mx-2 h-4 w-4" />
            </TooltipTrigger>

            <TooltipContent className="max-w-md space-y-2 p-4 text-foreground">
              <h2>
                <strong>
                  <Trans>Recipient removed email</Trans>
                </strong>
              </h2>

              <p>
                <Trans>
                  This email is sent to the recipient if they are removed from a pending document.
                </Trans>
              </p>
            </TooltipContent>
          </Tooltip>
        </label>
      </div>

      <div className="flex flex-row items-center">
        <Checkbox
          id={DocumentEmailEvents.DocumentPending}
          className="h-5 w-5"
          checked={value.documentPending}
          onCheckedChange={(checked) =>
            onChange({ ...value, [DocumentEmailEvents.DocumentPending]: Boolean(checked) })
          }
        />

        <label
          className="ml-2 flex flex-row items-center text-sm text-muted-foreground"
          htmlFor={DocumentEmailEvents.DocumentPending}
        >
          <Trans>Email the signer if the document is still pending</Trans>

          <Tooltip>
            <TooltipTrigger>
              <InfoIcon className="mx-2 h-4 w-4" />
            </TooltipTrigger>

            <TooltipContent className="max-w-md space-y-2 p-4 text-foreground">
              <h2>
                <strong>
                  <Trans>Document pending email</Trans>
                </strong>
              </h2>

              <p>
                <Trans>
                  This email will be sent to the recipient who has just signed the document, if
                  there are still other recipients who have not signed yet.
                </Trans>
              </p>
            </TooltipContent>
          </Tooltip>
        </label>
      </div>

      <div className="flex flex-row items-center">
        <Checkbox
          id={DocumentEmailEvents.DocumentCompleted}
          className="h-5 w-5"
          checked={value.documentCompleted}
          onCheckedChange={(checked) =>
            onChange({ ...value, [DocumentEmailEvents.DocumentCompleted]: Boolean(checked) })
          }
        />

        <label
          className="ml-2 flex flex-row items-center text-sm text-muted-foreground"
          htmlFor={DocumentEmailEvents.DocumentCompleted}
        >
          <Trans>Email recipients when the document is completed</Trans>

          <Tooltip>
            <TooltipTrigger>
              <InfoIcon className="mx-2 h-4 w-4" />
            </TooltipTrigger>

            <TooltipContent className="max-w-md space-y-2 p-4 text-foreground">
              <h2>
                <strong>
                  <Trans>Document completed email</Trans>
                </strong>
              </h2>

              <p>
                <Trans>
                  This will be sent to all recipients once the document has been fully completed.
                </Trans>
              </p>
            </TooltipContent>
          </Tooltip>
        </label>
      </div>

      <div className="flex flex-row items-center">
        <Checkbox
          id={DocumentEmailEvents.DocumentDeleted}
          className="h-5 w-5"
          checked={value.documentDeleted}
          onCheckedChange={(checked) =>
            onChange({ ...value, [DocumentEmailEvents.DocumentDeleted]: Boolean(checked) })
          }
        />

        <label
          className="ml-2 flex flex-row items-center text-sm text-muted-foreground"
          htmlFor={DocumentEmailEvents.DocumentDeleted}
        >
          <Trans>Email recipients when a pending document is deleted</Trans>

          <Tooltip>
            <TooltipTrigger>
              <InfoIcon className="mx-2 h-4 w-4" />
            </TooltipTrigger>

            <TooltipContent className="max-w-md space-y-2 p-4 text-foreground">
              <h2>
                <strong>
                  <Trans>Document deleted email</Trans>
                </strong>
              </h2>

              <p>
                <Trans>
                  This will be sent to all recipients if a pending document has been deleted.
                </Trans>
              </p>
            </TooltipContent>
          </Tooltip>
        </label>
      </div>

      <div className="flex flex-row items-center">
        <Checkbox
          id={DocumentEmailEvents.OwnerDocumentCompleted}
          className="h-5 w-5"
          checked={value.ownerDocumentCompleted}
          onCheckedChange={(checked) =>
            onChange({ ...value, [DocumentEmailEvents.OwnerDocumentCompleted]: Boolean(checked) })
          }
        />

        <label
          className="ml-2 flex flex-row items-center text-sm text-muted-foreground"
          htmlFor={DocumentEmailEvents.OwnerDocumentCompleted}
        >
          <Trans>Email the owner when the document is completed</Trans>

          <Tooltip>
            <TooltipTrigger>
              <InfoIcon className="mx-2 h-4 w-4" />
            </TooltipTrigger>

            <TooltipContent className="max-w-md space-y-2 p-4 text-foreground">
              <h2>
                <strong>
                  <Trans>Document completed email</Trans>
                </strong>
              </h2>

              <p>
                <Trans>
                  This will be sent to the document owner once the document has been fully
                  completed.
                </Trans>
              </p>
            </TooltipContent>
          </Tooltip>
        </label>
      </div>

      <div className="flex flex-row items-center">
        <Checkbox
          id={DocumentEmailEvents.OwnerRecipientExpired}
          className="h-5 w-5"
          checked={value.ownerRecipientExpired}
          onCheckedChange={(checked) =>
            onChange({ ...value, [DocumentEmailEvents.OwnerRecipientExpired]: Boolean(checked) })
          }
        />

        <label
          className="ml-2 flex flex-row items-center text-sm text-muted-foreground"
          htmlFor={DocumentEmailEvents.OwnerRecipientExpired}
        >
          <Trans>Send recipient expired email to the owner</Trans>

          <Tooltip>
            <TooltipTrigger>
              <InfoIcon className="mx-2 h-4 w-4" />
            </TooltipTrigger>

            <TooltipContent className="max-w-md space-y-2 p-4 text-foreground">
              <h2>
                <strong>
                  <Trans>Recipient expired email</Trans>
                </strong>
              </h2>

              <p>
                <Trans>
                  This will be sent to the document owner when a recipient's signing window has
                  expired.
                </Trans>
              </p>
            </TooltipContent>
          </Tooltip>
        </label>
      </div>
    </div>
  );
};
