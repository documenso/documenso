'use client';

import { useState } from 'react';

import { EyeOffIcon } from 'lucide-react';
import { P, match } from 'ts-pattern';

import {
  DEFAULT_DOCUMENT_DATE_FORMAT,
  convertToLocalSystemFormat,
} from '@documenso/lib/constants/date-formats';
import { PDF_VIEWER_PAGE_SELECTOR } from '@documenso/lib/constants/pdf-viewer';
import { DEFAULT_DOCUMENT_TIME_ZONE } from '@documenso/lib/constants/time-zones';
import type { DocumentField } from '@documenso/lib/server-only/field/get-fields-for-document';
import { extractInitials } from '@documenso/lib/utils/recipient-formatter';
import type { DocumentMeta } from '@documenso/prisma/client';
import { FieldType, SigningStatus } from '@documenso/prisma/client';
import { FieldRootContainer } from '@documenso/ui/components/field/field';
import { cn } from '@documenso/ui/lib/utils';
import { Avatar, AvatarFallback } from '@documenso/ui/primitives/avatar';
import { FRIENDLY_FIELD_TYPE } from '@documenso/ui/primitives/document-flow/types';
import { ElementVisible } from '@documenso/ui/primitives/element-visible';
import { PopoverHover } from '@documenso/ui/primitives/popover';

export type DocumentReadOnlyFieldsProps = {
  fields: DocumentField[];
  documentMeta?: DocumentMeta;
};

export const DocumentReadOnlyFields = ({ documentMeta, fields }: DocumentReadOnlyFieldsProps) => {
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
                        {extractInitials(field.Recipient.name || field.Recipient.email)}
                      </AvatarFallback>
                    </Avatar>
                  }
                  contentProps={{
                    className: 'relative flex w-fit flex-col p-2.5 text-sm',
                  }}
                >
                  <p className="font-semibold">
                    {field.Recipient.signingStatus === SigningStatus.SIGNED ? 'Signed' : 'Pending'}{' '}
                    {FRIENDLY_FIELD_TYPE[field.type].toLowerCase()} field
                  </p>

                  <p className="text-muted-foreground text-xs">
                    {field.Recipient.name
                      ? `${field.Recipient.name} (${field.Recipient.email})`
                      : field.Recipient.email}{' '}
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
                {field.Recipient.signingStatus === SigningStatus.SIGNED &&
                  match(field)
                    .with({ type: FieldType.SIGNATURE }, (field) =>
                      field.Signature?.signatureImageAsBase64 ? (
                        <img
                          src={field.Signature.signatureImageAsBase64}
                          alt="Signature"
                          className="h-full w-full object-contain dark:invert"
                        />
                      ) : (
                        <p className="font-signature text-muted-foreground text-lg duration-200 sm:text-xl md:text-2xl lg:text-3xl">
                          {field.Signature?.typedSignature}
                        </p>
                      ),
                    )
                    .with(
                      {
                        type: P.union(
                          FieldType.NAME,
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

                {field.Recipient.signingStatus === SigningStatus.NOT_SIGNED && (
                  <p
                    className={cn('text-muted-foreground text-lg duration-200', {
                      'font-signature sm:text-xl md:text-2xl lg:text-3xl':
                        field.type === FieldType.SIGNATURE ||
                        field.type === FieldType.FREE_SIGNATURE,
                    })}
                  >
                    {FRIENDLY_FIELD_TYPE[field.type]}
                  </p>
                )}
              </div>
            </FieldRootContainer>
          ),
      )}
    </ElementVisible>
  );
};
