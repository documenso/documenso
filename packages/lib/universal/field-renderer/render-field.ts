import type { Signature } from '@prisma/client';
import { type Field, FieldType } from '@prisma/client';
import type Konva from 'konva';
import { match } from 'ts-pattern';

import type { TRecipientColor } from '@documenso/ui/lib/recipient-colors';

import type { TFieldMetaSchema } from '../../types/field-meta';
import { renderCheckboxFieldElement } from './render-checkbox-field';
import { renderDropdownFieldElement } from './render-dropdown-field';
import { renderRadioFieldElement } from './render-radio-field';
import { renderSignatureFieldElement } from './render-signature-field';
import { renderTextFieldElement } from './render-text-field';

export const MIN_FIELD_HEIGHT_PX = 12;
export const MIN_FIELD_WIDTH_PX = 36;

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
  signature?: Signature | null;
};

type RenderFieldOptions = {
  field: FieldToRender;
  pageLayer: Konva.Layer;
  pageWidth: number;
  pageHeight: number;

  color?: TRecipientColor;

  /**
   * The render type.
   *
   * @default 'edit'
   *
   * - `edit` - The field is rendered in edit mode.
   * - `sign` - The field is rendered in sign mode. No interactive elements.
   * - `export` - The field is rendered in export mode. No backgrounds, interactive elements, etc.
   */
  mode: 'edit' | 'sign' | 'export';

  editable?: boolean;
};

export const renderField = ({
  field,
  pageLayer,
  pageWidth,
  pageHeight,
  mode,
  editable,
  color,
}: RenderFieldOptions) => {
  const options = {
    pageLayer,
    pageWidth,
    pageHeight,
    mode,
    color,
    editable,
  };

  return match(field.type)
    .with(FieldType.TEXT, () => renderTextFieldElement(field, options))
    .with(FieldType.CHECKBOX, () => renderCheckboxFieldElement(field, options))
    .with(FieldType.RADIO, () => renderRadioFieldElement(field, options))
    .with(FieldType.DROPDOWN, () => renderDropdownFieldElement(field, options))
    .with(FieldType.SIGNATURE, () => renderSignatureFieldElement(field, options))
    .otherwise(() => renderTextFieldElement(field, options)); // Todo
};
