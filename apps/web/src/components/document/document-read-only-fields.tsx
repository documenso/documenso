'use client';

import { useState } from 'react';

import { P, match } from 'ts-pattern';

import {
  DEFAULT_DOCUMENT_DATE_FORMAT,
  convertToLocalSystemFormat,
} from '@documenso/lib/constants/date-formats';
import { PDF_VIEWER_PAGE_SELECTOR } from '@documenso/lib/constants/pdf-viewer';
import { DEFAULT_DOCUMENT_TIME_ZONE } from '@documenso/lib/constants/time-zones';
import type { CompletedField } from '@documenso/lib/types/fields';
import { extractInitials } from '@documenso/lib/utils/recipient-formatter';
import type { DocumentMeta } from '@documenso/prisma/client';
import { FieldType } from '@documenso/prisma/client';
import { FieldRootContainer } from '@documenso/ui/components/field/field';
import { Avatar, AvatarFallback } from '@documenso/ui/primitives/avatar';
import { Button } from '@documenso/ui/primitives/button';
import { FRIENDLY_FIELD_TYPE } from '@documenso/ui/primitives/document-flow/types';
import { ElementVisible } from '@documenso/ui/primitives/element-visible';
import { PopoverHover } from '@documenso/ui/primitives/popover';

export type DocumentReadOnlyFieldsProps = {
  fields: CompletedField[];
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
              cardClassName="border-gray-100/50 !shadow-none backdrop-blur-[1px] bg-background/90"
            >
              <div className="absolute -right-3 -top-3">
                <PopoverHover
                  trigger={
                    <Avatar className="dark:border-border h-8 w-8 border-2 border-solid border-gray-200/50 transition-colors hover:border-gray-200">
                      <AvatarFallback className="bg-neutral-50 text-xs text-gray-400">
                        {extractInitials(field.Recipient.name || field.Recipient.email)}
                      </AvatarFallback>
                    </Avatar>
                  }
                  contentProps={{
                    className: 'flex w-fit flex-col py-2.5 text-sm',
                  }}
                >
                  <p>
                    <span className="font-semibold">
                      {field.Recipient.name
                        ? `${field.Recipient.name} (${field.Recipient.email})`
                        : field.Recipient.email}{' '}
                    </span>
                    inserted a {FRIENDLY_FIELD_TYPE[field.type].toLowerCase()}
                  </p>

                  <Button
                    variant="outline"
                    className="mt-2.5 h-6 text-xs focus:outline-none focus-visible:ring-0"
                    onClick={() => handleHideField(field.secondaryId)}
                  >
                    Hide field
                  </Button>
                </PopoverHover>
              </div>

              <div className="text-muted-foreground">
                {match(field)
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
                  .with({ type: P.union(FieldType.NAME, FieldType.TEXT, FieldType.EMAIL) }, () => (
                    <p className="text-muted-foreground text-lg">{field.customText}</p>
                  ))
                  .with({ type: FieldType.DATE }, () => (
                    <p>
                      {convertToLocalSystemFormat(
                        field.customText,
                        documentMeta?.dateFormat ?? DEFAULT_DOCUMENT_DATE_FORMAT,
                        documentMeta?.timezone ?? DEFAULT_DOCUMENT_TIME_ZONE,
                      )}
                    </p>
                  ))
                  .with({ type: FieldType.FREE_SIGNATURE }, () => null)
                  .exhaustive()}
              </div>
            </FieldRootContainer>
          ),
      )}
    </ElementVisible>
  );
};
