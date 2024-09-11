import { Trans, msg } from '@lingui/macro';
import { useLingui } from '@lingui/react';

import { validateTextField } from '@documenso/lib/advanced-fields-validation/validate-text';
import { type TTextFieldMeta as TextFieldMeta } from '@documenso/lib/types/field-meta';
import { Input } from '@documenso/ui/primitives/input';
import { Label } from '@documenso/ui/primitives/label';
import { Switch } from '@documenso/ui/primitives/switch';
import { Textarea } from '@documenso/ui/primitives/textarea';

type TextFieldAdvancedSettingsProps = {
  fieldState: TextFieldMeta;
  handleFieldChange: (key: keyof TextFieldMeta, value: string | boolean) => void;
  handleErrors: (errors: string[]) => void;
};

export const TextFieldAdvancedSettings = ({
  fieldState,
  handleFieldChange,
  handleErrors,
}: TextFieldAdvancedSettingsProps) => {
  const { _ } = useLingui();

  const handleInput = (field: keyof TextFieldMeta, value: string | boolean) => {
    const text = field === 'text' ? String(value) : fieldState.text || '';
    const limit =
      field === 'characterLimit' ? Number(value) : Number(fieldState.characterLimit || 0);
    const readOnly = field === 'readOnly' ? Boolean(value) : Boolean(fieldState.readOnly);
    const required = field === 'required' ? Boolean(value) : Boolean(fieldState.required);

    const textErrors = validateTextField(text, {
      characterLimit: Number(limit),
      readOnly,
      required,
    });

    handleErrors(textErrors);
    handleFieldChange(field, value);
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Label>
          <Trans>Label</Trans>
        </Label>
        <Input
          id="label"
          className="bg-background mt-2"
          placeholder={_(msg`Field label`)}
          value={fieldState.label}
          onChange={(e) => handleFieldChange('label', e.target.value)}
        />
      </div>
      <div>
        <Label className="mt-4">
          <Trans>Placeholder</Trans>
        </Label>
        <Input
          id="placeholder"
          className="bg-background mt-2"
          placeholder={_(msg`Field placeholder`)}
          value={fieldState.placeholder}
          onChange={(e) => handleFieldChange('placeholder', e.target.value)}
        />
      </div>

      <div>
        <Label className="mt-4">
          <Trans>Add text</Trans>
        </Label>
        <Textarea
          id="text"
          className="bg-background mt-2"
          placeholder={_(msg`Add text to the field`)}
          value={fieldState.text}
          onChange={(e) => handleInput('text', e.target.value)}
        />
      </div>

      <div>
        <Label>
          <Trans>Character Limit</Trans>
        </Label>
        <Input
          id="characterLimit"
          type="number"
          min={0}
          className="bg-background mt-2"
          placeholder={_(msg`Field character limit`)}
          value={fieldState.characterLimit}
          onChange={(e) => handleInput('characterLimit', e.target.value)}
        />
      </div>

      <div className="mt-4 flex flex-col gap-4">
        <div className="flex flex-row items-center gap-2">
          <Switch
            className="bg-background"
            checked={fieldState.required}
            onCheckedChange={(checked) => handleInput('required', checked)}
          />
          <Label>
            <Trans>Required field</Trans>
          </Label>
        </div>
        <div className="flex flex-row items-center gap-2">
          <Switch
            className="bg-background"
            checked={fieldState.readOnly}
            onCheckedChange={(checked) => handleInput('readOnly', checked)}
          />
          <Label>
            <Trans>Read only</Trans>
          </Label>
        </div>
      </div>
    </div>
  );
};
