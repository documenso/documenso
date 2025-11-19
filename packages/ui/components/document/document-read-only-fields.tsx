import { useState } from 'react';

import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import type { DocumentMeta, Field, Recipient } from '@prisma/client';
import { SigningStatus } from '@prisma/client';
import { Clock, EyeOffIcon } from 'lucide-react';

import { PDF_VIEWER_PAGE_SELECTOR } from '@doku-seal/lib/constants/pdf-viewer';
import { isTemplateRecipientEmailPlaceholder } from '@doku-seal/lib/constants/template';
import { parseMessageDescriptor } from '@doku-seal/lib/utils/i18n';
import { extractInitials } from '@doku-seal/lib/utils/recipient-formatter';
import { FieldRootContainer } from '@doku-seal/ui/components/field/field';
import { SignatureIcon } from '@doku-seal/ui/icons/signature';
import { Avatar, AvatarFallback } from '@doku-seal/ui/primitives/avatar';
import { Badge } from '@doku-seal/ui/primitives/badge';
import { FRIENDLY_FIELD_TYPE } from '@doku-seal/ui/primitives/document-flow/types';
import { ElementVisible } from '@doku-seal/ui/primitives/element-visible';
import { PopoverHover } from '@doku-seal/ui/primitives/popover';

import { getRecipientColorStyles } from '../../lib/recipient-colors';
import { FieldContent } from '../../primitives/document-flow/field-content';

const getRecipientDisplayText = (recipient: { name: string; email: string }) => {
  if (recipient.name && !isTemplateRecipientEmailPlaceholder(recipient.email)) {
    return `${recipient.name} (${recipient.email})`;
  }

  if (recipient.name && isTemplateRecipientEmailPlaceholder(recipient.email)) {
    return recipient.name;
  }

  return recipient.email;
};

export type DocumentField = Field & {
  recipient: Pick<Recipient, 'name' | 'email' | 'signingStatus'>;
};

export type DocumentReadOnlyFieldsProps = {
  fields: DocumentField[];
  documentMeta?: Pick<DocumentMeta, 'dateFormat'>;

  showFieldStatus?: boolean;

  /**
   * Required if you want to show colors.
   *
   * Can't derive this from the fields because sometimes recipients don't have fields
   * yet.
   */
  recipientIds?: number[];

  /**
   * Whether to show the recipient tooltip.
   *
   * @default false
   */
  showRecipientTooltip?: boolean;

  /**
   * Whether to color code the recipient fields.
   *
   * @default false
   */
  showRecipientColors?: boolean;
};

export const mapFieldsWithRecipients = (
  fields: Field[],
  recipients: Recipient[],
): DocumentField[] => {
  return fields.map((field) => {
    const recipient = recipients.find((recipient) => recipient.id === field.recipientId) || {
      id: field.recipientId,
      name: 'Unknown',
      email: 'Unknown',
      signingStatus: SigningStatus.NOT_SIGNED,
    };

    return { ...field, recipient, signature: null };
  });
};

export const DocumentReadOnlyFields = ({
  documentMeta,
  fields,
  recipientIds = [],
  showFieldStatus = true,
  showRecipientTooltip = false,
  showRecipientColors = false,
}: DocumentReadOnlyFieldsProps) => {
  const { _ } = useLingui();

  const [hiddenFieldIds, setHiddenFieldIds] = useState<Record<string, boolean>>({});

  const handleHideField = (fieldId: string) => {
    setHiddenFieldIds((prev) => ({ ...prev, [fieldId]: true }));
  };

  const highestPageNumber = Math.max(...fields.map((field) => field.page));

  return (
    <ElementVisible target={`${PDF_VIEWER_PAGE_SELECTOR}[data-page-number="${highestPageNumber}"]`}>
      {fields.map(
        (field) =>
          !hiddenFieldIds[field.secondaryId] && (
            <FieldRootContainer
              field={field}
              key={field.id}
              readonly={true}
              color={
                showRecipientColors
                  ? getRecipientColorStyles(
                      Math.max(
                        recipientIds.findIndex((id) => id === field.recipientId),
                        0,
                      ),
                    )
                  : undefined
              }
            >
              {showRecipientTooltip && (
                <div className="absolute -right-3 -top-3">
                  <PopoverHover
                    trigger={
                      <Avatar className="h-6 w-6 border-2 border-solid border-gray-200/50 transition-colors hover:border-gray-200">
                        <AvatarFallback className="bg-neutral-50 text-xs text-gray-400">
                          {extractInitials(field.recipient.name || field.recipient.email)}
                        </AvatarFallback>
                      </Avatar>
                    }
                    contentProps={{
                      className: 'relative flex w-fit flex-col p-4 text-sm',
                    }}
                  >
                    {showFieldStatus && (
                      <Badge
                        className="mx-auto mb-1 py-0.5"
                        variant={
                          field.recipient.signingStatus === SigningStatus.SIGNED
                            ? 'default'
                            : 'secondary'
                        }
                      >
                        {field.recipient.signingStatus === SigningStatus.SIGNED ? (
                          <>
                            <SignatureIcon className="mr-1 h-3 w-3" />
                            <Trans>Signed</Trans>
                          </>
                        ) : (
                          <>
                            <Clock className="mr-1 h-3 w-3" />
                            <Trans>Pending</Trans>
                          </>
                        )}
                      </Badge>
                    )}

                    <p className="text-center font-semibold">
                      <span>
                        {parseMessageDescriptor(_, FRIENDLY_FIELD_TYPE[field.type])} field
                      </span>
                    </p>

                    <p className="text-muted-foreground mt-1 text-center text-xs">
                      {getRecipientDisplayText(field.recipient)}
                    </p>

                    <button
                      className="absolute right-0 top-0 my-1 p-2 focus:outline-none focus-visible:ring-0"
                      onClick={() => handleHideField(field.secondaryId)}
                      title="Hide field"
                    >
                      <EyeOffIcon className="h-3 w-3" />
                    </button>
                  </PopoverHover>
                </div>
              )}

              <FieldContent field={field} documentMeta={documentMeta} />
            </FieldRootContainer>
          ),
      )}
    </ElementVisible>
  );
};
