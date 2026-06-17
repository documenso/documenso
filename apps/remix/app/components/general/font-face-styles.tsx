import { type FieldFontOption, getUploadedFieldFontIds } from '@documenso/lib/universal/field-fonts';

import { useCspNonce } from '~/utils/nonce';

type FontFaceStylesProps = (
  | {
      fonts: FieldFontOption[];
      fields?: never;
    }
  | {
      fields: { fieldMeta?: unknown }[];
      fonts?: never;
    }
) & {
  recipientToken?: string;
};

export const FontFaceStyles = (props: FontFaceStylesProps) => {
  const nonce = useCspNonce();
  const fontIds = props.fonts ? props.fonts.map((font) => font.id) : getUploadedFieldFontIds(props.fields);
  const fontUrlSearchParams = props.recipientToken ? `?token=${encodeURIComponent(props.recipientToken)}` : '';

  if (fontIds.length === 0) {
    return null;
  }

  const css = fontIds
    .map(
      (fontId) =>
        `@font-face{font-family:"${fontId}";src:url("/api/fonts/${fontId}${fontUrlSearchParams}");font-display:swap;}`,
    )
    .join('\n');

  return <style nonce={nonce}>{css}</style>;
};
