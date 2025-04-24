import { useLingui } from '@lingui/react';
import type { DocumentMeta, Signature, TemplateMeta } from '@prisma/client';
import { FieldType } from '@prisma/client';
import { ChevronDown } from 'lucide-react';

import {
  DEFAULT_DOCUMENT_DATE_FORMAT,
  convertToLocalSystemFormat,
} from '@documenso/lib/constants/date-formats';
import type { TFieldMetaSchema } from '@documenso/lib/types/field-meta';
import { fromCheckboxValue } from '@documenso/lib/universal/field-checkbox';

import { cn } from '../../lib/utils';
import { Checkbox } from '../checkbox';
import { Label } from '../label';
import { RadioGroup, RadioGroupItem } from '../radio-group';
import { FRIENDLY_FIELD_TYPE } from './types';

type FieldIconProps = {
  /**
   * Loose field type since this is used for partial fields.
   */
  field: {
    inserted?: boolean;
    customText?: string;
    type: FieldType;
    fieldMeta?: TFieldMetaSchema | null;
    signature?: Signature | null;
  };
  documentMeta?: DocumentMeta | TemplateMeta;
};

/**
 * Renders the content inside field containers prior to sealing.
 */
export const FieldContent = ({ field, documentMeta }: FieldIconProps) => {
  const { _ } = useLingui();

  const { type, fieldMeta } = field;

  // Only render checkbox if values exist, otherwise render the empty checkbox field content.
  if (
    field.type === FieldType.CHECKBOX &&
    field.fieldMeta?.type === 'checkbox' &&
    field.fieldMeta.values &&
    field.fieldMeta.values.length > 0
  ) {
    let checkedValues: string[] = [];

    try {
      checkedValues = fromCheckboxValue(field.customText ?? '');
    } catch (err) {
      // Do nothing.

      console.error(err);
    }

    return (
      <div className="flex flex-col gap-y-1 py-0.5">
        {field.fieldMeta.values.map((item, index) => (
          <div key={index} className="flex items-center">
            <Checkbox
              className="h-3 w-3"
              id={`checkbox-${index}`}
              checked={checkedValues.includes(
                item.value === '' ? `empty-value-${index + 1}` : item.value, // I got no idea...
              )}
            />

            {item.value && (
              <Label
                htmlFor={`checkbox-${index}`}
                className="text-foreground ml-1.5 text-xs font-normal"
              >
                {item.value}
              </Label>
            )}
          </div>
        ))}
      </div>
    );
  }

  // Only render radio if values exist, otherwise render the empty radio field content.
  if (
    field.type === FieldType.RADIO &&
    field.fieldMeta?.type === 'radio' &&
    field.fieldMeta.values &&
    field.fieldMeta.values.length > 0
  ) {
    return (
      <div className="flex flex-col gap-y-2 py-0.5">
        <RadioGroup className="gap-y-1">
          {field.fieldMeta.values.map((item, index) => (
            <div key={index} className="flex items-center">
              <RadioGroupItem
                className="pointer-events-none h-3 w-3"
                value={item.value}
                id={`option-${index}`}
                checked={item.value === field.customText}
              />
              {item.value && (
                <Label
                  htmlFor={`option-${index}`}
                  className="text-foreground ml-1.5 text-xs font-normal"
                >
                  {item.value}
                </Label>
              )}
            </div>
          ))}
        </RadioGroup>
      </div>
    );
  }

  if (
    field.type === FieldType.DROPDOWN &&
    field.fieldMeta?.type === 'dropdown' &&
    !field.inserted
  ) {
    return (
      <div className="text-field-card-foreground flex flex-row items-center py-0.5 text-[clamp(0.07rem,25cqw,0.825rem)] text-sm">
        <p>Select</p>
        <ChevronDown className="h-4 w-4" />
      </div>
    );
  }

  if (
    field.type === FieldType.SIGNATURE &&
    field.signature?.signatureImageAsBase64 &&
    field.inserted
  ) {
    return (
      <img
        src={field.signature.signatureImageAsBase64}
        alt="Signature"
        className="h-full w-full object-contain"
      />
    );
  }

  let textToDisplay = fieldMeta?.label || _(FRIENDLY_FIELD_TYPE[type]) || '';

  const isSignatureField =
    field.type === FieldType.SIGNATURE || field.type === FieldType.FREE_SIGNATURE;

  // Trim default labels.
  if (textToDisplay.length > 20) {
    textToDisplay = textToDisplay.substring(0, 20) + '...';
  }

  if (field.inserted) {
    if (field.customText) {
      textToDisplay = field.customText;
    }

    if (field.type === FieldType.DATE) {
      textToDisplay = convertToLocalSystemFormat(
        field.customText ?? '',
        documentMeta?.dateFormat ?? DEFAULT_DOCUMENT_DATE_FORMAT,
      );
    }

    if (isSignatureField && field.signature?.typedSignature) {
      textToDisplay = field.signature.typedSignature;
    }
  }

  const textAlign = fieldMeta && 'textAlign' in fieldMeta ? fieldMeta.textAlign : 'left';

  return (
    <div
      className={cn(
        'text-field-card-foreground flex h-full w-full items-center justify-center gap-x-1.5 overflow-clip whitespace-nowrap text-center text-[clamp(0.07rem,25cqw,0.825rem)]',
        {
          // Using justify instead of align because we also vertically center the text.
          'justify-start': field.inserted && !isSignatureField && textAlign === 'left',
          'justify-end': field.inserted && !isSignatureField && textAlign === 'right',
          'font-signature text-[clamp(0.07rem,25cqw,1.125rem)]': isSignatureField,
        },
      )}
    >
      {textToDisplay}
    </div>
  );
};
