import type { Signature } from '@prisma/client';
import { type Field, FieldType } from '@prisma/client';
import type Konva from 'konva';
import { match } from 'ts-pattern';

import type { TRecipientColor } from '@documenso/ui/lib/recipient-colors';

import type { TFieldMetaSchema } from '../../types/field-meta';
import { renderCheckboxFieldElement } from './render-checkbox-field';
import { renderDropdownFieldElement } from './render-dropdown-field';
import { renderGenericTextFieldElement } from './render-generic-text-field';
import { renderRadioFieldElement } from './render-radio-field';
import { renderSignatureFieldElement } from './render-signature-field';

export const MIN_FIELD_HEIGHT_PX = 12;
export const MIN_FIELD_WIDTH_PX = 36;

/**
 * The render type.
 *
 * @default 'edit'
 *
 * - `edit` - The field is rendered in editor page.
 * - `sign` - The field is rendered for the signing page.
 * - `export` - The field is rendered for exporting and sealing into the PDF. No backgrounds, interactive elements, etc.
 */
export type FieldRenderMode = 'edit' | 'sign' | 'export';

export type FieldToRender = Pick<
  Field,
  'envelopeItemId' | 'recipientId' | 'type' | 'page' | 'customText' | 'inserted' | 'recipientId'
> & {
  renderId: string; // A unique ID for the field in the render.
  width: number;
  height: number;
  positionX: number;
  positionY: number;
  fieldMeta?: TFieldMetaSchema | null;
  signature?: Pick<Signature, 'signatureImageAsBase64' | 'typedSignature'> | null;
};

type RenderFieldOptions = {
  field: FieldToRender;
  pageLayer: Konva.Layer;
  pageWidth: number;
  pageHeight: number;

  color?: TRecipientColor;

  translations: Record<FieldType, string> | null;

  mode: FieldRenderMode;

  scale: number;
  editable?: boolean;
};

export const renderField = ({
  field,
  translations,
  pageLayer,
  pageWidth,
  pageHeight,
  mode,
  scale,
  editable,
  color,
}: RenderFieldOptions) => {
  const options = {
    pageLayer,
    pageWidth,
    pageHeight,
    translations,
    mode,
    color,
    editable,
    scale,
  };

  // If the generic text field element array changes, update the `GenericTextFieldTypeMetas` type
  return match(field.type)
    .with(
      FieldType.INITIALS,
      FieldType.NAME,
      FieldType.EMAIL,
      FieldType.DATE,
      FieldType.TEXT,
      FieldType.NUMBER,
      () => renderGenericTextFieldElement(field, options),
    )
    .with(FieldType.CHECKBOX, () => renderCheckboxFieldElement(field, options))
    .with(FieldType.RADIO, () => renderRadioFieldElement(field, options))
    .with(FieldType.DROPDOWN, () => renderDropdownFieldElement(field, options))
    .with(FieldType.SIGNATURE, () => renderSignatureFieldElement(field, options))
    .with(FieldType.FREE_SIGNATURE, () => {
      throw new Error('Free signature fields are not supported');
    })
    .exhaustive();
};
