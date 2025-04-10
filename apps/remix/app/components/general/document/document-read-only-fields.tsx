import { useState } from 'react';

import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import type { DocumentMeta, TemplateMeta } from '@prisma/client';
import { FieldType, SigningStatus } from '@prisma/client';
import { Clock, EyeOffIcon } from 'lucide-react';
import { P, match } from 'ts-pattern';

import {
  DEFAULT_DOCUMENT_DATE_FORMAT,
  convertToLocalSystemFormat,
} from '@documenso/lib/constants/date-formats';
import { PDF_VIEWER_PAGE_SELECTOR } from '@documenso/lib/constants/pdf-viewer';
import { DEFAULT_DOCUMENT_TIME_ZONE } from '@documenso/lib/constants/time-zones';
import type { DocumentField } from '@documenso/lib/server-only/field/get-fields-for-document';
import { parseMessageDescriptor } from '@documenso/lib/utils/i18n';
import { extractInitials } from '@documenso/lib/utils/recipient-formatter';
import { FieldRootContainer } from '@documenso/ui/components/field/field';
import { SignatureIcon } from '@documenso/ui/icons/signature';
import { cn } from '@documenso/ui/lib/utils';
import { Avatar, AvatarFallback } from '@documenso/ui/primitives/avatar';
import { Badge } from '@documenso/ui/primitives/badge';
import { FRIENDLY_FIELD_TYPE } from '@documenso/ui/primitives/document-flow/types';
import { ElementVisible } from '@documenso/ui/primitives/element-visible';
import { PopoverHover } from '@documenso/ui/primitives/popover';

export type DocumentReadOnlyFieldsProps = {
  fields: DocumentField[];
  documentMeta?: DocumentMeta | TemplateMeta;
  showFieldStatus?: boolean;
};

export const DocumentReadOnlyFields = ({
  documentMeta,
  fields,
  showFieldStatus = true,
}: DocumentReadOnlyFieldsProps) => {
  const { _ } = useLingui();

  const [hiddenFieldIds, setHiddenFieldIds] = useState<Record<string, boolean>>({});

  const handleHideField = (fieldId: string) => {
    setHiddenFieldIds((prev) => ({ ...prev, [fieldId]: true }));
  };

  return (
    <ElementVisible target={PDF_VIEWER_PAGE_SELECTOR}>
      {fields.map(
        (field) =>
          !hiddenFieldIds[field.secondaryId] && (
            <FieldRootContainer
              field={field}
              key={field.id}
              cardClassName="border-gray-300/50 !shadow-none backdrop-blur-[1px] bg-gray-50 ring-0 ring-offset-0"
            >
              <div className="absolute -right-3 -top-3">
                <PopoverHover
                  trigger={
                    <Avatar className="dark:border-foreground h-8 w-8 border-2 border-solid border-gray-200/50 transition-colors hover:border-gray-200">
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
                    <span>{parseMessageDescriptor(_, FRIENDLY_FIELD_TYPE[field.type])} field</span>
                  </p>

                  <p className="text-muted-foreground mt-1 text-center text-xs">
                    {field.recipient.name
                      ? `${field.recipient.name} (${field.recipient.email})`
                      : field.recipient.email}{' '}
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

              <div className="text-muted-foreground dark:text-background/70 break-all text-sm">
                {field.recipient.signingStatus === SigningStatus.SIGNED &&
                  match(field)
                    .with({ type: FieldType.SIGNATURE }, (field) =>
                      field.signature?.signatureImageAsBase64 ? (
                        <img
                          src={field.signature.signatureImageAsBase64}
                          alt="Signature"
                          className="h-full w-full object-contain dark:invert"
                        />
                      ) : (
                        <p className="font-signature text-muted-foreground text-lg duration-200 sm:text-xl md:text-2xl">
                          {field.signature?.typedSignature}
                        </p>
                      ),
                    )
                    .with(
                      {
                        type: P.union(
                          FieldType.NAME,
                          FieldType.INITIALS,
                          FieldType.EMAIL,
                          FieldType.NUMBER,
                          FieldType.RADIO,
                          FieldType.CHECKBOX,
                          FieldType.DROPDOWN,
                        ),
                      },
                      () => field.customText,
                    )
                    .with({ type: FieldType.TEXT }, () => field.customText.substring(0, 20) + '...')
                    .with({ type: FieldType.DATE }, () =>
                      convertToLocalSystemFormat(
                        field.customText,
                        documentMeta?.dateFormat ?? DEFAULT_DOCUMENT_DATE_FORMAT,
                        documentMeta?.timezone ?? DEFAULT_DOCUMENT_TIME_ZONE,
                      ),
                    )
                    .with({ type: FieldType.FREE_SIGNATURE }, () => null)
                    .exhaustive()}

                {field.recipient.signingStatus === SigningStatus.NOT_SIGNED && (
                  <p
                    className={cn('text-muted-foreground text-lg duration-200', {
                      'font-signature sm:text-xl md:text-2xl':
                        field.type === FieldType.SIGNATURE ||
                        field.type === FieldType.FREE_SIGNATURE,
                    })}
                  >
                    {parseMessageDescriptor(_, FRIENDLY_FIELD_TYPE[field.type])}
                  </p>
                )}
              </div>
            </FieldRootContainer>
          ),
      )}
    </ElementVisible>
  );
};
