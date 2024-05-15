'use client';

import { useState } from 'react';

import { PDF_VIEWER_PAGE_SELECTOR } from '@documenso/lib/constants/pdf-viewer';
import type { CompletedField } from '@documenso/lib/types/fields';
import { extractInitials } from '@documenso/lib/utils/recipient-formatter';
import { FieldRootContainer } from '@documenso/ui/components/field/field';
import { Avatar, AvatarFallback } from '@documenso/ui/primitives/avatar';
import { Button } from '@documenso/ui/primitives/button';
import { FRIENDLY_FIELD_TYPE } from '@documenso/ui/primitives/document-flow/types';
import { ElementVisible } from '@documenso/ui/primitives/element-visible';
import { PopoverHover } from '@documenso/ui/primitives/popover';

export type DocumentPendingFieldsProps = {
  fields: CompletedField[];
};

export const DocumentPendingFields = ({ fields }: DocumentPendingFieldsProps) => {
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
                    {FRIENDLY_FIELD_TYPE[field.type]} field for{' '}
                    <span className="font-semibold">
                      {field.Recipient.name
                        ? `${field.Recipient.name} (${field.Recipient.email})`
                        : field.Recipient.email}{' '}
                    </span>
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

              <div className="text-muted-foreground break-all text-sm">
                <p className="font-signature text-muted-foreground text-lg duration-200 sm:text-xl md:text-2xl lg:text-3xl">
                  {FRIENDLY_FIELD_TYPE[field.type]}
                </p>
              </div>
            </FieldRootContainer>
          ),
      )}
    </ElementVisible>
  );
};
