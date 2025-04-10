import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import type { FieldType } from '@prisma/client';

import { type TFieldMetaSchema as FieldMeta } from '@documenso/lib/types/field-meta';
import { parseMessageDescriptor } from '@documenso/lib/utils/i18n';
import { FieldAdvancedSettings } from '@documenso/ui/primitives/document-flow/field-item-advanced-settings';
import { FRIENDLY_FIELD_TYPE } from '@documenso/ui/primitives/document-flow/types';
import { Sheet, SheetContent, SheetTitle } from '@documenso/ui/primitives/sheet';

export type FieldAdvancedSettingsDrawerProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  currentField: {
    id: string;
    formId: string;
    type: FieldType;
    pageNumber: number;
    pageX: number;
    pageY: number;
    pageWidth: number;
    pageHeight: number;
    recipientId: number;
    signerEmail: string;
    fieldMeta?: FieldMeta;
  } | null;
  fields: Array<{
    id: string;
    formId: string;
    type: FieldType;
    pageNumber: number;
    pageX: number;
    pageY: number;
    pageWidth: number;
    pageHeight: number;
    recipientId: number;
    signerEmail: string;
    fieldMeta?: FieldMeta;
  }>;
  onFieldUpdate: (formId: string, fieldMeta: FieldMeta) => void;
};

export const FieldAdvancedSettingsDrawer = ({
  isOpen,
  onOpenChange,
  currentField,
  fields,
  onFieldUpdate,
}: FieldAdvancedSettingsDrawerProps) => {
  const { _ } = useLingui();

  if (!currentField) {
    return null;
  }

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent position="right" size="lg" className="w-9/12 max-w-sm overflow-y-auto">
        <SheetTitle className="sr-only">
          {parseMessageDescriptor(
            _,
            msg`Configure ${parseMessageDescriptor(_, FRIENDLY_FIELD_TYPE[currentField.type])} Field`,
          )}
        </SheetTitle>

        <FieldAdvancedSettings
          title={msg`Advanced settings`}
          description={msg`Configure the ${parseMessageDescriptor(
            _,
            FRIENDLY_FIELD_TYPE[currentField.type],
          )} field`}
          field={currentField}
          fields={fields}
          onAdvancedSettings={() => onOpenChange(false)}
          onSave={(fieldMeta) => {
            onFieldUpdate(currentField.formId, fieldMeta);
            onOpenChange(false);
          }}
        />
      </SheetContent>
    </Sheet>
  );
};
