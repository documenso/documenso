import { type TTextFieldMeta as TextFieldMeta } from '@documenso/lib/types/field-field-meta';
import { Input } from '@documenso/ui/primitives/input';
import { Label } from '@documenso/ui/primitives/label';
import { Switch } from '@documenso/ui/primitives/switch';
import { Textarea } from '@documenso/ui/primitives/textarea';

type TextFieldAdvancedSettingsProps = {
  fieldState: TextFieldMeta;
  handleFieldChange: (key: keyof TextFieldMeta, value: string) => void;
  handleToggleChange: (key: keyof TextFieldMeta) => void;
  handleErrors: (errors: string[]) => void;
};

export const TextFieldAdvancedSettings = ({
  fieldState,
  handleFieldChange,
  handleToggleChange,
  handleErrors,
}: TextFieldAdvancedSettingsProps) => {
  const validateText = (value: string, characterLimit: string | undefined) => {
    const errors = [];

    const limit = characterLimit ? Number(characterLimit) : 0;

    if (limit > 0 && value.length > limit) {
      errors.push(`Text length (${value.length}) exceeds the character limit (${limit})`);
    }

    if (characterLimit && isNaN(Number(characterLimit))) {
      errors.push('Character limit must be a number');
    }

    return errors;
  };

  const handleInput = (field: keyof TextFieldMeta, value: string) => {
    const text = field === 'text' ? value : fieldState.text || '';
    const limit =
      field === 'characterLimit' ? Number(value) : Number(fieldState.characterLimit || 0);

    const textErrors = validateText(text, String(limit));
    handleErrors(textErrors);

    handleFieldChange(field, value);
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Label>Label</Label>
        <Input
          id="label"
          className="bg-background mt-2"
          placeholder="Field label"
          value={fieldState.label}
          onChange={(e) => handleFieldChange('label', e.target.value)}
        />
      </div>
      <div>
        <Label className="mt-4">Placeholder</Label>
        <Input
          id="placeholder"
          className="bg-background mt-2"
          placeholder="Field placeholder"
          value={fieldState.placeholder}
          onChange={(e) => handleFieldChange('placeholder', e.target.value)}
        />
      </div>

      <div>
        <Label className="mt-4">Add text</Label>
        <Textarea
          id="text"
          className="bg-background mt-2"
          placeholder="Add text to the field"
          value={fieldState.text}
          onChange={(e) => handleInput('text', e.target.value)}
        />
      </div>

      <div>
        <Label>Character Limit</Label>
        <Input
          id="characterLimit"
          className="bg-background mt-2"
          placeholder="Field character limit"
          value={fieldState.characterLimit}
          onChange={(e) => handleInput('characterLimit', e.target.value)}
        />
      </div>

      <div className="mt-4 flex flex-col gap-4">
        <div className="flex flex-row items-center gap-2">
          <Switch
            className="bg-background"
            checked={fieldState.required}
            onCheckedChange={() => {
              if (fieldState.readOnly === true) {
                handleToggleChange('readOnly');
              }
              handleToggleChange('required');
            }}
          />
          <Label>Required field</Label>
        </div>
        <div className="flex flex-row items-center gap-2">
          <Switch
            className="bg-background"
            checked={fieldState.readOnly}
            onCheckedChange={() => {
              if (fieldState.required) {
                handleToggleChange('required');
              }
              handleToggleChange('readOnly');
            }}
          />
          <Label>Read only</Label>
        </div>
      </div>
    </div>
  );
};
