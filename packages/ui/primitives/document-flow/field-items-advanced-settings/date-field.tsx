import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';

import { validateFields as validateDateFields } from '@documenso/lib/advanced-fields-validation/validate-fields';
import { type TDateFieldMeta as DateFieldMeta } from '@documenso/lib/types/field-meta';
import { Input } from '@documenso/ui/primitives/input';
import { Label } from '@documenso/ui/primitives/label';

type DateFieldAdvancedSettingsProps = {
  fieldState: DateFieldMeta;
  handleFieldChange: (key: keyof DateFieldMeta, value: string | boolean) => void;
  handleErrors: (errors: string[]) => void;
};

export const DateFieldAdvancedSettings = ({
  fieldState,
  handleFieldChange,
  handleErrors,
}: DateFieldAdvancedSettingsProps) => {
  const { _ } = useLingui();

  // const handleInput = (field: keyof DateFieldMeta, value: string | boolean) => {
  //   if (field === 'fontSize') {
  //     const fontSize = value === '' ? '' : Number(value);
  //     if (typeof fontSize === 'number' && !Number.isNaN(fontSize)) {
  //       const errors = validateDateFields({
  //         fontSize,
  //         type: 'date',
  //       });
  //       handleErrors(errors);
  //       handleFieldChange(field, fontSize.toString());
  //     } else {
  //       handleErrors(['Invalid font size']);
  //     }
  //   } else {
  //     handleFieldChange(field, value);
  //   }
  // };

  const handleInput = (field: keyof DateFieldMeta, value: string | boolean) => {
    const fontSize = field === 'fontSize' ? Number(value) : Number(fieldState.fontSize ?? 14);

    const errors = validateDateFields({
      fontSize,
      type: 'date',
    });

    handleErrors(errors);
    handleFieldChange(field, value);
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Label>
          <Trans>Font Size</Trans>
        </Label>
        <Input
          id="fontSize"
          type="number"
          className="bg-background mt-2"
          placeholder={_(msg`Field font size`)}
          value={fieldState.fontSize}
          onChange={(e) => handleInput('fontSize', e.target.value)}
          min={8}
          max={96}
        />
      </div>
    </div>
  );
};
